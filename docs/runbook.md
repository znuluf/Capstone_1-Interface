# FPMS operations runbook (AC-26)

For the System Administrator of a farm server. It covers what runs, what is backed up and how often, how to restore, how to renew the HTTPS certificate, how to recover an account, how to release and roll back, and what each health alert means. The commands are in `scripts/backup/`; `docs/backup-restore.md` has the development (Docker) details.

## 1. What runs where

| Part | What it is | Notes |
| :---- | :---- | :---- |
| Database | SQL Server (Express on the farm PC), database `CapstoneDb` | Express stops accepting data at **10 GB**; the health page warns at 7 GB. Recovery model **FULL** (set by migration `Fpms_StepF_BackupRuns`). |
| API | `Capstone.Web.Host`, Kestrel on HTTPS | Runs as a service. Health endpoint `/health` (database check). One background worker runs inside it: the daily purge of request audit logs older than 12 months (permit-expiry reminders are produced when notifications are read, not by a worker). |
| Web app | Angular build served by the API (`wwwroot`) | Nothing else to host. |
| Backups | Scripts in `scripts/backup/`, scheduled | Windows: Task Scheduler (`windows/register-tasks.ps1`). Ubuntu: cron (`schedule/crontab.example`). |

Install, in order: SQL Server and `sqlcmd`; the API package with `ConnectionStrings:Default`, `App:ServerRootAddress` and `SystemAdmin:InitialPassword` set; run `dotnet Capstone.Migrator.dll` (creates or upgrades the database and seeds the System Administrator, reference data and roles); install the HTTPS certificate (section 5); register the backup schedule (section 3); sign in as `admin`, change the password, open **System health** and confirm it shows only the alerts you expect on a new install (no backups yet).

## 2. Health page and alerts

**System health** (System Administrator menu) shows version and build, database size, free disk, last successful run of every backup job, certificate expiry, server errors in the last 24 hours and the history of backup runs. Critical alerts also appear as a red banner for the System Administrator (with the details) and for every Owner (a short sentence asking them to tell you). The page refreshes every minute; the banner every 5 minutes.

| Alert | When it fires | What to do |
| :---- | :---- | :---- |
| `LOG_BACKUP` (critical) | No log backup in the last hour (should run every 30 minutes) | Check the scheduled task or cron job, the backup drive, and the failure message in the history table. Run `backup-log.sh` by hand. If no full backup exists the log backup cannot run: run a full backup first. |
| `FULL_BACKUP` (critical) | No full backup in 26 hours (should run daily) | Same checks. Run `backup.sh` by hand. |
| `RUN_FAILED_<job>` (critical) | The latest run of a job failed | The message is the SQL Server or script error. Typical causes: drive missing or full, SQL Server service account cannot write the folder. Fix, run the job once, confirm it shows OK. |
| `DISK_FREE` (critical) | Less than 15% of the database disk is free | Free space (old backups on the same disk, old log files) or move the data files. The database disk must never fill. |
| `DB_SIZE` (warning at 7 GB, critical at 9 GB) | Express limit is 10 GB | Plan the move to SQL Server Standard or archive. Check for log or audit bloat first. |
| `CERTIFICATE` (warning within 30 days, critical when expired) | HTTPS certificate expiry | Section 5. |
| `INTEGRITY_CHECK`, `OFFSITE_COPY` (warning) | Weekly job not run in 8 days | Run it by hand and check the schedule. |
| `ERRORS` (warning) | 25 or more server errors in 24 hours | Open **Security and error logs**, filter failures, find the repeating service and method. |

The health page reads `FpmsBackupRuns`, which the scripts fill. If the database itself is down you cannot reach the page; the `/health` endpoint and the Windows or cron job logs are then the signal.

## 3. Backup schedule

| Job | Script | When | What it does |
| :---- | :---- | :---- | :---- |
| Full backup | `backup.sh` / `fpms-jobs.ps1 -Job Full` | Daily 20:00 | `BACKUP DATABASE … CHECKSUM, COMPRESSION`, `RESTORE VERIFYONLY`, SHA-256 file. |
| Log backup | `backup-log.sh` / `-Job Log` | Every 30 minutes | `BACKUP LOG`. With the daily full backup this limits loss to 30 minutes. |
| Retention | `retention.sh` / `-Job Retention` | Daily 20:45 | Keeps every full backup of 14 days, Sundays for 12 weeks, the first of each month for 5 years (financial records, D-25). Logs: 14 days, never newer than the oldest full backup kept. |
| Integrity check | `integrity-check.sh` / `-Job Check` | Weekly, Sunday 21:00 | `DBCC CHECKDB`. Any output is a failure. |
| Off-site copy | `offsite-copy.sh` / `-Job Offsite` | Weekly, Sunday 22:00 | Newest full backup plus logs since, AES-256 encrypted, written to the off-site drive or synced folder, opened again to prove it works; keeps the last 8. |
| Restore test | `restore-test.sh` | After each release and quarterly | Section 4. |

Every run, good or bad, writes a row to `FpmsBackupRuns`. Keep the **off-site passphrase** somewhere other than the farm PC (the Owner's safe or password manager); without it an off-site copy cannot be opened.

## 4. Restore

Tell users the system is offline and stop the API first.

**Full backup only** (loses everything since that backup):

```bash
bash scripts/backup/restore.sh ~/FPMS-backups/<timestamp>
```

**Full backup plus the log chain** (loses at most the last 30 minutes), optionally to a point in time (for example just before a mistake):

```bash
bash scripts/backup/restore.sh ~/FPMS-backups/<timestamp> --logs ~/FPMS-backups/logs
bash scripts/backup/restore.sh ~/FPMS-backups/<timestamp> --logs ~/FPMS-backups/logs --stopat '2026-10-27 14:20:00'
```

The script restores the full backup with `NORECOVERY`, applies each log backup in order (skipping logs that do not belong to the chain), then recovers. `--stopat` is the SQL Server's local time. On Windows run the same statements with `sqlcmd` (see `docs/backup-restore.md`).

**Standby copy and timed restore test.** `restore-test.sh` restores the newest full backup and its logs into `CapstoneDb_RestoreTest` next to the live database, runs `DBCC CHECKDB` on it, drops it, and records a `RestoreTest` run with the time it took. That time is your real recovery time; write it in the maintenance log. A database restored this way can also be kept as a read-only standby for inspecting data as of a given moment: restore with `--stopat` into a different database name and leave it in place.

After a real restore: start the API, sign in as an Owner, open the dashboard, a batch, a report and the compliance records, run a full backup, and record the restore (date, backup used, who, result) in the maintenance log. Data entered after the last recoverable moment is re-entered from the paper log sheets.

If the whole PC is lost: install SQL Server and the API (section 1) on the replacement, copy the newest off-site copy, decrypt it (`openssl enc -d -aes-256-cbc -pbkdf2 -in <file> -pass env:FPMS_OFFSITE_PASSPHRASE | tar xz`, or 7-Zip on Windows), restore as above, and re-issue the certificate.

## 5. HTTPS certificate renewal

The health page shows the certificate's expiry when the server knows the certificate file (`FPMS_CERT_PATH` and `FPMS_CERT_PASSWORD`, or Kestrel's `Certificates:Default` settings, as environment variables). It warns 30 days before expiry.

1. `bash scripts/backup/renew-certificate.sh csr <host-name>` makes a private key and a request. Send the `.csr` to the issuer (school or IT office, or use certbot where the farm has a public name). Keep the key private and out of the repository.
2. When the issued certificate arrives: `FPMS_CERT_PASSWORD=… bash scripts/backup/renew-certificate.sh install cert.pem key.pem fpms.pfx`.
3. Check the date: `renew-certificate.sh check fpms.pfx`. Replace the file the API uses, restart the API, open the site from a tablet and confirm the padlock, then confirm the health page shows the new date.

Renew at least a week before expiry. An expired certificate stops browsers opening the system.

## 6. Account recovery (System Administrator)

Journey in `Capstone-Planning.md` (account recovery). The Owner contacts you in person or by phone. Verify identity through a second Farm Owner or the Owner's pre-agreed security question (D-24). Open **Account recovery**, choose the farm and the user, tick that identity was verified, unlock the account or issue a temporary password. The password is shown once; the Owner must set a new one at sign-in. The action appears in the security log. Never read or change farm records to do this.

There is no in-app recovery for the System Administrator account itself. Keep its password in a sealed note with the Farm Owner. If it is lost, the developer who maintains the system resets the password hash of the host `admin` user (no tenant) directly in `AbpUsers` with the API stopped; record that in the maintenance log. `SystemAdmin:InitialPassword` only sets the password when the account is first created.

## 7. Release and rollback

1. Announce the release window. Run `backup.sh` and `backup-log.sh`; confirm both show OK on the health page. Note the current version (health page).
2. Stop the API. Copy the current application folder aside (`FPMS-app-<version>`).
3. Install the new package. Run the migrator. It applies reviewed migrations only; read its output.
4. Start the API. Sign in as an Owner; check the dashboard, a batch, a log entry, a harvest and sale, a report. Sign in as a Technician and as the System Administrator.
5. Run `restore-test.sh`. Run a full backup. Record version, date, who, result.

**Rollback.** Do not assume a schema rollback is safe after production writes. Stop the API, restore the previous application folder, restore the backup taken in step 1 (full backup only, since logs after it belong to the new schema), start the API, run the checks in step 4, and tell the Owners that anything entered since the release must be re-entered from paper.
