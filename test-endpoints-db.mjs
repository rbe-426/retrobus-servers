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

console.log('🔍 Vérification endpoints:\n');

// Tester les endpoints qui appellent la base
const testEndpoints = [
  { name: 'Balance', url: '/api/finance/balance', test: 'solde' },
  { name: 'Transactions', url: '/api/finance/transactions', test: 'transactions' },
  { name: 'Expense Reports', url: '/api/finance/expense-reports', test: 'expense reports' },
  { name: 'Categories', url: '/api/finance/categories', test: 'categories' }
];

console.log('Données en base de données:\n');

// Vérifier directement en base
const balRes = await c.query('SELECT * FROM finance_balances LIMIT 1');
console.log(`✅ finance_balances: ${balRes.rows.length} enregistrement(s)`);
if (balRes.rows.length > 0) {
  const row = balRes.rows[0];
  console.log(`   - ID: ${row.id}`);
  console.log(`   - Balance: ${row.balance}€`);
  console.log(`   - isLocked: ${row.isLocked}`);
}

const txRes = await c.query('SELECT COUNT(*) as count FROM finance_transactions');
console.log(`✅ finance_transactions: ${txRes.rows[0].count} enregistrement(s)`);

const expRes = await c.query('SELECT COUNT(*) as count FROM finance_expense_reports');
console.log(`✅ finance_expense_reports: ${expRes.rows[0].count} enregistrement(s)`);

const catRes = await c.query('SELECT COUNT(*) as count FROM finance_categories');
console.log(`✅ finance_categories: ${catRes.rows[0].count} enregistrement(s)`);

console.log('\n💡 Si les endpoints ne retournent rien:');
console.log('   1. Vérifier les logs du serveur');
console.log('   2. Vérifier la connexion Prisma');
console.log('   3. Vérifier le token d\'authentification');

await c.end();
