// Script pour vérifier la plage de dates des transactions
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTransactionDates() {
  console.log('📊 Vérification des transactions financières...\n');

  const count = await prisma.finance_transactions.count();
  console.log(`Total transactions: ${count}\n`);

  if (count === 0) {
    console.log('❌ Aucune transaction trouvée.');
    await prisma.$disconnect();
    return;
  }

  // Premières transactions
  const firstTx = await prisma.finance_transactions.findMany({
    orderBy: { date: 'asc' },
    take: 5
  });

  console.log('📅 Premières transactions:');
  firstTx.forEach(t => {
    console.log(`   ${t.date.toISOString().split('T')[0]} - ${t.type} - ${t.amount}€ - ${t.description}`);
  });

  // Dernières transactions
  const lastTx = await prisma.finance_transactions.findMany({
    orderBy: { date: 'desc' },
    take: 5
  });

  console.log('\n📅 Dernières transactions:');
  lastTx.forEach(t => {
    console.log(`   ${t.date.toISOString().split('T')[0]} - ${t.type} - ${t.amount}€ - ${t.description}`);
  });

  // Plage de dates
  const dates = await prisma.finance_transactions.aggregate({
    _min: { date: true },
    _max: { date: true }
  });

  console.log('\n📊 Plage de données:');
  console.log(`   Première transaction: ${dates._min.date.toISOString().split('T')[0]}`);
  console.log(`   Dernière transaction: ${dates._max.date.toISOString().split('T')[0]}`);

  // Compter par mois
  const allTransactions = await prisma.finance_transactions.findMany({
    select: { date: true }
  });

  const byMonth = {};
  allTransactions.forEach(t => {
    const monthKey = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`;
    byMonth[monthKey] = (byMonth[monthKey] || 0) + 1;
  });

  console.log('\n📊 Transactions par mois:');
  Object.entries(byMonth)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([month, count]) => {
      console.log(`   ${month}: ${count} transactions`);
    });

  await prisma.$disconnect();
}

checkTransactionDates().catch(console.error);
