# CLAUDE.md — MatchService

## O que é este serviço

`match-service` é um microsserviço do ecossistema **FindMyParty**. Ele é responsável por:

1. Manter uma cópia local de perfis (recebidos via evento RabbitMQ).
2. Detectar matches mútuos quando dois usuários deram like um no outro.
3. Persistir matches em banco de dados PostgreSQL.
4. Gerenciar estado efêmero de usuário (sugestões, perfis vistos, perfis curtidos) em Redis.
5. Expor endpoints HTTP para consulta de matches, registro de swipes e consumo de sugestões.

---

## Stack

| Camada | Tecnologia |
|---|---|
| HTTP | Fastify 4 + @fastify/cors, @fastify/helmet, @fastify/swagger |
| Banco de dados | PostgreSQL 16 via Kysely (query builder) |
| Cache / estado | Redis 7 via ioredis |
| Mensageria | RabbitMQ 3.13 via amqplib |
| Validação | Zod |
| Logging | Pino + pino-loki |
| Observabilidade | OpenTelemetry SDK (OTLP HTTP) + Sentry |
| Testes | Vitest |
| Runtime | Node.js ESM puro (`"type": "module"`) |

Tipos são documentados via **JSDoc** (sem TypeScript).

---

## Arquitetura hexagonal

O serviço segue o padrão Ports and Adapters:

```
src/
  config/           env.js — validação zod de variáveis de ambiente
  shared/           logger.js, errors.js, telemetry.js
  domain/
    entities/       profile.js, match.js — objetos de domínio puros
    ports/
      inbound/      match-service.js — IMatchService (interface inbound)
      outbound/     match-repository.js, profile-repository.js,
                    event-publisher.js, user-state-repository.js
    use-cases/      create-match.js, create-profile.js, find-match.js,
                    swipe.js, get-suggestions.js
  application/
    services/       match-application-service.js — orquestra use cases
  adapters/
    inbound/
      http/
        routes/     match.routes.js, swipe.routes.js, suggestions.routes.js,
                    health.routes.js, metrics.routes.js
      messaging/    subscriber.js — 3 subscribers RabbitMQ
    outbound/
      db/           client.js, profile-repository.js, match-repository.js, migrator.js
      cache/        redis-client.js, user-state-repository.js
      messaging/    publisher.js
  migrations/       001_create_profile.js, 002_create_match_tb.js
  main.js           boot sequence
```

**Regra de dependência:** domínio não importa nada de `adapters/` ou `config/`.

---

## Banco de dados

Duas tabelas gerenciadas por migrations Kysely (`FileMigrationProvider`):

| Tabela | Colunas principais | Observação |
|---|---|---|
| `profile` | `id_profile` (VARCHAR PK), `name` (VARCHAR) | id_profile vem do serviço de origem (UUID string) |
| `match_tb` | `id_profile1`, `id_profile2` (PK composta), `data` (TIMESTAMPTZ) | Chamada `match_tb` para evitar conflito com keyword SQL |

Porta no host: **5434** (para não colidir com outros serviços locais).

---

## Redis — estado efêmero por usuário

O `UserStateRepository` usa sets Redis com TTL configurável (`REDIS_TTL`, padrão 86400s):

| Key | Conteúdo |
|---|---|
| `suggestions:{userId}` | Set de profileIds sugeridos (não vistos) |
| `seen:{userId}` | Set de profileIds já vistos/deslizados |
| `liked:{userId}` | Set de profileIds curtidos (like=true) |

`addSuggestionsExcludingSeen` usa `SDIFF` para filtrar vistos antes de inserir sugestões, tudo em um round-trip Redis.

`popSuggestions` usa `SPOP` — operação atômica que remove e retorna simultaneamente.

---

## Mensageria RabbitMQ

### Exchanges e filas consumidas

| Exchange | Tipo | Fila | Binding key | Evento tratado |
|---|---|---|---|---|
| `profile.events` | topic | `match-service.profile.profile` | `profile.profile.*` | `profile.profile.created` → salva; `.updated` / `.synced` → upsert |
| `match` | topic | `match-service.swipe.swipe` | `swipe.swipe.*` | `swipe.swipe.created` → lógica de match |
| `suggestion` | topic | `match-service.suggestion.suggestion` | `suggestion.suggestion.*` | carrega sugestões no Redis — publicado pelo **Discovery Engine** |

Todas as filas têm DLQ associada (exchange separado com sufixo `.dlq`). Mensagens com erro de parse ou processamento recebem `nack(false, false)` e vão para a DLQ.

### Eventos publicados

| Exchange | Routing key | Quem consome | Quando |
|---|---|---|---|
| `match` | `swipe.swipe.created` | match-service (si mesmo) | HTTP POST /swipes — SwipeUseCase publica e o subscriber consome |
| `match` | `match.match.created` | **Discovery Engine** | Quando match mútuo é detectado no subscriber de swipe |

**Padrão de swipe:** o endpoint HTTP publica o evento; o subscriber do mesmo serviço consome e executa a lógica de negócio (Redis + criação de match). Isso garante que o swipe é processado de forma assíncrona e resiliente.

**Relação com o Discovery Engine:** o Discovery Engine envia sugestões via `suggestion.suggestion.*` e consome `match.match.created` para fechar o ciclo — quando um match ocorre, o Discovery Engine pode parar de sugerir esses dois perfis entre si.

---

## HTTP — Endpoints

Todos os endpoints (exceto `/health`, `/metrics`, `/docs`) exigem o header `x-user-id`. Esse header é injetado pelo **API Gateway** após validar o JWT — o match-service não valida token, apenas lê o header.

| Método | Path | Header obrigatório | Descrição |
|---|---|---|---|
| GET | `/health` | — | Status de postgres, rabbitmq, redis |
| GET | `/metrics` | — | Prometheus metrics |
| GET | `/docs` | — | Swagger UI |
| GET | `/matches/:id_profile` | `x-user-id` | Lista matches de um perfil |
| POST | `/swipes` | `x-user-id` | Registra swipe `{ targetId: uuid, liked: boolean }` |
| GET | `/suggestions?count=N` | `x-user-id` | Retorna e remove N sugestões do Redis |

**Formato de erro padrão:**
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }
```

Erros disponíveis: `AppError`, `NotFoundError`, `ValidationError`, `UnauthorizedError`, `ConflictError` (todos em `src/shared/errors.js`).

---

## Boot sequence (main.js)

Ordem obrigatória — OTel deve ser o primeiro para que patches de instrumentação sejam aplicados antes de outros módulos carregarem:

1. `initTelemetry()` — OTel SDK
2. `import env` — valida variáveis com zod (encerra se inválido)
3. Sentry (se `SENTRY_DSN` presente)
4. Conecta PostgreSQL → executa `migrateToLatest()`
5. Conecta RabbitMQ → cria channel
6. Instancia `RabbitMQEventPublisher` e conecta ao channel
7. Registra subscriber de profiles
8. Conecta Redis
9. Instancia `MatchRepository`, `UserStateRepository`, `MatchApplicationService`
10. Registra subscriber de swipes
11. Registra subscriber de sugestões
12. Sobe servidor HTTP Fastify

Graceful shutdown em `SIGTERM`/`SIGINT`: fecha HTTP → RabbitMQ → Redis → DB → OTel.

---

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `PORT` | sim | Porta HTTP (padrão: 3000) |
| `DATABASE_URL` | sim | URL PostgreSQL (banco `match`, porta 5434) |
| `RABBITMQ_URL` | sim | URL amqp |
| `REDIS_URL` | sim | URL Redis |
| `REDIS_TTL` | não | TTL dos sets Redis em segundos (padrão: 86400) |
| `NODE_ENV` | sim | `development` \| `production` \| `test` |
| `LOG_LEVEL` | sim | `trace` \| `debug` \| `info` \| `warn` \| `error` \| `fatal` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | sim | URL base do collector OTLP (ex: `http://localhost:4318`) |
| `SENTRY_DSN` | não | DSN do Sentry |

Toda validação acontece em `src/config/env.js` usando Zod. `process.env` não é acessado fora desse arquivo.

---

## Padrões e convenções

- **JavaScript ESM puro** — sem TypeScript; todos os arquivos `.js` com `import`/`export`
- **JSDoc para tipos** — interfaces de port documentadas com `@interface`, `@function`, `@param`, `@returns`
- **Sem `findAll()`** — `MatchRepository` expõe `findByProfileId(id)`, não listagem global
- **`match_tb`** — nome da tabela SQL é `match_tb`; entidade de domínio e repositório se chamam `Match`/`MatchRepository`
- **Sem auth JWT real** — endpoints verificam presença do header `x-user-id`, não validam token
- **Scripts**: `npm start`, `npm run dev` (--watch), `npm test` (vitest), `npm run migrate`
- **Migrations** — arquivos `.js` em `src/migrations/` com exports `up` e `down`; executadas via `migrateToLatest()` no boot e via `npm run migrate`

---

## Infraestrutura local

```bash
# Subir dependências
docker-compose up -d

# Rodar migrations manualmente
npm run migrate

# Iniciar serviço
npm start

# Ou tudo de uma vez
./start.sh
```

Portas expostas:
- PostgreSQL: **5434** (host) → 5432 (container)
- RabbitMQ AMQP: **5672** | Management UI: **15672**
- Redis: **6379**
- HTTP: **3000** | Swagger: `http://localhost:3000/docs`
