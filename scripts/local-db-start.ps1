$ErrorActionPreference = "Stop"

$pgBin = "C:\Program Files\PostgreSQL\17\bin"
$initdb = Join-Path $pgBin "initdb.exe"
$pgCtl = Join-Path $pgBin "pg_ctl.exe"
$psql = Join-Path $pgBin "psql.exe"
$createdb = Join-Path $pgBin "createdb.exe"

$rootDir = Split-Path -Parent $PSScriptRoot
$localDir = Join-Path $rootDir ".local"
$dataDir = Join-Path $localDir "postgres-data"
$logFile = Join-Path $localDir "postgres.log"
$port = 5433
$dbName = "boking"
$dbUser = "postgres"

New-Item -ItemType Directory -Force -Path $localDir | Out-Null

if (-not (Test-Path $initdb)) {
  throw "PostgreSQL binaries not found at $pgBin"
}

if (-not (Test-Path (Join-Path $dataDir "PG_VERSION"))) {
  & $initdb -D $dataDir -U $dbUser -A trust --encoding=UTF8 --locale=C
}

& $pgCtl -D $dataDir -l $logFile -o "-p $port" -w start | Out-Host

$dbExists = & $psql -h 127.0.0.1 -p $port -U $dbUser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$dbName';"
if ($dbExists.Trim() -ne "1") {
  & $createdb -h 127.0.0.1 -p $port -U $dbUser $dbName | Out-Host
}

Write-Host "Local PostgreSQL is ready on 127.0.0.1:$port"
Write-Host "Database: $dbName"
Write-Host "User: $dbUser"
