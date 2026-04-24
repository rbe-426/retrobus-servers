import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDebtsStatus() {
  try {
    const debts = await prisma.debt.findMany({
      orderBy: { createdAt: 'desc' }
    });

    console.log('📊 ÉTAT DES DETTES ET CRÉANCES\n');
    console.log('═'.repeat(100));

    let totalDettes = 0;
    let totalRestantDettes = 0;
    let totalCreances = 0;
    let totalRestantCreances = 0;

    console.log('\n🔴 DETTES:');
    const dettes = debts.filter(d => d.type === 'DETTE');
    dettes.forEach(debt => {
      const remaining = debt.amount - debt.paidAmount;
      if (debt.status !== 'ANNULÉE') {
        totalDettes += debt.amount;
        totalRestantDettes += remaining;
      }
      console.log(`\n  ${debt.description} (${debt.debtorName})`);
      console.log(`  Nature: ${debt.debtNature || 'DETTE_NORMALE'}`);
      console.log(`  Total: ${debt.amount}€ | Réglé: ${debt.paidAmount}€ | Restant: ${remaining}€`);
      console.log(`  Statut: ${debt.status}`);
    });

    console.log('\n\n🟢 CRÉANCES:');
    const creances = debts.filter(d => d.type === 'CRÉANCE');
    creances.forEach(debt => {
      const remaining = debt.amount - debt.paidAmount;
      if (debt.status !== 'ANNULÉE') {
        totalCreances += debt.amount;
        totalRestantCreances += remaining;
      }
      console.log(`\n  ${debt.description} (${debt.debtorName})`);
      console.log(`  Nature: ${debt.debtNature || 'DETTE_NORMALE'}`);
      console.log(`  Total: ${debt.amount}€ | Réglé: ${debt.paidAmount}€ | Restant: ${remaining}€`);
      console.log(`  Statut: ${debt.status}`);
    });

    console.log('\n\n' + '═'.repeat(100));
    console.log('📈 RÉCAPITULATIF (hors ANNULÉES):');
    console.log('─'.repeat(100));
    console.log(`\n🔴 DETTES:`);
    console.log(`   Total: ${totalDettes.toFixed(2)}€`);
    console.log(`   Réglé: ${(totalDettes - totalRestantDettes).toFixed(2)}€`);
    console.log(`   Restant à payer: ${totalRestantDettes.toFixed(2)}€`);
    
    console.log(`\n🟢 CRÉANCES:`);
    console.log(`   Total: ${totalCreances.toFixed(2)}€`);
    console.log(`   Réglé: ${(totalCreances - totalRestantCreances).toFixed(2)}€`);
    console.log(`   Restant à recevoir: ${totalRestantCreances.toFixed(2)}€`);
    
    const balanceNette = totalRestantCreances - totalRestantDettes;
    console.log(`\n💰 BALANCE NETTE: ${balanceNette >= 0 ? '+' : ''}${balanceNette.toFixed(2)}€`);
    console.log(`   (créances restantes - dettes restantes)`);
    console.log('═'.repeat(100) + '\n');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDebtsStatus();
