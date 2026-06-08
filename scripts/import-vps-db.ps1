param(
  [string]$Server = "root@krymvokrug.ru",
  [string]$RemoteAppDir = "/opt/krymvokrug",
  [string]$RemoteEnvFile = ".env.production",
  [string]$ComposeFile = "compose.prod.yml",
  [string]$IdentityFile = "",
  [switch]$SkipLocalBackup
)

$ErrorActionPreference = "Stop"

$pgBin = "C:\Program Files\PostgreSQL\17\bin"
$pgDump = Join-Path $pgBin "pg_dump.exe"
$pgRestore = Join-Path $pgBin "pg_restore.exe"
$psql = Join-Path $pgBin "psql.exe"

foreach ($tool in @($pgDump, $pgRestore, $psql)) {
  if (-not (Test-Path $tool)) {
    throw "PostgreSQL tool not found: $tool"
  }
}

$rootDir = Split-Path -Parent $PSScriptRoot
$localDir = Join-Path $rootDir ".local"
$envFile = Join-Path $rootDir ".env"

if (-not (Test-Path $envFile)) {
  throw "Local .env file not found: $envFile"
}

New-Item -ItemType Directory -Force -Path $localDir | Out-Null

$databaseUrlLine = Get-Content $envFile | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
if (-not $databaseUrlLine) {
  throw "DATABASE_URL was not found in $envFile"
}

$localDatabaseUrl = ($databaseUrlLine -replace '^DATABASE_URL=', '').Trim().Trim('"')
$localDatabaseUrl = $localDatabaseUrl -replace '\?schema=.*$',''

$sshArgs = @()
if ($IdentityFile) {
  $sshArgs += @("-i", $IdentityFile)
}
$sshArgs += @(
  "-o", "BatchMode=yes",
  "-o", "ConnectTimeout=15",
  "-o", "StrictHostKeyChecking=no",
  "-o", "UserKnownHostsFile=NUL"
)
$sshExecArgs = @("-n") + $sshArgs

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$remoteTempDump = "/tmp/krymvokrug-db-$timestamp.dump"
$localDumpPath = Join-Path $localDir "vps-db-$timestamp.dump"
$localBackupPath = Join-Path $localDir "local-before-vps-restore-$timestamp.dump"

if (-not $SkipLocalBackup) {
  Write-Host "Creating local backup: $localBackupPath"
  & $pgDump --format=custom --file $localBackupPath --dbname $localDatabaseUrl
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to create local backup."
  }
}

$remoteDumpCommand = @'
cd {0} &&
docker compose --env-file {1} -f {2} exec -T db sh -lc 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > {3}
'@ -f $RemoteAppDir, $RemoteEnvFile, $ComposeFile, $remoteTempDump

Write-Host "Creating remote dump on $Server"
& ssh @sshExecArgs $Server $remoteDumpCommand
if ($LASTEXITCODE -ne 0) {
  throw "Failed to create the remote dump. Check SSH access, remote path, and docker compose state."
}

try {
  Write-Host "Downloading remote dump to: $localDumpPath"
  & scp @sshArgs "${Server}:${remoteTempDump}" $localDumpPath
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to copy dump from the server."
  }
}
finally {
  & ssh @sshExecArgs $Server "rm -f $remoteTempDump" | Out-Null
}

Write-Host "Closing active connections to local database before restore"
$terminateConnectionsSql = @'
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid();
'@
& $psql --dbname $localDatabaseUrl -c $terminateConnectionsSql | Out-Host
if ($LASTEXITCODE -ne 0) {
  throw "Failed to terminate active local DB connections."
}

Write-Host "Restoring VPS dump into local database"
& $pgRestore --clean --if-exists --no-owner --no-privileges --dbname $localDatabaseUrl $localDumpPath
if ($LASTEXITCODE -ne 0) {
  throw "Failed to restore the VPS dump locally."
}

Write-Host "Applying repository migrations on top of restored data"
Push-Location $rootDir
try {
  npm run db:generate | Out-Host
  if ($LASTEXITCODE -ne 0) {
    throw "Prisma client generation failed after restore."
  }

  npx prisma migrate deploy | Out-Host
  if ($LASTEXITCODE -ne 0) {
    throw "Prisma migrations failed after restore."
  }
}
finally {
  Pop-Location
}

Write-Host ""
Write-Host "VPS database import completed."
Write-Host "Local dump: $localDumpPath"
if (-not $SkipLocalBackup) {
  Write-Host "Local backup: $localBackupPath"
}
