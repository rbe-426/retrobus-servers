import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteAllTransactions() {
  try {
    console.log('🗑️  Suppression de toutes les transactions...');
    
    const result = await prisma.finance_transactions.deleteMany({});
    
    console.log(`✅ ${result.count} transactions supprimées avec succès`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAllTransactions();
