#!/bin/bash

set -Eeuo pipefail

# ============================================================
# SIS AMAZONIKA — INICIALIZAÇÃO COMPLETA
#
# Processos iniciados:
#   1. Backend Node/TypeScript
#   2. Frontend Vite/React
#   3. Cloudflare Tunnel do frontend: sis-amazonika
#   4. Cloudflare Tunnel da API: api-amazonika
#
# Uso:
#   ./scripts/start-sis-amazonika.sh
#
# Encerramento:
#   Ctrl+C
# ============================================================

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"

LOG_DIR="$PROJECT_ROOT/.devlogs"

BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"
SIS_TUNNEL_LOG="$LOG_DIR/sis-tunnel.log"
API_TUNNEL_LOG="$LOG_DIR/api-tunnel.log"

BACKEND_PORT="3333"
FRONTEND_PORT="5173"

BACKEND_LOCAL_URL="http://localhost:${BACKEND_PORT}"
FRONTEND_LOCAL_URL="http://localhost:${FRONTEND_PORT}"

BACKEND_PUBLIC_URL="https://api.amazonikaengenharia.com.br"
FRONTEND_PUBLIC_URL="https://sis.amazonikaengenharia.com.br"

SIS_TUNNEL_NAME="sis-amazonika"
API_TUNNEL_NAME="api-amazonika"

BACKEND_PID=""
FRONTEND_PID=""
SIS_TUNNEL_PID=""
API_TUNNEL_PID=""

SHUTTING_DOWN="false"

mkdir -p "$LOG_DIR"

# ============================================================
# UTILITÁRIOS
# ============================================================

print_separator() {
  echo "============================================================"
}

require_command() {
  local command_name="$1"

  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "ERRO: comando obrigatório não encontrado: $command_name"
    exit 1
  fi
}

is_process_running() {
  local pid="${1:-}"

  if [ -z "$pid" ]; then
    return 1
  fi

  kill -0 "$pid" 2>/dev/null
}

terminate_process() {
  local pid="${1:-}"
  local process_name="${2:-processo}"

  if [ -z "$pid" ]; then
    return 0
  fi

  if ! is_process_running "$pid"; then
    wait "$pid" 2>/dev/null || true
    return 0
  fi

  echo "Encerrando ${process_name} — PID ${pid}..."

  pkill -TERM -P "$pid" 2>/dev/null || true
  kill -TERM "$pid" 2>/dev/null || true

  local attempt=1

  while [ "$attempt" -le 10 ]; do
    if ! is_process_running "$pid"; then
      wait "$pid" 2>/dev/null || true
      return 0
    fi

    sleep 0.5
    attempt=$((attempt + 1))
  done

  echo "Forçando encerramento de ${process_name}..."

  pkill -KILL -P "$pid" 2>/dev/null || true
  kill -KILL "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
}

kill_processes_on_port() {
  local port="$1"
  local pids=""

  pids="$(
    lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true
  )"

  if [ -z "$pids" ]; then
    return 0
  fi

  echo "Encerrando processos antigos na porta ${port}..."

  while IFS= read -r pid; do
    if [ -n "$pid" ]; then
      kill -TERM "$pid" 2>/dev/null || true
    fi
  done <<< "$pids"

  sleep 1

  pids="$(
    lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true
  )"

  if [ -n "$pids" ]; then
    while IFS= read -r pid; do
      if [ -n "$pid" ]; then
        kill -KILL "$pid" 2>/dev/null || true
      fi
    done <<< "$pids"
  fi
}

wait_for_http() {
  local url="$1"
  local service_name="$2"
  local process_pid="$3"
  local log_file="$4"
  local max_attempts="${5:-60}"

  local attempt=1
  local http_code="000"

  while [ "$attempt" -le "$max_attempts" ]; do
    if ! is_process_running "$process_pid"; then
      echo
      echo "ERRO: ${service_name} foi encerrado durante a inicialização."
      echo "Últimas linhas do log:"
      tail -n 80 "$log_file" 2>/dev/null || true
      return 1
    fi

    http_code="$(
      curl \
        --silent \
        --location \
        --output /dev/null \
        --write-out "%{http_code}" \
        --connect-timeout 3 \
        --max-time 8 \
        "$url" 2>/dev/null || true
    )"

    if [[ "$http_code" =~ ^2[0-9][0-9]$ ]] ||
       [[ "$http_code" =~ ^3[0-9][0-9]$ ]]; then
      echo "${service_name} respondeu com HTTP ${http_code}."
      return 0
    fi

    printf "\rAguardando %s... tentativa %d/%d — HTTP %s" \
      "$service_name" \
      "$attempt" \
      "$max_attempts" \
      "$http_code"

    sleep 1
    attempt=$((attempt + 1))
  done

  echo
  echo
  echo "ERRO: ${service_name} não respondeu em:"
  echo "$url"
  echo
  echo "Último HTTP: ${http_code}"
  echo "Últimas linhas do log:"
  tail -n 80 "$log_file" 2>/dev/null || true

  return 1
}

wait_for_tunnel_connection() {
  local tunnel_name="$1"
  local tunnel_pid="$2"
  local log_file="$3"
  local max_attempts="${4:-60}"

  local attempt=1
  local registered_connections=0

  while [ "$attempt" -le "$max_attempts" ]; do
    if ! is_process_running "$tunnel_pid"; then
      echo
      echo "ERRO: o túnel ${tunnel_name} foi encerrado."
      echo "Últimas linhas do log:"
      tail -n 100 "$log_file" 2>/dev/null || true
      return 1
    fi

    registered_connections="$(
      grep -c "Registered tunnel connection" "$log_file" 2>/dev/null || true
    )"

    if [ "$registered_connections" -ge 1 ]; then
      echo \
        "Túnel ${tunnel_name} conectado — ${registered_connections} conexão(ões)."
      return 0
    fi

    printf "\rAguardando túnel %s... tentativa %d/%d" \
      "$tunnel_name" \
      "$attempt" \
      "$max_attempts"

    sleep 1
    attempt=$((attempt + 1))
  done

  echo
  echo
  echo "ERRO: o túnel ${tunnel_name} não registrou conexão."
  echo "Últimas linhas do log:"
  tail -n 100 "$log_file" 2>/dev/null || true

  return 1
}

wait_for_public_url() {
  local url="$1"
  local service_name="$2"
  local tunnel_pid="$3"
  local log_file="$4"
  local max_attempts="${5:-60}"

  local attempt=1
  local http_code="000"

  while [ "$attempt" -le "$max_attempts" ]; do
    if ! is_process_running "$tunnel_pid"; then
      echo
      echo "ERRO: o túnel de ${service_name} foi encerrado."
      echo "Últimas linhas do log:"
      tail -n 100 "$log_file" 2>/dev/null || true
      return 1
    fi

    http_code="$(
      curl \
        --silent \
        --location \
        --output /dev/null \
        --write-out "%{http_code}" \
        --connect-timeout 5 \
        --max-time 12 \
        "$url" 2>/dev/null || true
    )"

    if [[ "$http_code" =~ ^2[0-9][0-9]$ ]] ||
       [[ "$http_code" =~ ^3[0-9][0-9]$ ]]; then
      echo "${service_name} público respondeu com HTTP ${http_code}."
      return 0
    fi

    printf "\rAguardando %s público... tentativa %d/%d — HTTP %s" \
      "$service_name" \
      "$attempt" \
      "$max_attempts" \
      "$http_code"

    sleep 2
    attempt=$((attempt + 1))
  done

  echo
  echo
  echo "ERRO: ${service_name} público não respondeu."
  echo "URL: ${url}"
  echo "Último HTTP: ${http_code}"
  echo
  echo "Últimas linhas do túnel:"
  tail -n 100 "$log_file" 2>/dev/null || true

  return 1
}

validate_cors() {
  local cors_headers=""
  local allowed_origin=""

  cors_headers="$(
    curl \
      --silent \
      --include \
      --request OPTIONS \
      "${BACKEND_PUBLIC_URL}/auth/login" \
      --header "Origin: ${FRONTEND_PUBLIC_URL}" \
      --header "Access-Control-Request-Method: POST" \
      --header "Access-Control-Request-Headers: Content-Type,Authorization" \
      --connect-timeout 5 \
      --max-time 15 \
      2>/dev/null || true
  )"

  allowed_origin="$(
    printf "%s" "$cors_headers" |
      grep -i '^access-control-allow-origin:' |
      tail -n 1 |
      sed -E 's/^[^:]+:[[:space:]]*//' |
      tr -d '\r' ||
      true
  )"

  if [ "$allowed_origin" = "$FRONTEND_PUBLIC_URL" ]; then
    echo "CORS validado:"
    echo "Access-Control-Allow-Origin: ${allowed_origin}"
    return 0
  fi

  echo
  echo "AVISO: o CORS não retornou a origem pública esperada."
  echo "Esperado: ${FRONTEND_PUBLIC_URL}"
  echo "Recebido: ${allowed_origin:-nenhum cabeçalho}"
  echo
  echo "Resposta OPTIONS:"
  printf "%s\n" "$cors_headers"

  return 1
}

cleanup() {
  local exit_code=$?

  if [ "$SHUTTING_DOWN" = "true" ]; then
    exit "$exit_code"
  fi

  SHUTTING_DOWN="true"

  trap - EXIT INT TERM HUP

  echo
  print_separator
  echo "ENCERRANDO SIS AMAZONIKA"
  print_separator
  echo

  terminate_process "$API_TUNNEL_PID" "túnel api-amazonika"
  terminate_process "$SIS_TUNNEL_PID" "túnel sis-amazonika"
  terminate_process "$FRONTEND_PID" "frontend"
  terminate_process "$BACKEND_PID" "backend"

  kill_processes_on_port "$FRONTEND_PORT"
  kill_processes_on_port "$BACKEND_PORT"

  echo
  echo "Todos os processos foram encerrados."

  exit "$exit_code"
}

trap cleanup EXIT INT TERM HUP

# ============================================================
# INICIALIZAÇÃO DO BACKEND
# ============================================================

start_backend() {
  echo
  print_separator
  echo "1/4 — INICIANDO BACKEND"
  print_separator

  : > "$BACKEND_LOG"

  kill_processes_on_port "$BACKEND_PORT"

  (
    cd "$BACKEND_DIR"

    unset FRONTEND_URL
    unset BACKEND_PUBLIC_URL
    unset PUBLIC_APP_URL

    exec npm run dev
  ) > "$BACKEND_LOG" 2>&1 &

  BACKEND_PID=$!

  echo "PID do backend: ${BACKEND_PID}"
  echo "Log: ${BACKEND_LOG}"

  wait_for_http \
    "${BACKEND_LOCAL_URL}/health" \
    "Backend" \
    "$BACKEND_PID" \
    "$BACKEND_LOG" \
    60
}

# ============================================================
# INICIALIZAÇÃO DO FRONTEND
# ============================================================

start_frontend() {
  echo
  print_separator
  echo "2/4 — INICIANDO FRONTEND"
  print_separator

  : > "$FRONTEND_LOG"

  kill_processes_on_port "$FRONTEND_PORT"

  (
    cd "$PROJECT_ROOT"
    exec npm run dev -- --host 0.0.0.0
  ) > "$FRONTEND_LOG" 2>&1 &

  FRONTEND_PID=$!

  echo "PID do frontend: ${FRONTEND_PID}"
  echo "Log: ${FRONTEND_LOG}"

  wait_for_http \
    "$FRONTEND_LOCAL_URL" \
    "Frontend" \
    "$FRONTEND_PID" \
    "$FRONTEND_LOG" \
    60
}

# ============================================================
# INICIALIZAÇÃO DO TÚNEL DO FRONTEND
# ============================================================

start_sis_tunnel() {
  echo
  print_separator
  echo "3/4 — INICIANDO TÚNEL DO FRONTEND"
  print_separator

  : > "$SIS_TUNNEL_LOG"

  (
    cd "$PROJECT_ROOT"
    exec cloudflared tunnel run "$SIS_TUNNEL_NAME"
  ) > "$SIS_TUNNEL_LOG" 2>&1 &

  SIS_TUNNEL_PID=$!

  echo "Túnel: ${SIS_TUNNEL_NAME}"
  echo "PID: ${SIS_TUNNEL_PID}"
  echo "Log: ${SIS_TUNNEL_LOG}"

  wait_for_tunnel_connection \
    "$SIS_TUNNEL_NAME" \
    "$SIS_TUNNEL_PID" \
    "$SIS_TUNNEL_LOG" \
    60
}

# ============================================================
# INICIALIZAÇÃO DO TÚNEL DA API
# ============================================================

start_api_tunnel() {
  echo
  print_separator
  echo "4/4 — INICIANDO TÚNEL DA API"
  print_separator

  : > "$API_TUNNEL_LOG"

  (
    cd "$PROJECT_ROOT"
    exec cloudflared tunnel run "$API_TUNNEL_NAME"
  ) > "$API_TUNNEL_LOG" 2>&1 &

  API_TUNNEL_PID=$!

  echo "Túnel: ${API_TUNNEL_NAME}"
  echo "PID: ${API_TUNNEL_PID}"
  echo "Log: ${API_TUNNEL_LOG}"

  wait_for_tunnel_connection \
    "$API_TUNNEL_NAME" \
    "$API_TUNNEL_PID" \
    "$API_TUNNEL_LOG" \
    60
}

# ============================================================
# MONITORAMENTO DOS PROCESSOS
# ============================================================

monitor_processes() {
  while true; do
    sleep 5

    if ! is_process_running "$BACKEND_PID"; then
      echo
      echo "ERRO: o backend foi encerrado inesperadamente."
      echo "Log: ${BACKEND_LOG}"
      tail -n 100 "$BACKEND_LOG" 2>/dev/null || true
      return 1
    fi

    if ! is_process_running "$FRONTEND_PID"; then
      echo
      echo "ERRO: o frontend foi encerrado inesperadamente."
      echo "Log: ${FRONTEND_LOG}"
      tail -n 100 "$FRONTEND_LOG" 2>/dev/null || true
      return 1
    fi

    if ! is_process_running "$SIS_TUNNEL_PID"; then
      echo
      echo "ERRO: o túnel ${SIS_TUNNEL_NAME} foi encerrado."
      echo "Log: ${SIS_TUNNEL_LOG}"
      tail -n 100 "$SIS_TUNNEL_LOG" 2>/dev/null || true
      return 1
    fi

    if ! is_process_running "$API_TUNNEL_PID"; then
      echo
      echo "ERRO: o túnel ${API_TUNNEL_NAME} foi encerrado."
      echo "Log: ${API_TUNNEL_LOG}"
      tail -n 100 "$API_TUNNEL_LOG" 2>/dev/null || true
      return 1
    fi
  done
}

# ============================================================
# VERIFICAÇÕES INICIAIS
# ============================================================

require_command npm
require_command curl
require_command cloudflared
require_command lsof
require_command pkill
require_command grep
require_command sed

if [ ! -d "$BACKEND_DIR" ]; then
  echo "ERRO: diretório do backend não encontrado:"
  echo "$BACKEND_DIR"
  exit 1
fi

if [ ! -f "$PROJECT_ROOT/package.json" ]; then
  echo "ERRO: package.json do frontend não encontrado:"
  echo "$PROJECT_ROOT/package.json"
  exit 1
fi

if [ ! -f "$BACKEND_DIR/package.json" ]; then
  echo "ERRO: package.json do backend não encontrado:"
  echo "$BACKEND_DIR/package.json"
  exit 1
fi

# ============================================================
# EXECUÇÃO
# ============================================================

clear

print_separator
echo "              SIS AMAZONIKA"
echo "        INICIALIZAÇÃO COMPLETA"
print_separator

echo
echo "Projeto:"
echo "$PROJECT_ROOT"

echo
echo "Frontend público:"
echo "$FRONTEND_PUBLIC_URL"

echo
echo "API pública:"
echo "$BACKEND_PUBLIC_URL"

start_backend
start_frontend
start_sis_tunnel
start_api_tunnel

echo
print_separator
echo "VALIDANDO ENDEREÇOS PÚBLICOS"
print_separator

wait_for_public_url \
  "${BACKEND_PUBLIC_URL}/health" \
  "API" \
  "$API_TUNNEL_PID" \
  "$API_TUNNEL_LOG" \
  60

wait_for_public_url \
  "$FRONTEND_PUBLIC_URL" \
  "Frontend" \
  "$SIS_TUNNEL_PID" \
  "$SIS_TUNNEL_LOG" \
  60

echo
print_separator
echo "VALIDANDO CORS"
print_separator

validate_cors || true

echo
print_separator
echo "        SIS AMAZONIKA DISPONÍVEL"
print_separator

echo
echo "Frontend local:"
echo "$FRONTEND_LOCAL_URL"

echo
echo "Backend local:"
echo "$BACKEND_LOCAL_URL"

echo
echo "Frontend público:"
echo "$FRONTEND_PUBLIC_URL"

echo
echo "API pública:"
echo "$BACKEND_PUBLIC_URL"

echo
echo "Health da API:"
echo "${BACKEND_PUBLIC_URL}/health"

echo
echo "Processos:"
echo "Backend:                PID ${BACKEND_PID}"
echo "Frontend:               PID ${FRONTEND_PID}"
echo "Túnel sis-amazonika:    PID ${SIS_TUNNEL_PID}"
echo "Túnel api-amazonika:    PID ${API_TUNNEL_PID}"

echo
echo "Logs:"
echo "$LOG_DIR"

echo
echo "Pressione Ctrl+C para encerrar os quatro processos."
echo

if command -v open >/dev/null 2>&1; then
  open "$FRONTEND_PUBLIC_URL" >/dev/null 2>&1 || true
fi

monitor_processes