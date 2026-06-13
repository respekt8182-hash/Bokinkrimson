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

function Test-PostgresReady {
  $result = & $psql -h 127.0.0.1 -p $port -U $dbUser -d postgres -tAc "SELECT 1;" 2>$null
  return $LASTEXITCODE -eq 0 -and $result.Trim() -eq "1"
}

function Wait-PostgresReady {
  param([int]$TimeoutSeconds = 30)

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-PostgresReady) {
      return $true
    }

    Start-Sleep -Milliseconds 500
  }

  return $false
}

$statusOutput = & $pgCtl -D $dataDir status 2>&1
$isRunning = $LASTEXITCODE -eq 0

if ($isRunning) {
  Write-Host "Local PostgreSQL is already running."
} else {
  & $pgCtl -D $dataDir -l $logFile -o "-p $port" -w start
  if ($LASTEXITCODE -ne 0 -and -not (Test-PostgresReady)) {
    $details = ($statusOutput | Out-String).Trim()
    if ($details) {
      throw "Failed to start local PostgreSQL. $details"
    }

    throw "Failed to start local PostgreSQL. Check $logFile"
  }
}

if (-not (Wait-PostgresReady -TimeoutSeconds 30)) {
  throw "Local PostgreSQL did not become ready on 127.0.0.1:$port. Check $logFile"
}

$dbExists = & $psql -h 127.0.0.1 -p $port -U $dbUser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$dbName';"
if ($dbExists.Trim() -ne "1") {
  & $createdb -h 127.0.0.1 -p $port -U $dbUser $dbName | Out-Host
}

Write-Host "Local PostgreSQL is ready on 127.0.0.1:$port"
Write-Host "Database: $dbName"
Write-Host "User: $dbUser"
