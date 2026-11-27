#!/bin/bash
# Instala o OpenWA (WhatsApp auto-hospedado) na VPS do SIS e liga o SIS a ele.
# - Roda em Docker, publicado só em 127.0.0.1:2785 (a internet não alcança).
# - Motor Baileys (leve, sem navegador).
# - Copia a chave de API do OpenWA para o backend/.env sem mostrá-la na tela.
# Uso na VPS:
#   cd /var/www/sis-amazonika && bash <(git fetch -q origin claude/project-thread-84d44r \
#     && git show FETCH_HEAD:scripts/instalar-openwa.sh)
set -euo pipefail

APP=/var/www/sis-amazonika
ENVF=$APP/backend/.env
DIR=/opt/openwa
IMAGE=ghcr.io/rmyndharis/openwa:latest
SESSION=sis

echo "== 1. Docker"
if ! command -v docker >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y -qq docker.io docker-compose-v2
  systemctl enable --now docker
fi
docker --version
docker compose version

echo "== 2. OpenWA em $DIR"
mkdir -p "$DIR"
cd "$DIR"

if [ ! -f .env ]; then
  cat > .env <<EOF
NODE_ENV=production
PORT=2785
ENGINE_TYPE=baileys
DATABASE_TYPE=sqlite
STORAGE_TYPE=local
LOG_LEVEL=info
WEBHOOK_SSRF_PROTECT=true
AUTO_START_SESSIONS=true
EOF
  chmod 600 .env
fi
# Religa a sessão do WhatsApp sozinho depois de reiniciar a VPS/container.
grep -q '^AUTO_START_SESSIONS=' .env || echo 'AUTO_START_SESSIONS=true' >> .env

USE_IMAGE=1
if ! docker pull -q "$IMAGE" >/dev/null 2>&1; then
  echo "    Imagem $IMAGE indisponível; vou compilar a partir do código-fonte."
  USE_IMAGE=0
fi

if [ "$USE_IMAGE" = 1 ]; then
  cat > docker-compose.yml <<EOF
services:
  openwa-api:
    image: $IMAGE
    container_name: openwa-api
    restart: unless-stopped
    env_file: .env
    ports:
      - "127.0.0.1:2785:2785"
    volumes:
      - openwa-data:/app/data
    mem_limit: 1g
volumes:
  openwa-data:
EOF
else
  if [ ! -d src ]; then
    git clone -q --depth 1 https://github.com/rmyndharis/OpenWA.git /tmp/openwa-src
    cp -a /tmp/openwa-src/. "$DIR"/
    rm -rf /tmp/openwa-src
  fi
fi

docker compose up -d openwa-api

echo "== 3. Aguardando o OpenWA responder"
for i in $(seq 1 60); do
  if curl -fsS -m 3 http://127.0.0.1:2785/api/health/ready >/dev/null 2>&1 \
     || curl -fsS -m 3 http://127.0.0.1:2785/api/health >/dev/null 2>&1; then
    echo "    OpenWA no ar."
    break
  fi
  sleep 3
  [ "$i" = 60 ] && { echo "PAROU: o OpenWA não respondeu. Veja: docker logs openwa-api --tail 50"; exit 1; }
done

KEY=$(docker exec openwa-api cat /app/data/.api-key 2>/dev/null || true)
if [ -z "$KEY" ]; then
  echo "PAROU: não encontrei a chave em /app/data/.api-key. Veja: docker logs openwa-api | grep -i key"
  exit 1
fi

echo "== 4. Ligando o SIS ao OpenWA (backend/.env, com backup)"
cp "$ENVF" "$ENVF.bak-openwa-$(date +%Y%m%d-%H%M%S)"
set_env() {
  local name="$1" value="$2"
  if grep -q "^${name}=" "$ENVF"; then
    sed -i "s|^${name}=.*|${name}=${value}|" "$ENVF"
  else
    printf '\n%s=%s\n' "$name" "$value" >> "$ENVF"
  fi
}
set_env WHATSAPP_ENABLED true
set_env OPENWA_URL http://127.0.0.1:2785
set_env OPENWA_API_KEY "$KEY"
set_env OPENWA_SESSION "$SESSION"
unset KEY

echo "== 5. Reiniciando a API do SIS"
pm2 restart sis-amazonika-api --update-env >/dev/null
sleep 3
pm2 status sis-amazonika-api | grep sis-amazonika-api || true

cat <<'EOF'

PRONTO. Falta ler o QR Code com o WhatsApp da empresa:
  No SIS: Demandas > WhatsApp > "Conectar WhatsApp". O QR Code aparece na tela;
  leia com o celular em WhatsApp > Aparelhos conectados. Depois clique em
  "Enviar teste para mim".
EOF
