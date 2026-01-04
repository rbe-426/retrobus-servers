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

console.log('💼 ===== RÉCAPITULATIF DONNÉES FINANCIÈRES =====\n');

try {
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
  console.log(`   ✅ ${txStats.total} transactions`);
  console.log(`      • Crédits: ${txStats.total_credits || 0}€`);
  console.log(`      • Débits: ${txStats.total_debits || 0}€`);

  const recent = await c.query(`
    SELECT id, type, amount, description, category, date
    FROM finance_transactions
    ORDER BY date DESC
    LIMIT 5
  `);
  console.log(`   Récentes:`);
  recent.rows.forEach((t, i) => {
    console.log(`      ${i+1}. [${t.type}] ${t.description}`);
    console.log(`         ${t.amount}€ | ${t.category} | ${new Date(t.date).toLocaleDateString('fr-FR')}`);
  });

  // 2. Catégories
  console.log('\n🏷️  CATÉGORIES');
  const catRes = await c.query(`SELECT COUNT(*) as count FROM finance_categories`);
  console.log(`   ✅ ${catRes.rows[0].count} catégories`);
  const cats = await c.query(`SELECT id, name, type FROM finance_categories LIMIT 5`);
  cats.rows.forEach((cat, i) => {
    console.log(`      ${i+1}. ${cat.name} (${cat.type})`);
  });

  // 3. Notes de frais
  console.log('\n📝 NOTES DE FRAIS');
  const expRes = await c.query(`
    SELECT COUNT(*) as total, SUM(amount) as total_amount FROM finance_expense_reports
  `);
  const expStats = expRes.rows[0];
  console.log(`   ✅ ${expStats.total} notes | Total: ${expStats.total_amount || 0}€`);

  const expSample = await c.query(`
    SELECT id, description, amount, status, date
    FROM finance_expense_reports
    ORDER BY date DESC
    LIMIT 3
  `);
  expSample.rows.forEach((e, i) => {
    console.log(`      ${i+1}. ${e.description} - ${e.amount}€ [${e.status}]`);
  });

  // 4. Opérations programmées
  console.log('\n⏰ OPÉRATIONS PROGRAMMÉES');
  try {
    const schedRes = await c.query(`
      SELECT 
        COUNT(*) as total,
        SUM(amount) as total_amount
      FROM finance_scheduled_operations
      WHERE "isActive" = true
    `);
    const schedStats = schedRes.rows[0];
    console.log(`   ✅ ${schedStats.total} actives | Total: ${schedStats.total_amount || 0}€`);

    const schedSample = await c.query(`
      SELECT id, type, description, amount, frequency, "nextDate"
      FROM finance_scheduled_operations
      WHERE "isActive" = true
      ORDER BY "nextDate" ASC
      LIMIT 3
    `);
    schedSample.rows.forEach((s, i) => {
      console.log(`      ${i+1}. [${s.type}] ${s.description}`);
      console.log(`         ${s.amount}€ | ${s.frequency} | Prochaine: ${new Date(s.nextDate).toLocaleDateString('fr-FR')}`);
    });
  } catch(e) {
    console.log(`   ℹ️  Table non disponible`);
  }

  // 5. Documents
  console.log('\n📄 DOCUMENTS (Devis/Factures)');
  const docRes = await c.query(`
    SELECT COUNT(*) as total, SUM(amount) as total_amount FROM finance_documents
  `);
  const docStats = docRes.rows[0];
  console.log(`   ✅ ${docStats.total} documents | Total: ${docStats.total_amount || 0}€`);

  const docSample = await c.query(`
    SELECT id, type, number, title, amount, status
    FROM finance_documents
    ORDER BY "createdAt" DESC
    LIMIT 3
  `);
  docSample.rows.forEach((d, i) => {
    console.log(`      ${i+1}. [${d.type}] ${d.number} - ${d.title}`);
    console.log(`         ${d.amount}€ | ${d.status}`);
  });

  // 6. Solde
  console.log('\n💰 SOLDE');
  try {
    const balRes = await c.query(`SELECT id, balance, "lastModified", locked FROM finance_balances LIMIT 1`);
    if (balRes.rows.length > 0) {
      const b = balRes.rows[0];
      console.log(`   ✅ Solde actuel: ${b.balance}€`);
      console.log(`      Dernier modification: ${new Date(b.lastModified).toLocaleDateString('fr-FR')}`);
      console.log(`      Verrouillé: ${b.locked ? '🔒 OUI' : '🔓 NON'}`);
    }
  } catch(e) {
    console.log(`   ⚠️  Table solde non accessible`);
  }

  // 7. Statistiques globales
  console.log('\n📊 STATISTIQUES GLOBALES');
  const statsRes = await c.query(`
    SELECT
      (SELECT COUNT(*) FROM finance_transactions) as tx_count,
      (SELECT COUNT(*) FROM finance_expense_reports) as exp_count,
      (SELECT COUNT(*) FROM finance_scheduled_operations WHERE "isActive" = true) as sched_active,
      (SELECT COUNT(*) FROM finance_documents) as doc_count,
      (SELECT COUNT(*) FROM finance_categories) as cat_count
  `);
  const stats = statsRes.rows[0];
  console.log(`   📋 Transactions: ${stats.tx_count}`);
  console.log(`   📝 Notes de frais: ${stats.exp_count}`);
  console.log(`   ⏰ Opérations programmées actives: ${stats.sched_active}`);
  console.log(`   📄 Documents: ${stats.doc_count}`);
  console.log(`   🏷️  Catégories: ${stats.cat_count}`);

  console.log('\n✅ Audit terminé!\n');

} catch (error) {
  console.error('❌ Erreur:', error.message);
} finally {
  await c.end();
}
