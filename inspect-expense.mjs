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

const cols = await c.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'finance_expense_reports' ORDER BY ordinal_position`);

console.log('Colonnes finance_expense_reports:');
cols.rows.forEach(r => console.log(`  - ${r.column_name}: ${r.data_type}`));

const sample = await c.query('SELECT * FROM finance_expense_reports LIMIT 1');
if (sample.rows.length > 0) {
  console.log('\nPremière note de frais:');
  console.log(JSON.stringify(sample.rows[0], null, 2));
}

await c.end();
