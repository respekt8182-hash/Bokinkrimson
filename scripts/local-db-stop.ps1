$ErrorActionPreference = "Stop"

$pgCtl = "C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe"
$rootDir = Split-Path -Parent $PSScriptRoot
$dataDir = Join-Path $rootDir ".local\postgres-data"

if (-not (Test-Path $dataDir)) {
  Write-Host "Local PostgreSQL data directory not found: $dataDir"
  exit 0
}

& $pgCtl -D $dataDir -w stop | Out-Host
