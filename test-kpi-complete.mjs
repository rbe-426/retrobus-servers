// 🧪 Script de test des KPI historiques - Vue complète
// Usage: node test-kpi-complete.mjs

import { 
  getDataRange,
  getAllPeriodsKPIs 
} from './src/kpi-calculator.mjs';

async function testCompleteKPIs() {
  console.log('🧪 Test KPI Historiques - Vue Complète\n');

  try {
    // 1. Vérifier la plage de données
    console.log('📊 Étape 1: Plage de données disponibles');
    const range = await getDataRange();
    
    if (!range) {
      console.log('❌ Aucune donnée financière trouvée.');
      return;
    }

    console.log(`✅ Données disponibles:`);
    console.log(`   De: ${range.minDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`);
    console.log(`   À:  ${range.maxDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`);
    console.log(`   Total: ${range.totalMonths} mois de données\n`);

    // 2. Récupérer tous les KPI
    console.log('📊 Étape 2: Récupération de tous les KPI mensuels...');
    const allKPIs = await getAllPeriodsKPIs();
    
    console.log(`✅ ${allKPIs.length} périodes chargées\n`);

    // 3. Afficher un tableau récapitulatif
    console.log('📊 Récapitulatif mensuel:');
    console.log('─'.repeat(100));
    console.log(`│ Période           │ Transactions │   Recettes │   Dépenses │    Balance │ Solde cumulé │`);
    console.log('─'.repeat(100));

    let totalCredits = 0;
    let totalDebits = 0;
    let totalTransactions = 0;

    allKPIs.forEach(kpi => {
      const period = kpi.period.label.padEnd(17);
      const txCount = String(kpi.transactions.count).padStart(12);
      const credits = `${kpi.transactions.credits.toFixed(2)}€`.padStart(11);
      const debits = `${kpi.transactions.debits.toFixed(2)}€`.padStart(11);
      const balance = `${kpi.transactions.balance.toFixed(2)}€`.padStart(11);
      const cumulative = `${kpi.cumulativeBalance.toFixed(2)}€`.padStart(13);

      console.log(`│ ${period} │${txCount} │${credits} │${debits} │${balance} │${cumulative} │`);

      totalCredits += kpi.transactions.credits;
      totalDebits += kpi.transactions.debits;
      totalTransactions += kpi.transactions.count;
    });

    console.log('─'.repeat(100));
    console.log(`│ TOTAL             │${String(totalTransactions).padStart(12)} │${`${totalCredits.toFixed(2)}€`.padStart(11)} │${`${totalDebits.toFixed(2)}€`.padStart(11)} │${`${(totalCredits - totalDebits).toFixed(2)}€`.padStart(11)} │              │`);
    console.log('─'.repeat(100));

    // 4. Statistiques avancées
    console.log('\n📈 Statistiques avancées:');
    
    const monthsWithData = allKPIs.filter(kpi => kpi.transactions.count > 0);
    const avgMonthlyCredits = totalCredits / monthsWithData.length;
    const avgMonthlyDebits = totalDebits / monthsWithData.length;
    const avgTransactionsPerMonth = totalTransactions / monthsWithData.length;

    console.log(`   - Mois avec transactions: ${monthsWithData.length}/${allKPIs.length}`);
    console.log(`   - Moyenne recettes/mois: ${avgMonthlyCredits.toFixed(2)}€`);
    console.log(`   - Moyenne dépenses/mois: ${avgMonthlyDebits.toFixed(2)}€`);
    console.log(`   - Moyenne transactions/mois: ${avgTransactionsPerMonth.toFixed(1)}`);
    console.log(`   - Solde final: ${allKPIs[allKPIs.length - 1].cumulativeBalance.toFixed(2)}€`);

    // 5. Meilleur et pire mois
    const bestMonth = monthsWithData.reduce((best, curr) => 
      curr.transactions.balance > best.transactions.balance ? curr : best
    );
    const worstMonth = monthsWithData.reduce((worst, curr) => 
      curr.transactions.balance < worst.transactions.balance ? curr : worst
    );

    console.log(`\n📊 Performances:`);
    console.log(`   - Meilleur mois: ${bestMonth.period.label} (+${bestMonth.transactions.balance.toFixed(2)}€)`);
    console.log(`   - Pire mois: ${worstMonth.period.label} (${worstMonth.transactions.balance.toFixed(2)}€)`);

    // 6. Tendance
    const firstHalf = allKPIs.slice(0, Math.floor(allKPIs.length / 2));
    const secondHalf = allKPIs.slice(Math.floor(allKPIs.length / 2));
    
    const firstHalfBalance = firstHalf.reduce((sum, kpi) => sum + kpi.transactions.balance, 0);
    const secondHalfBalance = secondHalf.reduce((sum, kpi) => sum + kpi.transactions.balance, 0);
    
    const trend = secondHalfBalance > firstHalfBalance ? '📈 Amélioration' : '📉 Dégradation';
    const trendValue = Math.abs(secondHalfBalance - firstHalfBalance);

    console.log(`\n${trend} de ${trendValue.toFixed(2)}€ entre première et deuxième moitié de période`);

    console.log('\n🎉 Analyse complète terminée !\n');

  } catch (error) {
    console.error('❌ Erreur lors de l\'analyse:', error);
    process.exit(1);
  }
}

// Exécution
testCompleteKPIs()
  .then(() => {
    console.log('✅ Test terminé');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test échoué:', error);
    process.exit(1);
  });
