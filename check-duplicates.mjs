import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDuplicates() {
  try {
    const txs = await prisma.finance_transactions.findMany({
      orderBy: { date: 'desc' },
      take: 100,
      select: { id: true, date: true, description: true, amount: true, type: true }
    });

    console.log(`📊 Analyse de ${txs.length} dernières transactions...\n`);

    const grouped = {};
    txs.forEach(tx => {
      const key = tx.date.toISOString().split('T')[0] + '|' + tx.amount + '|' + tx.description.substring(0, 50);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(tx);
    });

    let duplicateCount = 0;
    Object.entries(grouped).forEach(([key, items]) => {
      if (items.length > 1) {
        duplicateCount++;
        console.log(`\n⚠️ DOUBLONS (${items.length}x):`);
        items.forEach(item => {
          console.log(`  - ${item.id.substring(0, 8)} | ${item.date.toISOString().split('T')[0]} | ${item.type} | ${item.amount}€ | ${item.description.substring(0, 80)}`);
        });
      }
    });

    if (duplicateCount === 0) {
      console.log('✅ Aucun doublon détecté parmi les 100 dernières transactions');
    } else {
      console.log(`\n📊 Total: ${duplicateCount} groupes de doublons détectés`);
    }
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDuplicates();
