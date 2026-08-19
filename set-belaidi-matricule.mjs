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
  // Update w.belaidi with matricule w.belaidi
  const updateRes = await c.query(
    `UPDATE members 
     SET matricule = $1 
     WHERE email = $2
     RETURNING id, email, matricule, "firstName", "lastName"`,
    ['w.belaidi', 'belaidiw91@gmail.com']
  );
  
  console.log('✅ Updated w.belaidi with matricule:');
  console.table(updateRes.rows);
  
} catch (e) {
  console.error('❌ Error:', e.message);
} finally {
  await c.end();
}
