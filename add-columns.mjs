import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addMissingColumns() {
  try {
    console.log('🔧 Adding missing columns...');
    
    // Add paymentsCount column
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "scheduled_operations" ADD COLUMN IF NOT EXISTS "paymentsCount" INTEGER DEFAULT 0;
    `);
    console.log('✅ Column paymentsCount added');
    
    // Add remainingTotalAmount column
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "scheduled_operations" ADD COLUMN IF NOT EXISTS "remainingTotalAmount" DOUBLE PRECISION;
    `);
    console.log('✅ Column remainingTotalAmount added');
    
    // Initialize remainingTotalAmount
    await prisma.$executeRawUnsafe(`
      UPDATE "scheduled_operations" SET "remainingTotalAmount" = "totalAmount" WHERE "remainingTotalAmount" IS NULL;
    `);
    console.log('✅ Initialized remainingTotalAmount');
    
    console.log('✅ All columns added successfully!');
  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

addMissingColumns();
