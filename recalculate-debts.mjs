/**
 * Script de recalcul des montants de dettes/créances
 * Utilise la logique intelligente basée sur les transactions liées
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function recalculateDebts() {
  try {
    console.log('🔄 Recalcul de toutes les dettes et créances...\n');
    
    const debts = await prisma.debt.findMany();
    let updated = 0;
    
    for (const debt of debts) {
      console.log(`\n📋 Analyse ${debt.type} "${debt.description}" (${debt.debtorName})`);
      console.log(`   Valeurs actuelles: amount=${debt.amount}€, paidAmount=${debt.paidAmount}€`);
      
      // Récupérer toutes les transactions liées
      const linkedTx = await prisma.finance_transactions.findMany({
        where: { linkedDocumentId: debt.id },
        orderBy: { date: 'asc' }
      });
      
      if (linkedTx.length === 0) {
        console.log('   ℹ️  Aucune transaction liée, pas de recalcul');
        continue;
      }
      
      console.log(`   📊 ${linkedTx.length} transactions liées:`);
      
      // Recalculer amount et paidAmount selon la logique intelligente
      let newAmount = 0;
      let newPaidAmount = 0;
      const isDette = debt.type === 'DETTE';
      
      for (const tx of linkedTx) {
        const txAmount = Math.abs(tx.amount || 0);
        const isDebit = tx.type === 'DEBIT'; // Utiliser le champ type au lieu du signe
        const txType = tx.type; // CREDIT ou DEBIT
        
        if ((isDette && isDebit) || (!isDette && !isDebit)) {
          // Transaction crée/augmente la dette/créance
          newAmount += txAmount;
          console.log(`      ${txType} ${tx.amount}€ → augmente amount de ${txAmount}€`);
        } else {
          // Transaction rembourse la dette/créance  
          newPaidAmount += txAmount;
          console.log(`      ${txType} ${tx.amount}€ → augmente paidAmount de ${txAmount}€`);
        }
      }
      
      // Calculer le statut
      const newStatus = newAmount > 0 && newPaidAmount >= newAmount ? 'PAYÉE' : debt.status === 'ANNULÉE' ? 'ANNULÉE' : 'EN_COURS';
      
      console.log(`   ✅ Nouvelles valeurs: amount=${newAmount}€, paidAmount=${newPaidAmount}€, status=${newStatus}`);
      
      // Mettre à jour la dette
      await prisma.debt.update({
        where: { id: debt.id },
        data: {
          amount: newAmount,
          paidAmount: newPaidAmount,
          status: newStatus,
          updatedAt: new Date()
        }
      });
      
      updated++;
    }
    
    console.log(`\n🎉 ${updated} dettes/créances recalculées avec succès !`);
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

recalculateDebts();
