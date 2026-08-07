#!/usr/bin/env pwsh

# Complete migration script with backup and restore

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "   Migration complete database" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$ApiDir = "c:\Dev\RETROBUS_ESSONNE\interne\api"
$BackupDir = "$ApiDir\backups"

try {
    # Step 1: Create backup directory
    Write-Host "`nCreating backup directory..." -ForegroundColor Yellow
    if (-not (Test-Path $BackupDir)) {
        New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    }
    Write-Host "   OK`n" -ForegroundColor Green

    # Step 2: Backup data
    Write-Host "Backing up data..." -ForegroundColor Yellow
    Push-Location $ApiDir
    node backup-final.cjs
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ERROR during backup" -ForegroundColor Red
        exit 1
    }
    
    # Step 3: Run migration
    Write-Host "`nRunning Prisma migration..." -ForegroundColor Yellow
    Write-Host "   (This may ask for confirmation to reset)" -ForegroundColor Yellow
    
    npx prisma migrate deploy --skip-verify
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   NOTE: Type 'y' if asked to reset the database" -ForegroundColor Cyan
    }
    
    Write-Host "`n   Migration done`n" -ForegroundColor Green

    # Step 4: Restore data
    Write-Host "Restoring data..." -ForegroundColor Yellow
    node restore-final.cjs
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ERROR during restore" -ForegroundColor Red
        exit 1
    }
    
    Pop-Location

    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "   Migration successful!" -ForegroundColor Green
    Write-Host "========================================`n" -ForegroundColor Green
    
} catch {
    Write-Host "`nERROR: $($_.Exception.Message)`n" -ForegroundColor Red
    Pop-Location -ErrorAction SilentlyContinue
    exit 1
}
