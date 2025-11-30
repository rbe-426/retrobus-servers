#!/bin/bash
# Quick start script for RétroBus Mail notifications

echo "🚀 RétroBus Mail - Quick Start Setup"
echo "===================================="
echo ""

# Check if we're in the right directory
if [ ! -d "api" ] || [ ! -d "prisma" ]; then
  echo "❌ Error: Please run this from interne/ directory"
  exit 1
fi

echo "📦 Step 1: Installing dependencies..."
cd api
npm install
cd ..

echo ""
echo "🗄️  Step 2: Running Prisma migration..."
cd api
npx prisma migrate dev --name add_notifications
cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Add <NotificationCenter /> to interne/src/App.jsx"
echo "2. Import the service in your routes:"
echo "   import { NotificationService } from './services/notificationService.js';"
echo "3. Add notification calls when events happen"
echo "4. Restart the API server"
echo ""
echo "📖 For more info, see:"
echo "   - interne/RETROBUS_MAIL_README.md"
echo "   - interne/api/NOTIFICATIONS_SETUP.md"
echo ""
echo "🔗 Test the API:"
echo "   curl http://localhost:3001/api/notifications/inbox"
echo ""
