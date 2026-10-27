#!/usr/bin/env bash
# FPMS backup retention (AC-26). Run daily after the full backup.
#   bash scripts/backup/retention.sh [backup-root]
# Keeps: every full backup of the last 14 days; Sunday full backups for 12 weeks; the first full backup of each month for 5 years
# (financial records, D-25). Log backups: 14 days, and never newer than the oldest full backup that is kept.
# Off-site copies (offsite-copy.sh) keep their own last 8 copies. Nothing is deleted if there are fewer than 3 full backups.
set -euo pipefail
ROOT_DIR="${1:-${FPMS_BACKUP_ROOT:-$HOME/FPMS-backups}}"
TODAY_S="$(date +%s)"
age_days() { echo $(( (TODAY_S - $(date -d "${1:0:4}-${1:4:2}-${1:6:2}" +%s 2>/dev/null || date -j -f %Y%m%d "${1:0:8}" +%s)) / 86400 )); }

folders=( $(ls -d "$ROOT_DIR"/20[0-9][0-9][0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9][0-9][0-9] 2>/dev/null | sort) )
if [ "${#folders[@]}" -lt 3 ]; then echo "fewer than 3 full backups; nothing to delete"; exit 0; fi

seen_months=" "
removed=0
for f in "${folders[@]}"; do
  stamp="$(basename "$f")"; ymd="${stamp:0:8}"; month="${stamp:0:6}"
  first=0
  if [[ "$seen_months" != *" $month "* ]]; then seen_months="$seen_months$month "; first=1; fi
  age="$(age_days "$ymd")"
  dow="$(date -d "${ymd:0:4}-${ymd:4:2}-${ymd:6:2}" +%u 2>/dev/null || date -j -f %Y%m%d "$ymd" +%u)"
  keep=0
  [ "$age" -le 14 ] && keep=1
  [ "$dow" = 7 ] && [ "$age" -le 84 ] && keep=1
  [ "$first" = 1 ] && [ "$age" -le 1826 ] && keep=1
  if [ "$keep" = 0 ]; then rm -rf "$f"; removed=$((removed+1)); echo "removed $stamp"; fi
done

# Logs older than 14 days, but only those older than the oldest kept full backup.
oldest="$(ls -d "$ROOT_DIR"/20[0-9][0-9][0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9][0-9][0-9] | sort | head -1 | xargs basename)"
if [ -d "$ROOT_DIR/logs" ]; then
  while IFS= read -r t; do
    lstamp="$(basename "$t" .trn | sed 's/.*-\([0-9]\{8\}-[0-9]\{6\}\)$/\1/')"
    [ "$(age_days "${lstamp:0:8}")" -gt 14 ] && [[ "$lstamp" < "$oldest" ]] && rm -f "$t" && removed=$((removed+1))
  done < <(ls "$ROOT_DIR"/logs/*.trn 2>/dev/null)
fi
echo "retention done: $removed item(s) removed"
