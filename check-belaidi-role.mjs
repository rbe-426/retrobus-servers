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
  // Check w.belaidi in members table
  const memberRes = await c.query(
    `SELECT id, email, "firstName", "lastName", role, permissions FROM members WHERE email = $1`,
    ['belaidiw91@gmail.com']
  );
  
  console.log('📋 W.BELAIDI in members table:');
  if (memberRes.rows.length > 0) {
    const m = memberRes.rows[0];
    console.log(`  ID: ${m.id}`);
    console.log(`  Email: ${m.email}`);
    console.log(`  Name: ${m.firstName} ${m.lastName}`);
    console.log(`  Role in members: ${m.role}`);
    console.log(`  Permissions: ${JSON.stringify(m.permissions)}`);
    
    // Check if linked to site_users
    const siteUserRes = await c.query(
      `SELECT id, username, role FROM site_users WHERE "linkedMemberId" = $1`,
      [m.id]
    );
    
    if (siteUserRes.rows.length > 0) {
      const su = siteUserRes.rows[0];
      console.log(`\n✅ Linked to site_users:`);
      console.log(`  Username: ${su.username}`);
      console.log(`  Role in site_users: ${su.role}`);
    } else {
      console.log(`\n❌ NOT linked to any site_users record`);
    }
  } else {
    console.log('  ❌ w.belaidi not found in members!');
  }
} catch (e) {
  console.error('❌ Error:', e.message);
} finally {
  await c.end();
}
