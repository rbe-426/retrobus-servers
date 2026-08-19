import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Script pour initialiser les tables manquantes en production
 * À exécuter une seule fois sur Railway
 */
async function initializeMissingTables() {
  try {
    console.log('🔧 Initializing missing tables...');
    
    // 1. Check if remainingTotalAmount column exists
    console.log('1️⃣ Checking remainingTotalAmount column...');
    try {
      const result = await prisma.$queryRaw`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'scheduled_operations' AND column_name = 'remainingTotalAmount';
      `;
      
      if (result.length === 0) {
        console.log('  ⚠️ Column does not exist, creating...');
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "scheduled_operations" ADD COLUMN "remainingTotalAmount" DOUBLE PRECISION;
        `);
        console.log('  ✅ Column created');
      } else {
        console.log('  ✅ Column already exists');
      }
    } catch (e) {
      console.error('  ❌ Error:', e.message);
    }

    // 2. Check if scheduled_operation_payments table exists
    console.log('\n2️⃣ Checking scheduled_operation_payments table...');
    try {
      const tables = await prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'scheduled_operation_payments';
      `;
      
      if (tables.length === 0) {
        console.log('  ⚠️ Table does not exist, creating...');
        await prisma.$executeRawUnsafe(`
          CREATE TABLE "scheduled_operation_payments" (
            "id" TEXT NOT NULL,
            "scheduledOperationId" TEXT NOT NULL,
            "period" TEXT NOT NULL,
            "amount" DOUBLE PRECISION NOT NULL,
            "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "fileName" TEXT,
            "mimeType" TEXT,
            "size" INTEGER,
            "attachmentDataUrl" TEXT,
            CONSTRAINT "scheduled_operation_payments_pkey" PRIMARY KEY ("id")
          );
        `);
        console.log('  ✅ Table created');
        
        // Create indexes
        console.log('  Creating indexes...');
        await prisma.$executeRawUnsafe(`
          CREATE INDEX "scheduled_operation_payments_paidAt_idx" ON "scheduled_operation_payments"("paidAt");
        `);
        await prisma.$executeRawUnsafe(`
          CREATE INDEX "scheduled_operation_payments_period_idx" ON "scheduled_operation_payments"("period");
        `);
        await prisma.$executeRawUnsafe(`
          CREATE INDEX "scheduled_operation_payments_scheduledOperationId_idx" ON "scheduled_operation_payments"("scheduledOperationId");
        `);
        console.log('  ✅ Indexes created');
        
        // Add foreign key
        console.log('  Adding foreign key...');
        try {
          await prisma.$executeRawUnsafe(`
            ALTER TABLE "scheduled_operation_payments" 
            ADD CONSTRAINT "scheduled_operation_payments_scheduledOperationId_fkey" 
            FOREIGN KEY ("scheduledOperationId") REFERENCES "scheduled_operations"("id") ON DELETE CASCADE;
          `);
          console.log('  ✅ Foreign key added');
        } catch (e) {
          console.log('  ℹ️ Foreign key might already exist:', e.message.split('\n')[0]);
        }
      } else {
        console.log('  ✅ Table already exists');
      }
    } catch (e) {
      console.error('  ❌ Error:', e.message);
    }

    // 3. Update remainingTotalAmount for existing operations
    console.log('\n3️⃣ Updating remainingTotalAmount for existing operations...');
    try {
      const result = await prisma.$executeRaw`
        UPDATE "scheduled_operations" 
        SET "remainingTotalAmount" = "totalAmount" 
        WHERE "remainingTotalAmount" IS NULL OR "remainingTotalAmount" = 0;
      `;
      console.log(`  ✅ Updated ${result} rows`);
    } catch (e) {
      console.error('  ❌ Error:', e.message);
    }

    console.log('\n✅ Initialization complete!');
    
  } catch (e) {
    console.error('Fatal error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

initializeMissingTables();
