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
  // Get w.belaidi member
  const memberRes = await c.query('SELECT id, email, permissions FROM members WHERE email = $1', ['belaidiw91@gmail.com']);
  console.log('Current w.belaidi permissions:');
  console.log(JSON.stringify(memberRes.rows[0], null, 2));
} finally {
  await c.end();
}
