import pkg from 'pg';
import fetch from 'node-fetch';

const { Client } = pkg;

const API_BASE = 'https://attractive-kindness-rbe-serveurs.up.railway.app';

const c = new Client({
  host: 'yamanote.proxy.rlwy.net',
  port: 18663,
  user: 'postgres',
  password: 'kufBlJfvgFQSHCnQyUgVqwGLthMXtyot',
  database: 'railway'
});

await c.connect();

console.log('🔄 ===== MIGRATION DONNÉES FINANCIÈRES =====\n');

// On a déjà 10 transactions en BD
// Récupérons les autres données stockées en localStorage

// Créer une session avec un token admin
async function getFinanceData(endpoint, token = null) {
  const url = `${API_BASE}${endpoint}`;
  const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
  
  try {
    const res = await fetch(url, { headers });
    if (res.ok && res.headers.get('content-type')?.includes('json')) {
      return await res.json();
    }
  } catch(e) {
    console.log(`⚠️  ${endpoint}: ${e.message}`);
  }
  return null;
}

// Insérer les données manquantes
async function insertMissingData() {
  console.log('📋 Vérification des données...\n');

  // 1. Catégories - créer les catégories par défaut si vides
  const cats = await c.query('SELECT COUNT(*) as count FROM finance_categories');
  if (cats.rows[0].count === 0) {
    console.log('📌 Création des catégories par défaut...');
    const categories = [
      { name: 'ADHESION', type: 'recette' },
      { name: 'FACTURE_CHORUS_PRO', type: 'recette' },
      { name: 'ASSURANCE', type: 'depense' },
      { name: 'DÉPENSES_ADMINISTRATIVES', type: 'depense' },
      { name: 'ÉCHEANCIER', type: 'depense' },
      { name: 'FRAIS_EVENEMENT', type: 'depense' }
    ];
    
    for (const cat of categories) {
      await c.query(
        'INSERT INTO finance_categories (id, name, type) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [cat.name.toLowerCase(), cat.name, cat.type]
      );
    }
    console.log(`   ✅ ${categories.length} catégories créées\n`);
  }

  // 2. Vérifier si on a des données partielles
  const txCount = (await c.query('SELECT COUNT(*) as count FROM finance_transactions')).rows[0].count;
  console.log(`✅ Transactions existantes: ${txCount}`);

  // 3. Créer un solde par défaut si vide
  const balCount = (await c.query('SELECT COUNT(*) as count FROM finance_balances')).rows[0].count;
  if (balCount === 0) {
    console.log('💰 Création du solde initial...');
    // Calculer le solde depuis les transactions
    const balRes = await c.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE -amount END), 0) as balance
      FROM finance_transactions
    `);
    const balance = balRes.rows[0].balance || 0;
    
    await c.query(
      'INSERT INTO finance_balances (id, balance, "lastModified", locked) VALUES ($1, $2, NOW(), false)',
      [`bal_${Date.now()}`, balance]
    );
    console.log(`   ✅ Solde initial: ${balance}€\n`);
  }

  // 4. Vérifier les catégories de transactions
  const txCatCount = (await c.query('SELECT COUNT(*) as count FROM finance_transaction_categories')).rows[0].count;
  console.log(`✅ Catégories de transactions: ${txCatCount}`);

  console.log('\n📊 RÉSUMÉ:');
  const summary = await c.query(`
    SELECT
      (SELECT COUNT(*) FROM finance_transactions) as transactions,
      (SELECT COUNT(*) FROM finance_categories) as categories,
      (SELECT COUNT(*) FROM finance_balances) as balances,
      (SELECT COUNT(*) FROM finance_expense_reports) as expense_reports,
      (SELECT COUNT(*) FROM finance_simulation_scenarios) as scenarios
  `);
  
  const row = summary.rows[0];
  console.log(`  📋 Transactions: ${row.transactions}`);
  console.log(`  🏷️  Catégories: ${row.categories}`);
  console.log(`  💰 Soldes: ${row.balances}`);
  console.log(`  📝 Notes de frais: ${row.expense_reports}`);
  console.log(`  📊 Simulations: ${row.scenarios}`);

  console.log('\n✅ Migration complète!');
}

try {
  await insertMissingData();
} catch (error) {
  console.error('❌ Erreur:', error.message);
} finally {
  await c.end();
}
