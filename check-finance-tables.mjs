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

const tables = [
  'finance_transactions',
  'finance_categories', 
  'finance_balances',
  'finance_expense_reports',
  'user_permissions'
];

for (const table of tables) {
  const res = await c.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
    [table]
  );
  console.log(`\n=== ${table} ===`);
  console.log(res.rows.map(r => r.column_name));
}

await c.end();
