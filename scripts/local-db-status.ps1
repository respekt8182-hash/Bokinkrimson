$ErrorActionPreference = "Stop"

$pgCtl = "C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe"
$rootDir = Split-Path -Parent $PSScriptRoot
$dataDir = Join-Path $rootDir ".local\postgres-data"

if (-not (Test-Path $dataDir)) {
  Write-Host "Local PostgreSQL cluster is not initialized."
  exit 0
}

& $pgCtl -D $dataDir status | Out-Host
