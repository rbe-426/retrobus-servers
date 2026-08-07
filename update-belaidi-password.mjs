import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const password = 'Waiyl9134#';

try {
  console.log('🔐 Updating password for w.belaidi...\n');

  const res = await pool.query(
    'UPDATE site_users SET password = $1, "updatedAt" = $2 WHERE email = $3 RETURNING id, email, username',
    [password, new Date(), 'belaidiw91@gmail.com']
  );

  if (res.rowCount > 0) {
    const user = res.rows[0];
    console.log('✅ Password updated successfully!');
    console.log('   ID:', user.id);
    console.log('   Email:', user.email);
    console.log('   Username:', user.username);
  } else {
    console.log('❌ User not found');
  }

} catch (e) {
  console.error('❌ Error:', e.message);
} finally {
  pool.end();
}
