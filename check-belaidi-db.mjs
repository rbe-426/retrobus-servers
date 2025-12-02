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

try {
  const res = await c.query("SELECT email, \"firstName\", \"lastName\" FROM members WHERE email LIKE '%belaidi%'");
  console.log('w.belaidi entries:');
  console.table(res.rows);
} finally {
  await c.end();
}
