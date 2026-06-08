param(
  [string]$UploadsDir = ""
)

$ErrorActionPreference = "Stop"

$rootDir = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($UploadsDir)) {
  $UploadsDir = Join-Path $rootDir "public\uploads"
}

if (-not (Test-Path -LiteralPath $UploadsDir)) {
  Write-Host "Uploads directory not found: $UploadsDir"
  exit 0
}

$cp866 = [System.Text.Encoding]::GetEncoding(866)
$utf8 = [System.Text.Encoding]::UTF8
$mojibakeMarkers = @([char]0x2568, [char]0x2564)

$renamed = 0
$skipped = 0
$conflicts = New-Object System.Collections.Generic.List[string]

$files = Get-ChildItem -LiteralPath $UploadsDir -Recurse -File | Sort-Object FullName

foreach ($file in $files) {
  if ($file.Name.IndexOfAny($mojibakeMarkers) -lt 0) {
    continue
  }

  $decodedName = $utf8.GetString($cp866.GetBytes($file.Name))
  if ($decodedName -eq $file.Name) {
    continue
  }

  $targetPath = Join-Path $file.DirectoryName $decodedName
  if (Test-Path -LiteralPath $targetPath) {
    $skipped += 1
    $conflicts.Add($targetPath) | Out-Null
    continue
  }

  [System.IO.File]::Move($file.FullName, $targetPath)
  $renamed += 1
}

Write-Host "Upload filename repair completed."
Write-Host "Renamed files: $renamed"
Write-Host "Skipped conflicts: $skipped"

if ($conflicts.Count -gt 0) {
  Write-Host "Conflicting targets:"
  $conflicts | Select-Object -First 20 | ForEach-Object { Write-Host " - $_" }
}
