import pkg from 'pg';
const { Client } = pkg;

const c = new Client({
  host: 'yamanote.proxy.rlwy.net',
  port: 18663,
  user: 'postgres',
  password: 'kufBlJfvgFQSHCnQyUgVqwGLthMXtyot',
  database: 'railway'
});

await c.connect();

console.log('💼 ===== DONNÉES FINANCIÈRES COMPLÈTES =====\n');

// 1. Transactions
console.log('📋 TRANSACTIONS');
const txRes = await c.query(`
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE 0 END) as total_credits,
    SUM(CASE WHEN type = 'DEBIT' THEN amount ELSE 0 END) as total_debits
  FROM finance_transactions
`);
const txStats = txRes.rows[0];
console.log(`   Total: ${txStats.total} | Crédits: ${txStats.total_credits || 0}€ | Débits: ${txStats.total_debits || 0}€`);

const recent = await c.query(`
  SELECT type, amount, description, date
  FROM finance_transactions
  ORDER BY date DESC
  LIMIT 3
`);
console.log(`   Récentes:`);
recent.rows.forEach((t, i) => {
  console.log(`      ${i+1}. [${t.type}] ${t.description} - ${t.amount}€`);
});

// 2. Catégories
console.log('\n🏷️  CATÉGORIES');
const catRes = await c.query('SELECT COUNT(*) as count FROM finance_categories');
console.log(`   Total: ${catRes.rows[0].count}`);
const cats = await c.query('SELECT name, type FROM finance_categories ORDER BY type, name LIMIT 6');
cats.rows.forEach((cat, i) => {
  console.log(`      ${i+1}. ${cat.name} (${cat.type})`);
});

// 3. Solde
console.log('\n💰 SOLDE');
const balRes = await c.query('SELECT id, balance, "isLocked", "createdAt" FROM finance_balances LIMIT 1');
if (balRes.rows.length > 0) {
  const b = balRes.rows[0];
  console.log(`   Solde: ${b.balance}€`);
  console.log(`   Verrouillé: ${b.isLocked ? '🔒 OUI' : '🔓 NON'}`);
  console.log(`   Créé: ${new Date(b.createdAt).toLocaleDateString('fr-FR')}`);
} else {
  console.log(`   ⚠️  Aucun solde`);
}

// 4. Notes de frais
console.log('\n📝 NOTES DE FRAIS');
const expRes = await c.query('SELECT COUNT(*) as count, SUM(amount) as total FROM finance_expense_reports');
const expStats = expRes.rows[0];
console.log(`   Total: ${expStats.count} | Montant: ${expStats.total || 0}€`);

// 5. Simulations
console.log('\n📊 SIMULATIONS');
const simRes = await c.query('SELECT COUNT(*) as count FROM finance_simulation_scenarios');
console.log(`   Scénarios: ${simRes.rows[0].count}`);

// 6. Résumé
console.log('\n✅ RÉSUMÉ:');
console.log(`   📋 ${txStats.total} transactions`);
console.log(`   🏷️  ${catRes.rows[0].count} catégories`);
console.log(`   💰 Solde: ${balRes.rows[0]?.balance || 0}€`);
console.log(`   📝 ${expStats.count} notes de frais`);
console.log(`   📊 ${simRes.rows[0].count} simulations`);

await c.end();
