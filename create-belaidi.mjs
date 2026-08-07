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
  // Check if w.belaidi already exists
  const existingRes = await c.query('SELECT id FROM members WHERE email = $1', ['w.belaidi@retrobus.fr']);
  
  if (existingRes.rows.length > 0) {
    console.log('✅ w.belaidi already exists');
  } else {
    // Insert w.belaidi
    const insertRes = await c.query(
      `INSERT INTO members (id, email, "firstName", "lastName", status, "membershipType", "membershipStatus", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        'mem_' + Date.now(),
        'w.belaidi@retrobus.fr',
        'Waiyl',
        'BELAIDI',
        'active',
        'ADMIN',
        'ACTIVE',
        new Date(),
        new Date()
      ]
    );
    console.log('✅ Created w.belaidi:', insertRes.rows[0].id);
  }
  
  // Show all members
  const allRes = await c.query('SELECT id, email, "firstName", "lastName" FROM members LIMIT 10');
  console.log('\n📋 Members:');
  console.table(allRes.rows);
  
} catch (e) {
  console.error('❌ Error:', e.message);
} finally {
  await c.end();
}
