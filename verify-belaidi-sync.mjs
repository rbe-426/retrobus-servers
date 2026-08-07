import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

try {
  console.log('📋 Checking w.belaidi synchronization...\n');

  // Check members
  const memberRes = await pool.query(
    'SELECT id, email, "firstName", "lastName", role FROM members WHERE email = $1',
    ['belaidiw91@gmail.com']
  );
  
  if (memberRes.rows.length > 0) {
    const m = memberRes.rows[0];
    console.log('✅ In members:');
    console.log('   ID:', m.id);
    console.log('   Email:', m.email);
    console.log('   Name:', m.firstName, m.lastName);
    console.log('   Role:', m.role);
  }

  // Check site_users
  const siteUserRes = await pool.query(
    'SELECT id, email, username, "firstName", "lastName", role FROM site_users WHERE email = $1',
    ['belaidiw91@gmail.com']
  );
  
  if (siteUserRes.rows.length > 0) {
    const s = siteUserRes.rows[0];
    console.log('\n✅ In site_users:');
    console.log('   ID:', s.id);
    console.log('   Email:', s.email);
    console.log('   Username:', s.username);
    console.log('   Name:', s.firstName, s.lastName);
    console.log('   Role:', s.role);
  } else {
    console.log('\n❌ NOT in site_users');
  }

  // Check if they match
  if (memberRes.rows.length > 0 && siteUserRes.rows.length > 0) {
    const m = memberRes.rows[0];
    const s = siteUserRes.rows[0];
    
    console.log('\n📊 Synchronization check:');
    console.log('   Email match:', m.email === s.email ? '✅' : '❌');
    console.log('   Name match:', `${m.firstName} ${m.lastName}` === `${s.firstName} ${s.lastName}` ? '✅' : '❌');
    console.log('   Role match:', m.role === s.role ? '✅' : '❌');
    console.log('   Username:', s.username);
  }

} catch (e) {
  console.error('❌ Error:', e.message);
} finally {
  pool.end();
}
