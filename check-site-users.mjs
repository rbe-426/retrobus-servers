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

console.log('=== Colonnes de site_users ===');
const colsRes = await c.query('SELECT column_name FROM information_schema.columns WHERE table_name = \'site_users\' ORDER BY ordinal_position');
console.log(colsRes.rows.map(r => r.column_name));

console.log('\n=== Contenu site_users ===');
const usersRes = await c.query('SELECT * FROM site_users LIMIT 5');
console.log(usersRes.rows);

console.log('\n=== members ===');
const membersRes = await c.query('SELECT id, email, "firstName", "lastName" FROM members LIMIT 5');
console.log(membersRes.rows);

await c.end();
