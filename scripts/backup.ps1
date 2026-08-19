param(
  [ValidateSet('quick','full')]
  [string]$Mode = 'quick'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = Join-Path $root 'backups'
$archiveName = "api-backup-$Mode-$timestamp.zip"
$archivePath = Join-Path $backupDir $archiveName

if (-not (Test-Path $backupDir)) { New-Item -ItemType Directory -Path $backupDir | Out-Null }

# Select content to backup
$include = @(
  'package.json', 'package-lock.json', 'Dockerfile', '.env', '.env.example', '.env.local',
  'src', 'uploads', 'prisma'
)

# Exclusions
$exclude = @('node_modules', '.git', '.vercel', '.next', 'logs.txt')

# Build file list
$items = @()
foreach ($name in $include) {
  $path = Join-Path $root $name
  if (Test-Path $path) { $items += $path }
}

# Create archive
if (Test-Path $archivePath) { Remove-Item $archivePath -Force }
if ($items.Count -eq 0) { Write-Error "No files to backup"; exit 1 }
Compress-Archive -Path $items -DestinationPath $archivePath -Force

Write-Host "Backup created: $archivePath" -ForegroundColor Green
