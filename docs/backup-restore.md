# Backup and restore (D-22)

> The farm-server operations (daily full, 30-minute log backups, weekly integrity check and encrypted off-site copy, retention, restore with the log chain, health alerts) are in [runbook.md](runbook.md). This page keeps the development workflow and the manual Windows commands.

A backup is **the database** (`CapstoneDb`): a full SQL Server backup, verified with CHECKSUM. Since D-30 the system stores no files (compliance records are database rows with a reference number and the hard copy's location), so there is no document folder to copy.

`scripts/backup/backup.sh` writes it into one timestamped folder, with `SHA256SUMS` and a `manifest.txt`:

```
~/FPMS-backups/20261022-031500/
  CapstoneDb.bak
  SHA256SUMS
  manifest.txt
```

Backups made before D-30 also contain `documents.tgz`; `restore.sh` still accepts them and ignores that archive.

## Manual backup and restore rehearsal (SQL Server in Docker)

```bash
bash scripts/backup/backup.sh                 # → ~/FPMS-backups/<timestamp>/
bash scripts/backup/restore-check.sh          # rehearsal: restore into CapstoneDb_RestoreCheck and compare
# real restore over the live database (stop the API first):
bash scripts/backup/restore.sh ~/FPMS-backups/<timestamp>
```

`restore-check.sh` never touches the live database. It backs up, restores into `CapstoneDb_RestoreCheck`, then compares row counts for every FPMS table. It prints `RESTORE CHECK PASSED` when the copy is identical. This is the demonstration required before release (D-12, D-22).

## Farm server: daily and weekly schedule

| When | What | Where |
| :---- | :---- | :---- |
| Daily, after farm hours (for example 20:00) | Full database backup | External drive attached to the farm-office PC |
| Weekly | Copy the newest backup folder, encrypted (for example a password-protected 7-Zip archive or an encrypted USB drive) | Kept off-site by the Farm Owner |
| Before every update or migration | Manual backup | External drive |

Keep at least 14 daily and 8 weekly backups. Financial records must stay recoverable for 5 years (D-25), so keep one backup per month for 5 years.

### Ubuntu farm PC

Install `mssql-tools18` so that `sqlcmd` is available, then:

```bash
export FPMS_SQL_MODE=local MSSQL_SA_PASSWORD='<secret>'
bash scripts/backup/backup.sh /media/fpms-backup
```

Schedule it with `crontab -e`: `0 20 * * * cd /opt/fpms && FPMS_SQL_MODE=local ... bash scripts/backup/backup.sh /media/fpms-backup >> /var/log/fpms-backup.log 2>&1`. To restore, also set `FPMS_SQL_DATA_DIR=/var/opt/mssql/data`.

### Windows 11 farm PC (SQL Server Express)

SQL Server Express has no SQL Agent, so use Task Scheduler with a small PowerShell script (`C:\FPMS\backup.ps1`):

```powershell
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$dest  = "E:\FPMS-backups\$stamp"          # E: = external drive
New-Item -ItemType Directory -Path $dest | Out-Null
sqlcmd -S .\SQLEXPRESS -E -b -Q "BACKUP DATABASE [CapstoneDb] TO DISK = N'$dest\CapstoneDb.bak' WITH INIT, CHECKSUM"
sqlcmd -S .\SQLEXPRESS -E -b -Q "RESTORE VERIFYONLY FROM DISK = N'$dest\CapstoneDb.bak' WITH CHECKSUM"

Get-FileHash "$dest\*" -Algorithm SHA256 | Out-File "$dest\SHA256SUMS.txt"
```

Task Scheduler: daily at 20:00, "Run whether user is logged on or not", account with rights to SQL Server and the drive. The SQL Server service account needs write access to the backup folder.

Restore on Windows (stop the FPMS API site/service first):

```powershell
sqlcmd -S .\SQLEXPRESS -E -b -Q "ALTER DATABASE [CapstoneDb] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; RESTORE DATABASE [CapstoneDb] FROM DISK = N'E:\FPMS-backups\<stamp>\CapstoneDb.bak' WITH REPLACE, CHECKSUM; ALTER DATABASE [CapstoneDb] SET MULTI_USER"

```

## Restore procedure (any host)

1. Tell users the system is offline. Stop the FPMS API.
2. Choose the backup folder; check `SHA256SUMS` (the scripts do this automatically).
3. Restore the database from the chosen backup folder.
4. Start the API, sign in as a Farm Owner, open the dashboard, a batch, a report and the compliance records list.
5. Record the restore (date, backup used, who did it, result) in the farm's maintenance log. Data entered after that backup must be re-entered from paper (D-23 log sheets help here).

Do not assume a schema rollback is safe after production writes. To roll back an application update, restore the previous application package together with the backup taken just before the update (fpms.md Section 6, Release and rollback).
