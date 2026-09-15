#!/bin/bash

set -e

PROJECT="/Users/pliniopotyguara/Documents/amazonika-protocolo"
BACKEND="$PROJECT/backend"

echo
echo "=========================================="
echo "       SIS AMAZONIKA - AMBIENTE LOCAL"
echo "=========================================="
echo

# ---------------------------------------------------------
# VERIFICAÇÕES
# ---------------------------------------------------------

if [ ! -f "$BACKEND/.env" ]; then
  echo "ERRO: backend/.env não encontrado."
  exit 1
fi

if [ ! -f "$PROJECT/.env.local" ]; then
  echo "ERRO: .env.local do frontend não encontrado."
  exit 1
fi

# ---------------------------------------------------------
# LIMPEZA AO ENCERRAR
# ---------------------------------------------------------

cleanup() {
  echo
  echo "Encerrando SIS Amazonika..."

  if [ -n "${BACKEND_PID:-}" ]; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi

  if [ -n "${FRONTEND_PID:-}" ]; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi

  wait 2>/dev/null || true

  echo "SIS Amazonika encerrado."
}

trap cleanup EXIT INT TERM

# ---------------------------------------------------------
# BACKEND
# ---------------------------------------------------------

echo "Carregando configuração do backend..."

cd "$BACKEND"

set -a
source .env
set +a

echo "PORT=${PORT:-3333}"
echo "DATABASE_URL=${DATABASE_URL:+CARREGADA}"
echo "JWT_SECRET=${JWT_SECRET:+CARREGADO}"

echo
echo "Iniciando API..."

npm run dev &

BACKEND_PID=$!

# ---------------------------------------------------------
# AGUARDAR API
# ---------------------------------------------------------

echo "Aguardando API iniciar..."

API_OK=0

for i in {1..30}; do
  if curl -s -o /dev/null \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{}' \
    "http://localhost:${PORT:-3333}/auth/login"
  then
    API_OK=1
    break
  fi

  sleep 1
done

if [ "$API_OK" -ne 1 ]; then
  echo
  echo "ERRO: API não respondeu na porta ${PORT:-3333}."
  exit 1
fi

echo "API disponível em http://localhost:${PORT:-3333}"

# ---------------------------------------------------------
# FRONTEND
# ---------------------------------------------------------

echo
echo "Iniciando frontend..."

cd "$PROJECT"

npm run dev &

FRONTEND_PID=$!

# ---------------------------------------------------------
# AGUARDAR FRONTEND
# ---------------------------------------------------------

echo "Aguardando interface..."

FRONTEND_OK=0

for i in {1..30}; do
  if curl -s -o /dev/null "http://localhost:5173"; then
    FRONTEND_OK=1
    break
  fi

  sleep 1
done

if [ "$FRONTEND_OK" -ne 1 ]; then
  echo
  echo "ERRO: frontend não respondeu na porta 5173."
  exit 1
fi

echo
echo "=========================================="
echo "          SIS AMAZONIKA ONLINE"
echo "=========================================="
echo
echo "Sistema: http://localhost:5173"
echo "Login:   http://localhost:5173/login"
echo "API:     http://localhost:${PORT:-3333}"
echo
echo "Para encerrar tudo: CTRL+C"
echo

# macOS: abrir automaticamente o sistema
open "http://localhost:5173/login"

# Mantém o script ativo enquanto os servidores estiverem rodando
wait
