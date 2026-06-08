$ErrorActionPreference = "Stop"

$listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) {
  Stop-Process -Id $listener.OwningProcess -Force
  Write-Host "Stopped Next.js on port 3000 (PID $($listener.OwningProcess))."
} else {
  Write-Host "Next.js is not listening on port 3000."
}

powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "local-db-stop.ps1") | Out-Host
