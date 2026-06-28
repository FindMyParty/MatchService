# match-service

Microsserviço do ecossistema **FindMyParty** responsável por detectar e persistir matches entre perfis de usuários.

## Responsabilidades

- Mantém uma cópia local de perfis sincronizados via eventos RabbitMQ
- Gerencia o estado de swipe de cada usuário (sugestões, vistos, curtidos) em Redis
- Detecta matches mútuos e persiste no PostgreSQL
- Publica o evento `match.match.created` quando um match ocorre
- Expõe API HTTP para consulta de matches, swipes e sugestões

## Stack

- **Runtime:** Node.js ESM (`"type": "module"`)
- **HTTP:** Fastify 4
- **Banco de dados:** PostgreSQL 16 via Kysely
- **Cache:** Redis 7 via ioredis
- **Mensageria:** RabbitMQ 3.13 via amqplib
- **Validação:** Zod
- **Observabilidade:** OpenTelemetry (OTLP) + Sentry + Pino

## Pré-requisitos

- Node.js 20+
- Docker e Docker Compose

## Configuração

Copie o arquivo de exemplo e ajuste os valores:

```bash
cp .env.example .env
```

| Variável | Descrição |
|---|---|
| `PORT` | Porta HTTP (padrão: 3000) |
| `DATABASE_URL` | URL PostgreSQL (`postgresql://user:password@localhost:5434/match`) |
| `RABBITMQ_URL` | URL AMQP (`amqp://guest:guest@localhost:5672`) |
| `REDIS_URL` | URL Redis (`redis://localhost:6379`) |
| `REDIS_TTL` | TTL dos sets Redis em segundos (padrão: 86400) |
| `NODE_ENV` | `development` / `production` / `test` |
| `LOG_LEVEL` | `info` recomendado para produção |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | URL base do collector OpenTelemetry |
| `SENTRY_DSN` | (opcional) DSN do Sentry |

## Iniciando

```bash
# Sobe PostgreSQL, RabbitMQ e Redis, roda migrations e inicia o serviço
./start.sh
```

Ou passo a passo:

```bash
# 1. Subir dependências
docker-compose up -d

# 2. Instalar dependências Node
npm install

# 3. Rodar migrations
npm run migrate

# 4. Iniciar serviço
npm start
```

O serviço estará disponível em `http://localhost:3000`.  
Documentação Swagger: `http://localhost:3000/docs`

## Endpoints

Todos os endpoints (exceto `/health`, `/metrics` e `/docs`) exigem o header `x-user-id`, injetado pelo **API Gateway** após validar o JWT do usuário.

| Método | Path | Descrição |
|---|---|---|
| `GET` | `/health` | Verifica status de postgres, rabbitmq e redis |
| `GET` | `/metrics` | Métricas Prometheus |
| `GET` | `/docs` | Swagger UI |
| `GET` | `/matches/:id_profile` | Lista matches de um perfil |
| `POST` | `/swipes` | Registra um swipe |
| `GET` | `/suggestions?count=N` | Retorna e remove N sugestões do Redis |

### POST /swipes

```json
// Request headers
x-user-id: <uuid>

// Request body
{
  "targetId": "uuid-do-perfil-alvo",
  "liked": true
}

// Response 202
{}
```

### GET /matches/:id_profile

```json
// Response 200
{
  "data": [
    {
      "id_profile1": "uuid-a",
      "id_profile2": "uuid-b",
      "data": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### GET /suggestions?count=N

```json
// Response 200
{
  "data": ["uuid-1", "uuid-2", "uuid-3"]
}
```

**Formato de erro:**
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Descrição do erro" } }
```

## Eventos RabbitMQ

### Consumidos

| Exchange | Binding key | Publicado por | Ação |
|---|---|---|---|
| `profile.events` | `profile.profile.created` | ProfileService | Salva o perfil localmente |
| `profile.events` | `profile.profile.updated` / `.synced` | ProfileService | Atualiza o perfil local |
| `match` | `swipe.swipe.created` | match-service (si mesmo) | Processa swipe: atualiza Redis, cria match se mútuo |
| `suggestion` | `suggestion.suggestion.*` | **Discovery Engine** | Carrega sugestões no Redis (excluindo já vistos) |

### Publicados

| Exchange | Routing key | Consumido por | Quando |
|---|---|---|---|
| `match` | `swipe.swipe.created` | match-service (si mesmo) | Ao receber `POST /swipes` |
| `match` | `match.match.created` | **Discovery Engine** | Quando um match mútuo é detectado |

### Fluxo de swipe

```
POST /swipes
  └─► publica swipe.swipe.created no RabbitMQ
        └─► subscriber consome o evento
              ├─► adiciona targetId em seen:{requesterId}
              ├─► se liked=true: adiciona targetId em liked:{requesterId}
              └─► se mútuo (targetId já curtiu requesterId):
                    ├─► cria match em match_tb (PostgreSQL)
                    ├─► publica match.match.created
                    └─► limpa estado Redis (sugestões e likes)
```

## Banco de dados

Migrations gerenciadas pelo Kysely (`FileMigrationProvider`):

| Tabela | Descrição |
|---|---|
| `profile` | Cópia local de perfis (`id_profile` VARCHAR PK, `name` VARCHAR) |
| `match_tb` | Matches entre dois perfis (PK composta, FK para `profile`) |

> A tabela de match chama-se `match_tb` para evitar conflito com a keyword reservada `MATCH` no SQL.

## Redis

Estado efêmero por usuário com TTL configurável (`REDIS_TTL`):

| Key | Conteúdo |
|---|---|
| `suggestions:{userId}` | Perfis sugeridos ainda não vistos |
| `seen:{userId}` | Perfis já vistos/deslizados |
| `liked:{userId}` | Perfis curtidos (like=true) |

## Desenvolvimento

```bash
# Modo watch (reinicia ao salvar)
npm run dev

# Testes
npm test

# Migrations
npm run migrate
```

## Arquitetura

O serviço segue arquitetura hexagonal (Ports and Adapters):

```
src/
  config/         Validação de env (Zod)
  shared/         Logger, errors, telemetry
  domain/
    entities/     Objetos de domínio puros (Profile, Match)
    ports/        Interfaces inbound e outbound
    use-cases/    Lógica de negócio
  application/    MatchApplicationService (orquestra use cases)
  adapters/
    inbound/      HTTP routes + RabbitMQ subscribers
    outbound/     PostgreSQL repositories + Redis + RabbitMQ publisher
  migrations/     Scripts de migration Kysely
  main.js         Boot sequence
```
