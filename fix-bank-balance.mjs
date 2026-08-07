import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Correction du solde bancaire
 * Initialise le solde à partir du solde bancaire réel connu
 */

const SOLDE_BANCAIRE_REEL = 2955.44; // Au 31 mars 2026 (relevé 26003)
const DATE_REFERENCE = '2026-03-31';

async function fixBankBalance() {
  console.log('\n====================================');
  console.log('🔧 CORRECTION DU SOLDE BANCAIRE');
  console.log('====================================\n');

  // 1. Vérifier le solde actuel
  const soldeActuel = await prisma.finance_balances.findFirst({
    orderBy: { createdAt: 'desc' }
  });

  if (soldeActuel) {
    console.log(`💾 Solde actuel dans le système: ${soldeActuel.balance.toFixed(2)} €`);
  } else {
    console.log(`⚠️  Aucun solde trouvé dans finance_balances`);
  }

  console.log(`✅ Solde bancaire RÉEL au ${DATE_REFERENCE}: ${SOLDE_BANCAIRE_REEL.toFixed(2)} €\n`);

  // 2. Recalculer depuis les transactions
  const transactions = await prisma.finance_transactions.findMany({
    orderBy: { date: 'asc' }
  });

  let soldeCalcule = 0;
  for (const tx of transactions) {
    if (tx.type === 'CREDIT') {
      soldeCalcule += tx.amount;
    } else if (tx.type === 'DEBIT') {
      soldeCalcule -= tx.amount;
    }
  }

  console.log(`🧮 Solde calculé depuis transactions: ${soldeCalcule.toFixed(2)} €`);
  console.log(`📊 ${transactions.length} transactions analysées\n`);

  // 3. Calculer le solde initial manquant
  const soldeInitialManquant = SOLDE_BANCAIRE_REEL - soldeCalcule;
  console.log(`💰 Solde INITIAL à ajouter: ${soldeInitialManquant.toFixed(2)} €`);
  console.log(`   (pour compenser les transactions manquantes)\n`);

  // 4. Proposition de correction
  console.log(`📝 CORRECTION PROPOSÉE:\n`);
  console.log(`   Option 1: Mettre à jour finance_balances avec le solde réel`);
  console.log(`             Nouveau solde: ${SOLDE_BANCAIRE_REEL.toFixed(2)} €\n`);
  console.log(`   Option 2: Ajouter une transaction d'initialisation`);
  console.log(`             Type: CREDIT`);
  console.log(`             Montant: ${soldeInitialManquant.toFixed(2)} €`);
  console.log(`             Description: "Solde initial - Régularisation comptable"\n`);

  // Demander confirmation
  console.log(`⚠️  ATTENTION: Cette opération va modifier le solde dans la base de données\n`);
  console.log(`Appuyez sur Ctrl+C pour annuler, ou relancez avec --confirm pour appliquer\n`);

  // Vérifier si on doit appliquer
  if (process.argv.includes('--confirm')) {
    console.log(`\n🚀 Application de la correction...\n`);

    try {
      // Option 1: Mettre à jour ou créer le solde
      let result;
      if (soldeActuel) {
        result = await prisma.finance_balances.update({
          where: { id: soldeActuel.id },
          data: { balance: SOLDE_BANCAIRE_REEL }
        });
        console.log(`✅ Solde mis à jour: ${result.balance.toFixed(2)} €`);
      } else {
        result = await prisma.finance_balances.create({
          data: {
            id: `balance_${Date.now()}`,
            balance: SOLDE_BANCAIRE_REEL,
            isLocked: false
          }
        });
        console.log(`✅ Solde créé: ${result.balance.toFixed(2)} €`);
      }

      // Option 2: Ajouter une transaction d'initialisation si nécessaire
      if (Math.abs(soldeInitialManquant) > 0.01) {
        const txInit = await prisma.finance_transactions.create({
          data: {
            id: `init_${Date.now()}`,
            type: soldeInitialManquant > 0 ? 'CREDIT' : 'DEBIT',
            amount: Math.abs(soldeInitialManquant),
            description: 'Solde initial - Régularisation comptable au 31/03/2026',
            category: 'AUTRE',
            date: new Date('2025-04-25') // Avant toutes les autres transactions
          }
        });
        console.log(`✅ Transaction d'initialisation créée: ${txInit.type} ${txInit.amount.toFixed(2)} €`);
      }

      console.log(`\n✅ CORRECTION TERMINÉE\n`);
      
      // Vérification finale
      const nouveauSolde = await prisma.finance_balances.findFirst({
        orderBy: { createdAt: 'desc' }
      });
      console.log(`📊 Nouveau solde enregistré: ${nouveauSolde.balance.toFixed(2)} €`);

    } catch (error) {
      console.error(`❌ Erreur lors de la correction:`, error);
    }
  } else {
    console.log(`ℹ️  Pour appliquer la correction, relancez avec: node fix-bank-balance.mjs --confirm`);
  }

  console.log(`\n====================================\n`);
}

fixBankBalance()
  .catch((e) => {
    console.error('❌ Erreur:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
