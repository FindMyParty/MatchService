#!/usr/bin/env bash
# start.sh — inicializa todas as dependências e sobe o match-service
#
# Uso:
#   ./start.sh                  # Postgres + RabbitMQ
#   ./start.sh --observability  # inclui OTel Collector, Prometheus, Grafana, Loki, Tempo

set -euo pipefail

OBSERVABILITY=false
for arg in "$@"; do
  [[ "$arg" == "--observability" ]] && OBSERVABILITY=true
done

# ── Cores ──────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ── Pré-requisitos ─────────────────────────────────────────────────────────────
info "Verificando pré-requisitos..."

if ! command -v node &>/dev/null; then
  error "Node.js não encontrado. Instale em https://nodejs.org (versão 22+)"
  exit 1
fi

NODE_VERSION=$(node --version | sed 's/v//' | cut -d. -f1)
if [[ "$NODE_VERSION" -lt 22 ]]; then
  error "Node.js 22+ é obrigatório. Versão atual: $(node --version)"
  exit 1
fi
success "Node.js $(node --version)"

if ! command -v docker &>/dev/null; then
  error "Docker não encontrado. Instale o Docker Desktop em https://www.docker.com/products/docker-desktop"
  exit 1
fi

if ! docker info &>/dev/null; then
  warn "Docker Desktop não está em execução. Tentando iniciar..."

  DOCKER_DESKTOP_PATHS=(
    "/c/Program Files/Docker/Docker/Docker Desktop.exe"
    "/mnt/c/Program Files/Docker/Docker/Docker Desktop.exe"
  )

  STARTED=false
  for path in "${DOCKER_DESKTOP_PATHS[@]}"; do
    if [[ -f "$path" ]]; then
      "$path" &>/dev/null &
      STARTED=true
      break
    fi
  done

  if [[ "$STARTED" == false ]]; then
    # Fallback via cmd.exe (funciona no Git Bash e WSL)
    if command -v cmd.exe &>/dev/null; then
      cmd.exe /c start "" "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe" &>/dev/null &
      STARTED=true
    fi
  fi

  if [[ "$STARTED" == false ]]; then
    error "Não foi possível localizar o Docker Desktop. Inicie-o manualmente e rode o script novamente."
    exit 1
  fi

  info "Aguardando Docker Desktop inicializar (pode levar até 60 segundos)..."
  RETRIES=60
  until docker info &>/dev/null; do
    RETRIES=$((RETRIES - 1))
    if [[ "$RETRIES" -le 0 ]]; then
      error "Docker Desktop não ficou pronto a tempo. Verifique se ele iniciou corretamente."
      exit 1
    fi
    sleep 2
  done
fi

success "Docker $(docker --version | awk '{print $3}' | tr -d ',')"

# ── Diretório do script ────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Variáveis de ambiente ──────────────────────────────────────────────────────
if [[ ! -f ".env" ]]; then
  warn ".env não encontrado — copiando de .env.example"
  cp .env.example .env
  success ".env criado. Revise as variáveis se necessário."
else
  success ".env encontrado"
fi

# ── Dependências npm ───────────────────────────────────────────────────────────
if [[ ! -d "node_modules" ]]; then
  info "Instalando dependências npm..."
  npm install
  success "Dependências instaladas"
else
  success "node_modules já existe"
fi

# ── RabbitMQ: verifica se já está up ──────────────────────────────────────────
rabbitmq_is_up() {
  curl -sf -u guest:guest http://localhost:15672/api/healthchecks/node &>/dev/null
}

# ── Docker Compose ─────────────────────────────────────────────────────────────
COMPOSE_FILES="-f docker-compose.yml"
if [[ "$OBSERVABILITY" == true ]]; then
  COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.observability.yml"
  info "Subindo infraestrutura completa (Postgres + RabbitMQ + Observabilidade)..."
else
  info "Subindo infraestrutura base (Postgres + RabbitMQ)..."
fi

if rabbitmq_is_up; then
  warn "RabbitMQ já está rodando em :5672 — pulando container"
  docker compose $COMPOSE_FILES up -d --no-deps postgres
else
  docker compose $COMPOSE_FILES up -d
fi

# ── Aguardar Postgres ──────────────────────────────────────────────────────────
info "Aguardando PostgreSQL ficar saudável..."
RETRIES=30
until docker compose exec -T postgres pg_isready -U user -d match &>/dev/null; do
  RETRIES=$((RETRIES - 1))
  if [[ "$RETRIES" -le 0 ]]; then
    error "PostgreSQL não ficou saudável a tempo."
    docker compose logs postgres
    exit 1
  fi
  sleep 1
done
success "PostgreSQL pronto"

# ── Aguardar RabbitMQ ──────────────────────────────────────────────────────────
info "Aguardando RabbitMQ ficar saudável..."
RETRIES=30
until rabbitmq_is_up; do
  RETRIES=$((RETRIES - 1))
  if [[ "$RETRIES" -le 0 ]]; then
    error "RabbitMQ não ficou saudável a tempo."
    exit 1
  fi
  sleep 2
done
success "RabbitMQ pronto"

# ── Resumo de acesso ───────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Infraestrutura pronta!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  PostgreSQL     →  localhost:5434"
echo -e "  RabbitMQ AMQP  →  localhost:5672"
echo -e "  RabbitMQ UI    →  http://localhost:15672  (guest/guest)"
if [[ "$OBSERVABILITY" == true ]]; then
  echo -e "  OTel Collector →  localhost:4317 (gRPC) / 4318 (HTTP)"
  echo -e "  Prometheus     →  http://localhost:9090"
  echo -e "  Grafana        →  http://localhost:3001"
  echo -e "  Loki           →  http://localhost:3100"
  echo -e "  Tempo          →  http://localhost:3200"
fi
echo -e "  Swagger UI     →  http://localhost:3000/docs"

# ── Iniciar serviço ────────────────────────────────────────────────────────────
echo ""
info "Iniciando match-service em http://localhost:3000 ..."
echo ""
node --env-file=.env src/main.js
