#!/bin/bash
# Monta a cadeia completa (empresa + intermediárias + raiz) do certificado
# e-CNPJ para enviar ao BB Developers. Só usa a parte PÚBLICA.
# Uso na VPS:
#   cd /var/www/sis-amazonika && git fetch -q origin claude/project-thread-84d44r \
#     && git show FETCH_HEAD:scripts/bb-cert-chain.sh | bash
# Resultado: /root/bb-certs/cadeia-completa.pem
set -euo pipefail

DIR=/root/bb-certs
SRC=$DIR/cert.pem
OUT=$DIR/cadeia-completa.pem
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

[ -f "$SRC" ] || { echo "PAROU: $SRC não existe."; exit 1; }

# Primeiro certificado do arquivo (o da empresa), sem linhas extras.
awk '/BEGIN CERT/{f=1} f{print} /END CERT/{exit}' "$SRC" > "$TMP/c0.pem"
cp "$TMP/c0.pem" "$OUT.tmp"
cur="$TMP/c0.pem"

for i in 1 2 3 4 5 6; do
  subj=$(openssl x509 -in "$cur" -noout -subject -nameopt RFC2253)
  iss=$(openssl x509 -in "$cur" -noout -issuer -nameopt RFC2253)
  echo "[$((i-1))] ${subj#subject=}"
  if [ "${subj#subject=}" = "${iss#issuer=}" ]; then
    echo "    (raiz encontrada)"
    break
  fi

  url=$(openssl x509 -in "$cur" -noout -ext authorityInfoAccess 2>/dev/null \
    | grep -o 'CA Issuers - URI:[^ ,]*' | head -1 | sed 's/CA Issuers - URI://')
  if [ -z "$url" ]; then
    echo "PAROU: o certificado não informa onde baixar o emissor (${iss#issuer=})."
    exit 1
  fi

  echo "    baixando emissor de $url"
  curl -fsSL --max-time 30 "$url" -o "$TMP/raw$i"

  # O emissor pode vir como X.509 (DER ou PEM) ou como pacote PKCS#7 (.p7b/.p7c).
  if openssl x509 -inform DER -in "$TMP/raw$i" -out "$TMP/c$i.pem" 2>/dev/null \
     || openssl x509 -in "$TMP/raw$i" -out "$TMP/c$i.pem" 2>/dev/null; then
    cat "$TMP/c$i.pem" >> "$OUT.tmp"
    cur="$TMP/c$i.pem"
  elif openssl pkcs7 -inform DER -in "$TMP/raw$i" -print_certs -out "$TMP/p$i.pem" 2>/dev/null \
     || openssl pkcs7 -in "$TMP/raw$i" -print_certs -out "$TMP/p$i.pem" 2>/dev/null; then
    # Pacote com vários certificados: acrescenta todos e encerra.
    awk '/BEGIN CERT/,/END CERT/' "$TMP/p$i.pem" > "$TMP/p$i.clean"
    cat "$TMP/p$i.clean" >> "$OUT.tmp"
    openssl crl2pkcs7 -nocrl -certfile "$TMP/p$i.clean" \
      | openssl pkcs7 -print_certs -noout | grep '^subject' | sed 's/^/    /'
    break
  else
    echo "PAROU: não consegui ler o arquivo baixado de $url."
    exit 1
  fi
done

# Remove certificados repetidos, mantendo a ordem.
awk '/BEGIN CERT/{buf=""} {buf=buf $0 "\n"} /END CERT/{if(!seen[buf]++) printf "%s", buf}' "$OUT.tmp" > "$OUT"
rm -f "$OUT.tmp"
chmod 644 "$OUT"

echo
echo "Certificados na cadeia: $(grep -c 'BEGIN CERT' "$OUT")"
echo "PRONTO: $OUT (só parte pública; pode enviar ao BB)"
