param(
  [string]$Server = "root@krymvokrug.ru",
  [string]$RemoteAppDir = "/opt/krymvokrug",
  [string]$RemoteEnvFile = ".env.production",
  [string]$ComposeFile = "compose.prod.yml",
  [string]$IdentityFile = ""
)

$ErrorActionPreference = "Stop"

$rootDir = Split-Path -Parent $PSScriptRoot
$localDir = Join-Path $rootDir ".local"
$publicDir = Join-Path $rootDir "public"
$uploadsDir = Join-Path $publicDir "uploads"

New-Item -ItemType Directory -Force -Path $localDir | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$remoteTempArchive = "/tmp/krymvokrug-uploads-$timestamp.tar.gz"
$localArchive = Join-Path $localDir "vps-uploads-$timestamp.tar.gz"
$localBackupDir = Join-Path $localDir "uploads-backup-$timestamp"

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

$remoteArchiveCommand = @'
cd {0} &&
docker compose --env-file {1} -f {2} exec -T app sh -lc 'cd /app/public && tar -czf - uploads' > {3}
'@ -f $RemoteAppDir, $RemoteEnvFile, $ComposeFile, $remoteTempArchive

Write-Host "Creating uploads archive on $Server"
& ssh @sshExecArgs $Server $remoteArchiveCommand
if ($LASTEXITCODE -ne 0) {
  throw "Failed to create uploads archive on the VPS."
}

try {
  Write-Host "Downloading uploads archive to: $localArchive"
  & scp @sshArgs "${Server}:${remoteTempArchive}" $localArchive
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to download uploads archive from the VPS."
  }
}
finally {
  & ssh @sshExecArgs $Server "rm -f $remoteTempArchive" | Out-Null
}

if (Test-Path $uploadsDir) {
  Write-Host "Backing up existing uploads to: $localBackupDir"
  Move-Item -LiteralPath $uploadsDir -Destination $localBackupDir
}

Write-Host "Extracting uploads into local public directory"
tar -xzf $localArchive -C $publicDir
if ($LASTEXITCODE -ne 0) {
  throw "Failed to extract uploads archive locally."
}

Write-Host "Repairing upload filenames after extraction"
& powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "repair-upload-filenames.ps1") -UploadsDir $uploadsDir
if ($LASTEXITCODE -ne 0) {
  throw "Failed to repair upload filenames after extraction."
}

Write-Host ""
Write-Host "VPS uploads import completed."
Write-Host "Local archive: $localArchive"
if (Test-Path $localBackupDir) {
  Write-Host "Previous uploads backup: $localBackupDir"
}
