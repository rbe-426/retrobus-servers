import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Analyse du solde bancaire réel vs système
 * Basé sur les relevés BNP Paribas fournis
 */

// Soldes bancaires réels extraits des relevés
const soldeBancaireReel = [
  { date: '2025-04-30', solde: 20.00, releve: '25001' },
  { date: '2025-05-31', solde: 15.17, releve: '25002' },
  { date: '2025-06-30', solde: 8.47, releve: '25003' },
  { date: '2025-07-31', solde: 11.77, releve: '25004' },
  { date: '2025-08-31', solde: -12.03, releve: '25005' },
  { date: '2025-09-30', solde: 13.07, releve: '25006' },
  { date: '2025-10-31', solde: 13.61, releve: '25007' },
  { date: '2025-11-30', solde: 0.31, releve: '25008' },
  { date: '2025-12-31', solde: 272.05, releve: '25009' },
  { date: '2026-01-31', solde: 8404.02, releve: '26001' },
  { date: '2026-02-28', solde: 8460.32, releve: '26002' },
  { date: '2026-03-31', solde: 2955.44, releve: '26003' }  // SOLDE RÉEL ACTUEL
];

async function analyzeBankBalance() {
  console.log('\n====================================');
  console.log('📊 ANALYSE SOLDE BANCAIRE');
  console.log('====================================\n');

  // 1. Solde bancaire réel au 31 mars 2026
  const soldeReelActuel = soldeBancaireReel[soldeBancaireReel.length - 1];
  console.log(`✅ Solde bancaire RÉEL au ${soldeReelActuel.date}: ${soldeReelActuel.solde.toFixed(2)} €`);
  console.log(`   (Relevé ${soldeReelActuel.releve})\n`);

  // 2. Solde dans le système (table finance_balances)
  const soldeSysteme = await prisma.finance_balances.findFirst({
    orderBy: { createdAt: 'desc' }
  });

  if (soldeSysteme) {
    console.log(`💾 Solde dans le système (finance_balances): ${soldeSysteme.balance.toFixed(2)} €`);
    console.log(`   Dernière mise à jour: ${soldeSysteme.createdAt}`);
  } else {
    console.log(`⚠️  Aucun solde trouvé dans finance_balances`);
  }

  // 3. Recalcul du solde basé sur toutes les transactions
  const transactions = await prisma.finance_transactions.findMany({
    orderBy: { date: 'asc' }
  });

  let soldeCalcule = 0;
  let nbCredits = 0;
  let nbDebits = 0;
  let totalCredits = 0;
  let totalDebits = 0;

  for (const tx of transactions) {
    if (tx.type === 'CREDIT') {
      soldeCalcule += tx.amount;
      nbCredits++;
      totalCredits += tx.amount;
    } else if (tx.type === 'DEBIT') {
      soldeCalcule -= tx.amount;
      nbDebits++;
      totalDebits += tx.amount;
    }
  }

  console.log(`\n🧮 Solde CALCULÉ depuis les transactions: ${soldeCalcule.toFixed(2)} €`);
  console.log(`   ${transactions.length} transactions au total`);
  console.log(`   ${nbCredits} crédits: +${totalCredits.toFixed(2)} €`);
  console.log(`   ${nbDebits} débits: -${totalDebits.toFixed(2)} €`);

  // 4. Écart entre système et réalité
  const ecartReel = soldeSysteme ? (soldeSysteme.balance - soldeReelActuel.solde) : 0;
  const ecartCalcule = soldeCalcule - soldeReelActuel.solde;

  console.log(`\n❌ ÉCART avec le solde bancaire RÉEL:`);
  if (soldeSysteme) {
    console.log(`   Système vs Banque: ${ecartReel > 0 ? '+' : ''}${ecartReel.toFixed(2)} €`);
  }
  console.log(`   Calculé vs Banque: ${ecartCalcule > 0 ? '+' : ''}${ecartCalcule.toFixed(2)} €`);

  // 5. Analyse par période
  console.log(`\n📅 ÉVOLUTION DU SOLDE PAR PÉRIODE:\n`);
  console.log(`Date        │ Solde Réel │ Relevé`);
  console.log(`────────────┼────────────┼────────`);
  for (const entry of soldeBancaireReel) {
    console.log(`${entry.date} │ ${entry.solde.toFixed(2).padStart(10, ' ')} € │ ${entry.releve}`);
  }

  // 6. Recommandations
  console.log(`\n💡 RECOMMANDATIONS:\n`);
  
  if (Math.abs(ecartCalcule) > 1) {
    console.log(`⚠️  PROBLÈME: Le solde calculé ne correspond pas au solde bancaire réel`);
    console.log(`   Écart de ${Math.abs(ecartCalcule).toFixed(2)} €`);
    console.log(`\n   Causes possibles:`);
    console.log(`   1. Solde initial incorrect (point de départ)`);
    console.log(`   2. Transactions manquantes ou en double`);
    console.log(`   3. Types de transactions incorrects (CREDIT/DEBIT inversés)`);
    console.log(`   4. Montants incorrects`);
    console.log(`\n   Solutions:`);
    console.log(`   1. Importer TOUTES les transactions depuis avril 2025`);
    console.log(`   2. Vérifier que chaque transaction du relevé est dans le système`);
    console.log(`   3. Initialiser le solde à partir d'un point de référence connu`);
    console.log(`   4. Mettre à jour finance_balances avec le solde réel: ${soldeReelActuel.solde.toFixed(2)} €`);
  } else {
    console.log(`✅ Le solde calculé correspond au solde bancaire réel`);
    console.log(`   Le système est cohérent avec la banque`);
  }

  console.log(`\n====================================\n`);
}

analyzeBankBalance()
  .catch((e) => {
    console.error('❌ Erreur analyse:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
