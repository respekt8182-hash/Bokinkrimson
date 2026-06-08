param(
  [switch]$Foreground
)

$ErrorActionPreference = "Stop"

$rootDir = Split-Path -Parent $PSScriptRoot
$localDir = Join-Path $rootDir ".local"
$outLog = Join-Path $localDir "next-dev.out.log"
$errLog = Join-Path $localDir "next-dev.err.log"

New-Item -ItemType Directory -Force -Path $localDir | Out-Null

Write-Host "Starting local PostgreSQL..."
powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "local-db-start.ps1") | Out-Host

$listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) {
  Write-Host "Next.js is already listening on port 3000 (PID $($listener.OwningProcess))."
  exit 0
}

Write-Host "Starting Next.js dev server..."
if ($Foreground) {
  Push-Location $rootDir
  try {
    npm run dev
  }
  finally {
    Pop-Location
  }
  exit $LASTEXITCODE
}

$process = Start-Process `
  -FilePath "powershell.exe" `
  -ArgumentList "-NoProfile", "-Command", "npm run dev" `
  -WorkingDirectory $rootDir `
  -WindowStyle Hidden `
  -RedirectStandardOutput $outLog `
  -RedirectStandardError $errLog `
  -PassThru

Write-Host "Next.js started in background. PID: $($process.Id)"
Write-Host "App: http://localhost:3000"
