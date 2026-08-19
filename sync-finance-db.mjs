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

console.log('🔄 ===== SYNCHRONISATION DONNÉES FINANCIÈRES =====\n');

// 1. Insérer les catégories manquantes
console.log('📌 Catégories...');
const categories = [
  { id: 'adhesion', name: 'Adhésions', type: 'recette', color: '#4CAF50' },
  { id: 'facture_chorus', name: 'Facture Chorus Pro', type: 'recette', color: '#2196F3' },
  { id: 'assurance', name: 'Assurance', type: 'depense', color: '#FF9800' },
  { id: 'depenses_admin', name: 'Dépenses administratives', type: 'depense', color: '#F44336' },
  { id: 'echeancier', name: 'Échéancier', type: 'depense', color: '#9C27B0' },
  { id: 'frais_evenement', name: 'Frais événement', type: 'depense', color: '#00BCD4' }
];

for (const cat of categories) {
  try {
    await c.query(
      `INSERT INTO finance_categories (id, name, type, color, description, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [cat.id, cat.name, cat.type, cat.color, cat.name]
    );
  } catch(e) {
    console.log(`   ⚠️  ${cat.name}: ${e.message}`);
  }
}
const catRes = await c.query('SELECT COUNT(*) as count FROM finance_categories');
console.log(`   ✅ ${catRes.rows[0].count} catégories\n`);

// 2. Créer le solde initial
console.log('💰 Solde...');
const balRes = await c.query('SELECT COUNT(*) as count FROM finance_balances');
if (balRes.rows[0].count === 0) {
  // Calculer depuis les transactions
  const txRes = await c.query(`
    SELECT COALESCE(SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE -amount END), 0) as balance
    FROM finance_transactions
  `);
  const balance = txRes.rows[0].balance || 0;
  
  try {
    await c.query(
      `INSERT INTO finance_balances (id, balance, "isLocked", "createdAt")
       VALUES ($1, $2, false, NOW())`,
      [`bal_${Date.now()}`, balance]
    );
    console.log(`   ✅ Solde créé: ${balance}€\n`);
  } catch(e) {
    console.log(`   ⚠️  ${e.message}\n`);
  }
} else {
  console.log(`   ✅ Solde existant\n`);
}

// 3. Résumé
console.log('📊 RÉSUMÉ FINAL:');
const summary = await c.query(`
  SELECT
    (SELECT COUNT(*) FROM finance_transactions) as transactions,
    (SELECT COUNT(*) FROM finance_categories) as categories,
    (SELECT COUNT(*) FROM finance_balances) as balances,
    (SELECT COUNT(*) FROM finance_expense_reports) as expense_reports,
    (SELECT COALESCE(SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE -amount END), 0) FROM finance_transactions) as balance
`);

const row = summary.rows[0];
console.log(`  📋 Transactions: ${row.transactions}`);
console.log(`  🏷️  Catégories: ${row.categories}`);
console.log(`  💰 Soldes: ${row.balances}`);
console.log(`  📝 Notes de frais: ${row.expense_reports}`);
console.log(`  💵 Solde calculé: ${row.balance}€`);

console.log('\n✅ Synchronisation complète!');
await c.end();
