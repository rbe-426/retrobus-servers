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

console.log('🔍 STRUCTURE DES TABLES\n');

const tables = [
  'finance_categories',
  'finance_balances',
  'finance_transactions',
  'finance_expense_reports'
];

for (const table of tables) {
  console.log(`\n📋 ${table}:`);
  const cols = await c.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = $1
    ORDER BY ordinal_position
  `, [table]);
  
  cols.rows.forEach(col => {
    const nullable = col.is_nullable === 'YES' ? '(nullable)' : '(NOT NULL)';
    console.log(`  - ${col.column_name}: ${col.data_type} ${nullable}`);
  });
}

await c.end();
