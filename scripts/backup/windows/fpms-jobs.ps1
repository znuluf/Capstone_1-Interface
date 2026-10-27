<#
FPMS backup jobs for the Windows farm PC (SQL Server Express, AC-26). One script, one job per call:

  powershell -File fpms-jobs.ps1 -Job Full      # daily
  powershell -File fpms-jobs.ps1 -Job Log       # every 30 minutes
  powershell -File fpms-jobs.ps1 -Job Check     # weekly (DBCC CHECKDB)
  powershell -File fpms-jobs.ps1 -Job Offsite   # weekly, needs 7-Zip and $env:FPMS_OFFSITE_PASSPHRASE / -OffsiteDir
  powershell -File fpms-jobs.ps1 -Job Retention # daily, after Full

Every run writes a row into FpmsBackupRuns (the System Administrator health page and the alerts read it).
The SQL Server service account needs write access to -BackupRoot. Register the schedule with register-tasks.ps1.
#>
param(
    [Parameter(Mandatory)][ValidateSet('Full', 'Log', 'Check', 'Offsite', 'Retention')][string]$Job,
    [string]$Instance = '.\SQLEXPRESS',
    [string]$Database = 'CapstoneDb',
    [string]$BackupRoot = 'E:\FPMS-backups',
    [string]$OffsiteDir = $env:FPMS_OFFSITE_DIR
)
$ErrorActionPreference = 'Stop'
$kinds = @{ Full = 1; Log = 2; Check = 3; Offsite = 5 }

function Invoke-Sql([string]$Query, [string]$Db = 'master') {
    $out = & sqlcmd -S $Instance -d $Db -E -b -h -1 -W -Q $Query 2>&1
    if ($LASTEXITCODE -ne 0) { throw ($out -join "`n") }
    return $out
}

function Save-Run([int]$Kind, [datetime]$Started, [bool]$Ok, [string]$File, $Size, [string]$Message) {
    try {
        $q = { param($s) $s.Replace("'", "''") }
        $msg = (& $q $Message); if ($msg.Length -gt 900) { $msg = $msg.Substring(0, 900) }
        $sizeSql = if ($null -eq $Size) { 'NULL' } else { [string][int64]$Size }
        Invoke-Sql "SET NOCOUNT ON; INSERT INTO FpmsBackupRuns (Kind, StartedAtUtc, FinishedAtUtc, Succeeded, FileName, SizeBytes, Message, Host) VALUES ($Kind, '$($Started.ToString('yyyy-MM-ddTHH:mm:ss'))', SYSUTCDATETIME(), $([int]$Ok), N'$(& $q $File)', $sizeSql, N'$msg', N'$($env:COMPUTERNAME)')" $Database | Out-Null
    } catch { Write-Warning "could not record the run: $_" }
}

$started = (Get-Date).ToUniversalTime()
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
try {
    switch ($Job) {
        'Full' {
            $dest = Join-Path $BackupRoot $stamp
            New-Item -ItemType Directory -Path $dest -Force | Out-Null
            $bak = Join-Path $dest "$Database.bak"
            Invoke-Sql "BACKUP DATABASE [$Database] TO DISK = N'$bak' WITH INIT, CHECKSUM, COMPRESSION, NAME = N'FPMS $stamp'" | Out-Null
            Invoke-Sql "RESTORE VERIFYONLY FROM DISK = N'$bak' WITH CHECKSUM" | Out-Null
            Get-FileHash $bak -Algorithm SHA256 | ForEach-Object { "$($_.Hash.ToLower())  $Database.bak" } | Set-Content (Join-Path $dest 'SHA256SUMS')
            Save-Run $kinds.Full $started $true "$stamp\$Database.bak" (Get-Item $bak).Length 'verified with CHECKSUM'
        }
        'Log' {
            $dest = Join-Path $BackupRoot 'logs'
            New-Item -ItemType Directory -Path $dest -Force | Out-Null
            $trn = Join-Path $dest "$Database-$stamp.trn"
            Invoke-Sql "BACKUP LOG [$Database] TO DISK = N'$trn' WITH INIT, CHECKSUM, COMPRESSION" | Out-Null
            Save-Run $kinds.Log $started $true "logs\$Database-$stamp.trn" (Get-Item $trn).Length ''
        }
        'Check' {
            $out = Invoke-Sql "DBCC CHECKDB ([$Database]) WITH NO_INFOMSGS, ALL_ERRORMSGS"
            if ($out) { throw ($out -join "`n") }
            Save-Run $kinds.Check $started $true '' $null 'CHECKDB found no errors'
        }
        'Offsite' {
            if (-not $OffsiteDir) { throw 'Set -OffsiteDir (or $env:FPMS_OFFSITE_DIR)' }
            if (-not $env:FPMS_OFFSITE_PASSPHRASE) { throw 'Set $env:FPMS_OFFSITE_PASSPHRASE' }
            $latest = Get-ChildItem $BackupRoot -Directory | Where-Object Name -Match '^\d{8}-\d{6}$' | Sort-Object Name | Select-Object -Last 1
            if (-not $latest) { throw 'no full backup found' }
            New-Item -ItemType Directory -Path $OffsiteDir -Force | Out-Null
            $out = Join-Path $OffsiteDir "FPMS-offsite-$($latest.Name).7z"
            $logs = Get-ChildItem (Join-Path $BackupRoot 'logs') -Filter *.trn -ErrorAction SilentlyContinue | Where-Object LastWriteTime -gt (Get-Item (Join-Path $latest.FullName "$Database.bak")).LastWriteTime
            & 7z a -t7z "-p$($env:FPMS_OFFSITE_PASSPHRASE)" -mhe=on $out $latest.FullName ($logs | ForEach-Object FullName) | Out-Null
            if ($LASTEXITCODE -ne 0) { throw '7-Zip failed' }
            & 7z t "-p$($env:FPMS_OFFSITE_PASSPHRASE)" $out | Out-Null
            if ($LASTEXITCODE -ne 0) { throw 'the off-site archive does not open' }
            Get-ChildItem $OffsiteDir -Filter 'FPMS-offsite-*.7z' | Sort-Object LastWriteTime -Descending | Select-Object -Skip 8 | Remove-Item -Force
            Save-Run $kinds.Offsite $started $true (Split-Path $out -Leaf) (Get-Item $out).Length 'encrypted, opened and tested after writing'
        }
        'Retention' {
            # 14 days of full backups; Sundays for 12 weeks; the first of each month for 5 years; logs 14 days (never newer than the oldest full kept).
            $folders = Get-ChildItem $BackupRoot -Directory | Where-Object Name -Match '^\d{8}-\d{6}$' | Sort-Object Name
            if ($folders.Count -lt 3) { Write-Output 'fewer than 3 full backups; nothing to delete'; return }
            $seen = @{}
            foreach ($f in $folders) {
                $d = [datetime]::ParseExact($f.Name.Substring(0, 8), 'yyyyMMdd', $null)
                $age = ((Get-Date) - $d).Days
                $month = $f.Name.Substring(0, 6)
                $first = -not $seen.ContainsKey($month); $seen[$month] = $true
                $keep = ($age -le 14) -or ($d.DayOfWeek -eq 'Sunday' -and $age -le 84) -or ($first -and $age -le 1826)
                if (-not $keep) { Remove-Item $f.FullName -Recurse -Force; Write-Output "removed $($f.Name)" }
            }
            $oldest = ($folders | Where-Object { Test-Path $_.FullName } | Select-Object -First 1).Name
            Get-ChildItem (Join-Path $BackupRoot 'logs') -Filter *.trn -ErrorAction SilentlyContinue |
                Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-14) -and $_.BaseName -match '(\d{8}-\d{6})$' -and $Matches[1] -lt $oldest } | Remove-Item -Force
        }
    }
} catch {
    if ($kinds.ContainsKey($Job)) { Save-Run $kinds[$Job] $started $false '' $null ([string]$_) }
    Write-Error $_
    exit 1
}
