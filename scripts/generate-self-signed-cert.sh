#!/usr/bin/env bash
set -euo pipefail

CERT_DIR="${1:-./certs}" # Allow overriding output directory
DOMAIN="${2:-localhost}"
DAYS_VALID="${3:-365}"

mkdir -p "$CERT_DIR"

CRT="$CERT_DIR/chat2anyllm.crt"
KEY="$CERT_DIR/chat2anyllm.key"
CSR="$CERT_DIR/chat2anyllm.csr"
OPENSSL_CONF="$CERT_DIR/openssl.cnf"

if [[ -f "$CRT" && -f "$KEY" ]]; then
  echo "[INFO] Certificate already exists in $CERT_DIR (remove to regenerate)."
  exit 0
fi

cat > "$OPENSSL_CONF" <<EOF
[ req ]
default_bits       = 4096
distinguished_name = req_distinguished_name
req_extensions     = v3_req
prompt             = no

[ req_distinguished_name ]
C  = US
ST = CA
L  = DevCity
O  = Chat2AnyLLM
OU = Dev
CN = $DOMAIN

[ v3_req ]
subjectAltName = @alt_names

[ alt_names ]
DNS.1 = $DOMAIN
DNS.2 = localhost
IP.1  = 127.0.0.1
EOF

echo "[INFO] Generating key..."
openssl genrsa -out "$KEY" 4096 >/dev/null 2>&1
echo "[INFO] Generating CSR..."
openssl req -new -key "$KEY" -out "$CSR" -config "$OPENSSL_CONF" >/dev/null 2>&1
echo "[INFO] Self-signing certificate valid for $DAYS_VALID days..."
openssl x509 -req -in "$CSR" -signkey "$KEY" -out "$CRT" -days "$DAYS_VALID" -extensions v3_req -extfile "$OPENSSL_CONF" >/dev/null 2>&1

echo "[INFO] Created certificate: $CRT"
echo "[INFO] Created key: $KEY"
echo "[HINT] To trust locally (macOS): sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain $CRT"
echo "[HINT] For Chrome/Linux, import via chrome://settings/certificates (Authorities)."