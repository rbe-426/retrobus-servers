import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

async function showTransactions() {
  try {
    const transactions = await prisma.finance_transactions.findMany({
      orderBy: { date: 'desc' }
    });

    console.log('\n========================================');
    console.log(`Total: ${transactions.length} transactions`);
    console.log('========================================\n');

    transactions.forEach((t, index) => {
      const typeLabel = t.type === 'CREDIT' ? '✅ RENTRÉE' : '❌ DÉPENSE';
      const date = new Date(t.date).toLocaleDateString('fr-FR');
      console.log(`${index + 1}. [${typeLabel}] ${date} - ${t.amount.toFixed(2)}€`);
      console.log(`   Description: ${t.description}`);
      console.log(`   Catégorie: ${t.category || 'AUTRE'}`);
      console.log('');
    });

    console.log('\n========================================');
    console.log('Vérifiez si les types (RENTRÉE/DÉPENSE) correspondent bien aux descriptions');
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

showTransactions();
