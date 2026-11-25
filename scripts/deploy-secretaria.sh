#!/bin/bash
# Deploy do perfil Secretária no SIS (produção, /var/www/sis-amazonika).
# Uso na VPS:
#   cd /var/www/sis-amazonika && git fetch origin claude/project-thread-84d44r \
#     && bash <(git show FETCH_HEAD:scripts/deploy-secretaria.sh)
# Faz backup do banco, .env e código em /root/sis-backups/<data>, atualiza,
# aplica a migration, gera os builds e reinicia a API. Restaura se falhar.
set -euo pipefail

APP=/var/www/sis-amazonika
BRANCH=claude/project-thread-84d44r
EXPECTED_HEAD=75e1ff5d1a6264258f187910a9df9d019ee298c8
EXPECTED_DIFF_MD5=075d761acd2d7fd4f9f76c2f9d0ccd73
TS=$(date +%Y%m%d-%H%M%S)
B=/root/sis-backups/$TS
UNTRACKED=(
  backend/prisma/migrations/20261011192957_add_billing_charge_pix_revision
  backend/prisma/migrations/20261012022905_add_manager_expenses
  backend/src/modules/standalone-proposals/standalone-upload-guard.ts
  src/pages/StandaloneProposalPublicPage.tsx
)

cd "$APP"
CURRENT_HEAD=$(git rev-parse HEAD)

if [ "$CURRENT_HEAD" = "$EXPECTED_HEAD" ]; then
  DIFF_MD5=$(git diff --binary HEAD | md5sum | cut -d' ' -f1)
  if [ "$DIFF_MD5" != "$EXPECTED_DIFF_MD5" ]; then
    echo "PAROU: o código do servidor mudou desde a cópia (md5 $DIFF_MD5). Nada foi alterado."
    exit 1
  fi
else
  echo "PAROU: HEAD inesperado ($CURRENT_HEAD). Nada foi alterado."
  exit 1
fi

echo "== 1. Backup em $B"
mkdir -p "$B/untracked"
sqlite3 backend/prisma/dev.db ".backup $B/dev.db"
[ "$(sqlite3 "$B/dev.db" 'PRAGMA integrity_check;')" = "ok" ] || { echo "PAROU: backup do banco com erro."; exit 1; }
cp backend/.env "$B/backend.env"
tar czf "$B/codigo.tgz" -C /var/www \
  --exclude='sis-amazonika/node_modules' \
  --exclude='sis-amazonika/backend/node_modules' \
  --exclude='sis-amazonika/backend/uploads' \
  --exclude='sis-amazonika/backend/private-storage' \
  sis-amazonika
COUNT_BEFORE=$(sqlite3 "$B/dev.db" 'select count(*) from FinancialTransaction;')
ls -lh "$B"

restore() {
  echo "!! ERRO: restaurando backup de $B"
  cd "$APP"
  git checkout -q -f finance-etapa-2c1-canonical-money-migration || true
  tar xzf "$B/codigo.tgz" -C /var/www
  cp "$B/dev.db" "$APP/backend/prisma/dev.db"
  (cd backend && npx prisma generate >/dev/null 2>&1 || true)
  pm2 restart sis-amazonika-api
  echo "!! Restaurado. Produção voltou ao estado anterior."
}

echo "== 2. Atualizando código"
for f in "${UNTRACKED[@]}"; do
  mkdir -p "$B/untracked/$(dirname "$f")"
  mv "$f" "$B/untracked/$f"
done
trap restore ERR
git fetch -q origin "$BRANCH"
git checkout -q -f -B "$BRANCH" FETCH_HEAD
git log --oneline -1

echo "== 3. Migration e build do backend"
cd backend
npx prisma migrate deploy
npx prisma generate
npx tsc -p .
test -f dist/src/modules/secretary/secretary.routes.js

echo "== 4. Build do frontend"
cd "$APP"
npm run build

echo "== 5. Reiniciando API"
pm2 restart sis-amazonika-api
sleep 5
curl -fsS 127.0.0.1:3333/health
echo
trap - ERR

echo "== 6. Conferência"
pm2 status sis-amazonika-api
echo "Sem token em /secretary/entries (esperado 401): $(curl -s -o /dev/null -w '%{http_code}' 127.0.0.1:3333/secretary/entries)"
echo "Site: $(curl -s -o /dev/null -w '%{http_code}' https://sis.amazonikaengenharia.com.br/)"
sqlite3 backend/prisma/dev.db "PRAGMA table_info(FinancialTransaction);" | grep -q proposalId && echo "Coluna proposalId: ok"
COUNT_AFTER=$(sqlite3 backend/prisma/dev.db 'select count(*) from FinancialTransaction;')
echo "Lançamentos antes/depois: $COUNT_BEFORE / $COUNT_AFTER"
echo "PRONTO. Backup em $B"
