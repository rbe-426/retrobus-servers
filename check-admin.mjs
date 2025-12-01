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

console.log('=== Utilisateurs ===');
const usersRes = await c.query('SELECT id, email, "firstName", "lastName", "membershipStatus", "membershipType" FROM members LIMIT 20');
console.log(usersRes.rows);

console.log('\n=== Permissions actuelles ===');
const permsRes = await c.query(`
  SELECT up.id, up."userId", up.resource, up.actions, m.email
  FROM user_permissions up
  LEFT JOIN members m ON m.id = up."userId"
  LIMIT 50
`);
console.log(permsRes.rows);

await c.end();
