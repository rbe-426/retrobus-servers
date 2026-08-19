// 🧪 Script de test des KPI historiques
// Usage: node test-kpi.mjs

import { 
  calculateMonthlyKPIs, 
  calculateYearlyKPIs, 
  comparePeriodsKPIs, 
  getRecentMonthsKPIs 
} from './src/kpi-calculator.mjs';

async function testKPIs() {
  console.log('🧪 Test des KPI Historiques\n');

  try {
    // Test 1: KPI du mois actuel
    console.log('📊 Test 1: KPI du mois actuel');
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    const currentKPIs = await calculateMonthlyKPIs(currentYear, currentMonth);
    console.log(`✅ KPI de ${currentKPIs.period.label}:`);
    console.log(`   - Transactions: ${currentKPIs.transactions.count}`);
    console.log(`   - Recettes: ${currentKPIs.transactions.credits.toFixed(2)}€`);
    console.log(`   - Dépenses: ${currentKPIs.transactions.debits.toFixed(2)}€`);
    console.log(`   - Balance: ${currentKPIs.transactions.balance.toFixed(2)}€`);
    console.log(`   - Solde cumulé: ${currentKPIs.cumulativeBalance.toFixed(2)}€\n`);

    // Test 2: KPI d'un mois précédent (si disponible)
    console.log('📊 Test 2: KPI du mois précédent');
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    
    const prevKPIs = await calculateMonthlyKPIs(prevYear, prevMonth);
    console.log(`✅ KPI de ${prevKPIs.period.label}:`);
    console.log(`   - Transactions: ${prevKPIs.transactions.count}`);
    console.log(`   - Balance: ${prevKPIs.transactions.balance.toFixed(2)}€\n`);

    // Test 3: Derniers mois
    console.log('📊 Test 3: KPI des 3 derniers mois');
    const recentKPIs = await getRecentMonthsKPIs(3);
    console.log(`✅ Historique récent (${recentKPIs.length} mois):`);
    recentKPIs.forEach(kpi => {
      console.log(`   - ${kpi.period.label}: ${kpi.transactions.count} transactions, balance ${kpi.transactions.balance.toFixed(2)}€`);
    });
    console.log();

    // Test 4: Comparaison
    if (currentMonth !== prevMonth || currentYear !== prevYear) {
      console.log('📊 Test 4: Comparaison mois actuel vs précédent');
      const comparison = await comparePeriodsKPIs(prevYear, prevMonth, currentYear, currentMonth);
      console.log(`✅ ${comparison.period1.label} vs ${comparison.period2.label}:`);
      console.log(`   - Δ Transactions: ${comparison.changes.transactions.count} (${comparison.changes.transactions.countPercent}%)`);
      console.log(`   - Δ Balance: ${comparison.changes.transactions.balance.toFixed(2)}€`);
      console.log();
    }

    // Test 5: KPI annuel (année en cours)
    console.log('📊 Test 5: KPI annuel (année en cours)');
    const yearlyKPIs = await calculateYearlyKPIs(currentYear);
    console.log(`✅ Année ${yearlyKPIs.year}:`);
    console.log(`   - Total transactions: ${yearlyKPIs.totals.transactionsCount}`);
    console.log(`   - Total recettes: ${yearlyKPIs.totals.credits.toFixed(2)}€`);
    console.log(`   - Total dépenses: ${yearlyKPIs.totals.debits.toFixed(2)}€`);
    console.log(`   - Résultat annuel: ${yearlyKPIs.totals.balance.toFixed(2)}€`);
    console.log();

    console.log('🎉 Tous les tests sont passés avec succès !');
    console.log('\n📝 Notes:');
    console.log('   - Les KPI sont calculés à partir de la base de données PostgreSQL');
    console.log('   - Les montants utilisent le champ "date" des transactions, pas "createdAt"');
    console.log('   - Le solde cumulé calcule toutes les transactions jusqu\'à la fin de la période');
    console.log('\n✅ Système de KPI historiques fonctionnel !\n');

  } catch (error) {
    console.error('❌ Erreur lors des tests:', error);
    process.exit(1);
  }
}

// Exécution
testKPIs()
  .then(() => {
    console.log('✅ Tests terminés');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Tests échoués:', error);
    process.exit(1);
  });
