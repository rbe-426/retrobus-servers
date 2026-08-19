// 🗑️ Script pour remettre à zéro toutes les données financières SAUF l'échéancier
// Usage: node reset-finances.js

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetFinances() {
  console.log('🚀 Début de la remise à zéro des données financières...\n');
  
  try {
    // ⚠️ IMPORTANT: L'ordre de suppression est important à cause des relations
    
    // 1. Supprimer les tables de transaction (qui ont des relations)
    console.log('🗑️ Suppression des catégories de transactions...');
    const deletedTransactionCategories = await prisma.finance_transaction_categories.deleteMany();
    console.log(`   ✅ ${deletedTransactionCategories.count} entrées supprimées\n`);
    
    // 2. Supprimer les transactions financières
    console.log('🗑️ Suppression des transactions financières (finance_transactions)...');
    const deletedFinanceTransactions = await prisma.finance_transactions.deleteMany();
    console.log(`   ✅ ${deletedFinanceTransactions.count} entrées supprimées\n`);
    
    // 3. Supprimer l'ancienne table Transaction
    console.log('🗑️ Suppression des transactions (Transaction - ancienne table)...');
    const deletedTransactions = await prisma.transaction.deleteMany();
    console.log(`   ✅ ${deletedTransactions.count} entrées supprimées\n`);
    
    // 4. Supprimer les dettes
    console.log('🗑️ Suppression des dettes et créances...');
    const deletedDebts = await prisma.debt.deleteMany();
    console.log(`   ✅ ${deletedDebts.count} entrées supprimées\n`);
    
    // 5. Supprimer les rapports de dépenses
    console.log('🗑️ Suppression des rapports de dépenses...');
    const deletedExpenseReports = await prisma.finance_expense_reports.deleteMany();
    console.log(`   ✅ ${deletedExpenseReports.count} entrées supprimées\n`);
    
    // 6. Supprimer les simulations (d'abord les items, puis les scénarios)
    console.log('🗑️ Suppression des items de simulation de dépenses...');
    const deletedSimExpenseItems = await prisma.finance_simulation_expense_items.deleteMany();
    console.log(`   ✅ ${deletedSimExpenseItems.count} entrées supprimées\n`);
    
    console.log('🗑️ Suppression des items de simulation de revenus...');
    const deletedSimIncomeItems = await prisma.finance_simulation_income_items.deleteMany();
    console.log(`   ✅ ${deletedSimIncomeItems.count} entrées supprimées\n`);
    
    console.log('🗑️ Suppression des scénarios de simulation...');
    const deletedSimScenarios = await prisma.finance_simulation_scenarios.deleteMany();
    console.log(`   ✅ ${deletedSimScenarios.count} entrées supprimées\n`);
    
    // 7. Supprimer les catégories financières
    console.log('🗑️ Suppression des catégories financières...');
    const deletedCategories = await prisma.finance_categories.deleteMany();
    console.log(`   ✅ ${deletedCategories.count} entrées supprimées\n`);
    
    // 8. Supprimer les balances
    console.log('🗑️ Suppression de l\'historique des balances...');
    const deletedBalanceHistory = await prisma.finance_balance_history.deleteMany();
    console.log(`   ✅ ${deletedBalanceHistory.count} entrées supprimées\n`);
    
    console.log('🗑️ Suppression des balances...');
    const deletedBalances = await prisma.finance_balances.deleteMany();
    console.log(`   ✅ ${deletedBalances.count} entrées supprimées\n`);
    
    // 9. Supprimer les documents financiers (devis/factures)
    console.log('🗑️ Suppression des lignes de devis...');
    const deletedDevisLines = await prisma.devisLine.deleteMany();
    console.log(`   ✅ ${deletedDevisLines.count} entrées supprimées\n`);
    
    console.log('🗑️ Suppression des lignes de factures...');
    const deletedFactureLines = await prisma.factureLine.deleteMany();
    console.log(`   ✅ ${deletedFactureLines.count} entrées supprimées\n`);
    
    console.log('🗑️ Suppression des documents financiers (devis/factures)...');
    const deletedFinancialDocs = await prisma.financial_documents.deleteMany();
    console.log(`   ✅ ${deletedFinancialDocs.count} entrées supprimées\n`);
    
    // 10. Supprimer les subventions (d'abord les dépenses, puis les campagnes)
    console.log('🗑️ Suppression des dépenses de subvention...');
    const deletedSubventionExpenses = await prisma.subventionExpense.deleteMany();
    console.log(`   ✅ ${deletedSubventionExpenses.count} entrées supprimées\n`);
    
    console.log('🗑️ Suppression des campagnes de subvention...');
    const deletedSubventionCampaigns = await prisma.subventionCampaign.deleteMany();
    console.log(`   ✅ ${deletedSubventionCampaigns.count} entrées supprimées\n`);
    
    // ✅ VÉRIFICATION : L'échéancier est préservé
    const scheduledOpsCount = await prisma.scheduled_operations.count();
    const scheduledPaymentsCount = await prisma.scheduled_operation_payments.count();
    console.log('✅ ÉCHÉANCIER PRÉSERVÉ:');
    console.log(`   📅 ${scheduledOpsCount} opérations planifiées`);
    console.log(`   💰 ${scheduledPaymentsCount} paiements planifiés\n`);
    
    console.log('🎉 Remise à zéro terminée avec succès !');
    console.log('📊 Toutes les données financières ont été supprimées SAUF l\'échéancier.');
    
  } catch (error) {
    console.error('❌ Erreur lors de la remise à zéro:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécution
resetFinances()
  .then(() => {
    console.log('\n✅ Script terminé');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script échoué:', error);
    process.exit(1);
  });
