#!/usr/bin/env bash
# Prints where the app is and how to sign in. Runs when you open the Codespace; run it again any time.
# The database the last start used; before the first start, the one it will use.
DB="$(cat /tmp/fpms-current-db 2>/dev/null || true)"
if [ -z "$DB" ]; then DB="FPMS_Sample"; [ "${SEED_SAMPLE_DATA:-1}" = "0" ] && DB="FPMS"; fi
if [ -n "${CODESPACE_NAME:-}" ]; then
  WEB_URL="https://${CODESPACE_NAME}-4200.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
else
  WEB_URL="http://localhost:4200"
fi

cat <<TEXT

Farm.Shrimp.io (FPMS)   database: ${DB}
App:   ${WEB_URL}   (Ports tab: "Angular app"; the servers take a minute or two after a start)

System Administrator: farm code blank, user admin, password = ADMIN_INITIAL_PASSWORD secret
                      (or ADMIN_PASSWORD in .devcontainer/local.env)
TEXT

if [ "$DB" = "FPMS_Sample" ]; then
cat <<'TEXT'
Sample farms (every password Fpms@2026):

  Farm code          User          Role              Farm
  gensan-semi        owner         Farm Owner        Semi-intensive, earthen; Apr-Sep 2026
  gensan-semi        tech1, tech2  Farm Technician
  KIAMBA-INTENSIVE   rsantos       Farm Owner        Intensive, HDPE-lined; Nov 2025-Oct 2026
  KIAMBA-INTENSIVE   mreyes        Farm Technician
  KIAMBA-INTENSIVE   agarcia       Farm Technician
  KIAMBA-INTENSIVE   bvillanueva   (deactivated)

Reset the sample data:  bash .devcontainer/reset-data.sh
Clean database instead: SEED_SAMPLE_DATA=0 bash .devcontainer/start-fpms.sh
More: docs/dev-accounts.md
TEXT
else
cat <<'TEXT'
Clean database: register a farm on the sign-in page.
Sample data instead: SEED_SAMPLE_DATA=1 bash .devcontainer/start-fpms.sh
TEXT
fi
