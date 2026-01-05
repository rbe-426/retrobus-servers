import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // Exécuter les migrations SQL directement
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "scheduled_operations" ADD COLUMN IF NOT EXISTS "remainingTotalAmount" DOUBLE PRECISION;
    `);
    
    console.log('✅ Column remainingTotalAmount added/verified');
    
    // Update existing rows
    const result = await prisma.$executeRaw`
      UPDATE "scheduled_operations" 
      SET "remainingTotalAmount" = "totalAmount" 
      WHERE "remainingTotalAmount" IS NULL OR "remainingTotalAmount" = 0;
    `;
    
    console.log(`✅ Updated ${result} rows`);
    
    // Create table scheduled_operation_payments if it doesn't exist
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "scheduled_operation_payments" (
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
    
    console.log('✅ Table scheduled_operation_payments created/verified');
    
    // Create indexes
    try {
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "scheduled_operation_payments_paidAt_idx" ON "scheduled_operation_payments"("paidAt");
      `);
    } catch (e) {
      console.log('ℹ️ Index paidAt already exists');
    }
    
    try {
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "scheduled_operation_payments_period_idx" ON "scheduled_operation_payments"("period");
      `);
    } catch (e) {
      console.log('ℹ️ Index period already exists');
    }
    
    try {
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "scheduled_operation_payments_scheduledOperationId_idx" ON "scheduled_operation_payments"("scheduledOperationId");
      `);
    } catch (e) {
      console.log('ℹ️ Index scheduledOperationId already exists');
    }
    
    console.log('✅ Indexes created/verified');
    
    // Add foreign key if not exists
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "scheduled_operation_payments" 
        ADD CONSTRAINT "scheduled_operation_payments_scheduledOperationId_fkey" 
        FOREIGN KEY ("scheduledOperationId") REFERENCES "scheduled_operations"("id") ON DELETE CASCADE;
      `);
      console.log('✅ Foreign key added');
    } catch (e) {
      console.log('ℹ️ Foreign key already exists:', e.message);
    }
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
