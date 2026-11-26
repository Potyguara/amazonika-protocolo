#!/bin/bash
# Liga o agendador financeiro do SIS (cobranças, avisos por e-mail e baixa
# automática dos Pix pagos). O cron só "acorda" o SIS a cada 5 minutos; o que
# roda e em que horário é decidido pela aba Financeiro > Cobranças automáticas.
# Uso na VPS:
#   cd /var/www/sis-amazonika && bash scripts/instalar-cron-financeiro.sh
set -euo pipefail

APP=/var/www/sis-amazonika
ENV_FILE=$APP/backend/.env
TICK=/usr/local/bin/sis-financeiro-tick.sh
CRON=/etc/cron.d/sis-financeiro
LOG=/var/log/sis-financeiro-cron.log

# 1. Senha do cron (gerada aqui, nunca exibida).
if ! grep -q '^CRON_SECRET=.\+' "$ENV_FILE"; then
  cp "$ENV_FILE" "/root/sis-backups/env-antes-cron-$(date +%Y%m%d-%H%M%S)"
  echo "CRON_SECRET=$(openssl rand -hex 32)" >> "$ENV_FILE"
  echo "CRON_SECRET criado no .env. Reiniciando a API para ler a senha."
  pm2 restart sis-amazonika-api >/dev/null
  sleep 5
fi

# 2. Script chamado pelo cron (lê a senha do .env na hora).
cat > "$TICK" <<'SCRIPT'
#!/bin/bash
SECRET=$(grep '^CRON_SECRET=' /var/www/sis-amazonika/backend/.env | head -1 | cut -d= -f2- | tr -d '"'"'"'\r')
RESP=$(curl -sS -m 300 -X POST -H "x-cron-secret: $SECRET" http://127.0.0.1:3333/internal/cron/finance-scheduler-tick 2>&1)
echo "$(date '+%F %T') $RESP" | cut -c1-2000
SCRIPT
chmod 700 "$TICK"

# 3. Cron a cada 5 minutos.
echo "*/5 * * * * root $TICK >> $LOG 2>&1" > "$CRON"
chmod 644 "$CRON"
touch "$LOG"

# 4. Rotação simples do log (mantém 4 semanas).
cat > /etc/logrotate.d/sis-financeiro <<ROT
$LOG {
  weekly
  rotate 4
  compress
  missingok
  notifempty
}
ROT

echo "Cron instalado: $CRON"
DB=$APP/backend/prisma/dev.db
echo "Automação ligada na tela? $(sqlite3 "$DB" 'select case when enabled=1 then "SIM" else "NAO" end from FinanceAutoChargeSettings where id=1;' 2>/dev/null || echo 'NAO (ainda sem configuração)')"
echo "Lançamentos pendentes marcados para cobrança automática: $(sqlite3 "$DB" "select count(*) from FinancialTransaction where status='PENDENTE' and type in ('ENTRADA','PARCELA') and autoChargeEnabled=1;")"
echo "Primeira execução agora:"
"$TICK"
echo
echo "Acompanhar: tail -f $LOG"
