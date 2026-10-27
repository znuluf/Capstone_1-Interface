#!/usr/bin/env bash
# FPMS weekly off-site copy (AC-26): the newest full backup plus the log backups since, as one AES-256 encrypted archive,
# copied to FPMS_OFFSITE_DIR (an external drive or a cloud-synced folder that the Farm Owner keeps off the farm).
#   FPMS_OFFSITE_DIR=/media/offsite FPMS_OFFSITE_PASSPHRASE='...' bash scripts/backup/offsite-copy.sh [backup-root]
# Decrypt: openssl enc -d -aes-256-cbc -pbkdf2 -in <file>.tgz.enc -pass env:FPMS_OFFSITE_PASSPHRASE | tar xz
# Keep the passphrase somewhere other than the farm PC, or the copy cannot be opened after a disaster.
set -euo pipefail
. "$(dirname "$0")/lib.sh"
DEST_ROOT="${1:-$BACKUP_ROOT}"
: "${FPMS_OFFSITE_DIR:?Set FPMS_OFFSITE_DIR}"
: "${FPMS_OFFSITE_PASSPHRASE:?Set FPMS_OFFSITE_PASSPHRASE}"
job_guard $KIND_OFFSITE

latest="$(ls -d "$DEST_ROOT"/20[0-9][0-9][0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9][0-9][0-9] | sort | tail -1)"
[ -n "$latest" ] || { echo "no full backup found"; false; }
stamp="$(basename "$latest")"
mkdir -p "$FPMS_OFFSITE_DIR"
OUT="$FPMS_OFFSITE_DIR/FPMS-offsite-$stamp.tgz.enc"
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/FPMS-offsite"
cp -R "$latest" "$WORK/FPMS-offsite/"
mkdir -p "$WORK/FPMS-offsite/logs"
if [ -d "$DEST_ROOT/logs" ]; then
  find "$DEST_ROOT/logs" -name '*.trn' -newer "$latest/$DB.bak" -exec cp {} "$WORK/FPMS-offsite/logs/" \;
fi
tar -C "$WORK" -cz FPMS-offsite | openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:FPMS_OFFSITE_PASSPHRASE -out "$OUT"
# Prove the copy opens before trusting it.
openssl enc -d -aes-256-cbc -pbkdf2 -in "$OUT" -pass env:FPMS_OFFSITE_PASSPHRASE | tar tz >/dev/null
ls -t "$FPMS_OFFSITE_DIR"/FPMS-offsite-*.tgz.enc | tail -n +9 | xargs -r rm -f
SIZE="$(file_size "$OUT")"
trap - ERR
record_run $KIND_OFFSITE "$JOB_STARTED" 1 "$(basename "$OUT")" "$SIZE" "encrypted, opened and listed after writing"
echo "off-site copy: $OUT"
