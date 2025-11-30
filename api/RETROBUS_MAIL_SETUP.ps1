# Quick start script for RétroBus Mail notifications (Windows)
# Run from: cd C:\Dev\RETROBUS_ESSONNE\interne

Write-Host "🚀 RétroBus Mail - Quick Start Setup" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "api") -or -not (Test-Path "prisma")) {
  Write-Host "❌ Error: Please run this from interne\ directory" -ForegroundColor Red
  exit 1
}

Write-Host "📦 Step 1: Installing dependencies..." -ForegroundColor Blue
Push-Location api
npm install
Pop-Location

Write-Host ""
Write-Host "🗄️  Step 2: Running Prisma migration..." -ForegroundColor Blue
Push-Location api
npx prisma migrate dev --name add_notifications
Pop-Location

Write-Host ""
Write-Host "✅ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Add <NotificationCenter /> to interne/src/App.jsx"
Write-Host "2. Import the service in your routes:"
Write-Host "   import { NotificationService } from './services/notificationService.js';"
Write-Host "3. Add notification calls when events happen"
Write-Host "4. Restart the API server"
Write-Host ""
Write-Host "📖 For more info, see:" -ForegroundColor Cyan
Write-Host "   - interne/RETROBUS_MAIL_README.md"
Write-Host "   - interne/api/NOTIFICATIONS_SETUP.md"
Write-Host ""
Write-Host "🔗 Test the API:" -ForegroundColor Cyan
Write-Host "   curl http://localhost:3001/api/notifications/inbox"
Write-Host ""
