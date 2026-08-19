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

console.log('📝 ===== VÉRIFICATION NOTES DE FRAIS =====\n');

// Vérifier la structure de la table
console.log('Colonnes de finance_expense_reports:');
const cols = await c.query(`
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'finance_expense_reports'
  ORDER BY ordinal_position
`);
cols.rows.forEach(col => {
  console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : ''}`);
});

console.log('\n📊 DONNÉES ACTUELLES:');
const expRes = await c.query('SELECT COUNT(*) as count FROM finance_expense_reports');
console.log(`Total notes: ${expRes.rows[0].count}`);

// Afficher les notes existantes
if (expRes.rows[0].count > 0) {
  const samples = await c.query(`
    SELECT id, description, amount, status, date, "createdAt", "requestedByEmail"
    FROM finance_expense_reports
    ORDER BY "createdAt" DESC
    LIMIT 5
  `);
  samples.rows.forEach((r, i) => {
    console.log(`\n  ${i+1}. ${r.description}`);
    console.log(`     Montant: ${r.amount}€ | Status: ${r.status}`);
    console.log(`     Par: ${r.requestedByEmail || 'N/A'}`);
    console.log(`     Date: ${new Date(r.date).toLocaleDateString('fr-FR')}`);
  });
}

console.log('\n✅ Vérification complète');
await c.end();
