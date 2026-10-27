#!/usr/bin/env bash
# FPMS HTTPS certificate renewal (AC-26). Run when the health page warns that the certificate expires within 30 days.
#
# The farm's certificate is either issued by the school/IT office (send them the CSR) or by Let's Encrypt (certbot).
#   1. bash scripts/backup/renew-certificate.sh csr  <host-name>        → makes a key and a request (CSR) to send to the issuer
#   2. bash scripts/backup/renew-certificate.sh install <cert.pem> <key.pem> <out.pfx> → bundles the issued certificate for Kestrel
#   3. bash scripts/backup/renew-certificate.sh check <out.pfx>         → shows the new expiry date
# Then set FPMS_CERT_PATH / FPMS_CERT_PASSWORD (or Kestrel__Certificates__Default__*) to the .pfx, restart the API, and open the site.
set -euo pipefail
cmd="${1:?csr | install | check}"; shift
case "$cmd" in
  csr)
    host="${1:?host name, for example fpms.farm.local}"
    openssl req -new -newkey rsa:2048 -nodes -keyout "$host.key.pem" -out "$host.csr" -subj "/CN=$host" -addext "subjectAltName=DNS:$host"
    chmod 600 "$host.key.pem"
    echo "send $host.csr to the issuer; keep $host.key.pem private (never in the repository)" ;;
  install)
    cert="${1:?issued certificate (pem)}"; key="${2:?private key (pem)}"; out="${3:?output .pfx}"
    openssl pkcs12 -export -in "$cert" -inkey "$key" -out "$out" -passout env:FPMS_CERT_PASSWORD
    echo "wrote $out" ;;
  check)
    pfx="${1:?.pfx file}"
    openssl pkcs12 -in "$pfx" -passin env:FPMS_CERT_PASSWORD -nokeys 2>/dev/null | openssl x509 -noout -subject -enddate ;;
  *) echo "unknown command: $cmd" >&2; exit 2 ;;
esac
