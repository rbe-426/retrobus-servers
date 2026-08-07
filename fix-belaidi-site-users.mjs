import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Generate a unique ID like the members table
const generateId = () => {
  const timestamp = Date.now();
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${timestamp}_${result}`;
};

try {
  // First, get w.belaidi from members
  const memberRes = await pool.query(
    'SELECT id, email, "firstName", "lastName" FROM members WHERE email = $1',
    ['belaidiw91@gmail.com']
  );

  if (memberRes.rows.length === 0) {
    console.log('❌ w.belaidi not found in members');
    process.exit(1);
  }

  const member = memberRes.rows[0];
  console.log('✅ Found in members:', member.email);

  // Check if already in site_users
  const siteUserRes = await pool.query(
    'SELECT id FROM site_users WHERE email = $1',
    ['belaidiw91@gmail.com']
  );

  if (siteUserRes.rows.length > 0) {
    console.log('⚠️  Already in site_users, updating...');
    // Update the role to ADMIN
    await pool.query(
      'UPDATE site_users SET role = $1 WHERE email = $2',
      ['ADMIN', 'belaidiw91@gmail.com']
    );
    console.log('✅ Updated role to ADMIN');
  } else {
    console.log('➕ Creating new site_users entry...');
    const newId = generateId();
    // Create new entry in site_users
    const insertRes = await pool.query(
      'INSERT INTO site_users (id, email, username, role, password, "firstName", "lastName", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
      [newId, 'belaidiw91@gmail.com', 'w.belaidi', 'ADMIN', '***', member.firstName, member.lastName, new Date(), new Date()]
    );
    console.log('✅ Created site_users entry:', insertRes.rows[0].id);
  }

  // Verify
  const verifyRes = await pool.query(
    'SELECT id, email, role FROM site_users WHERE email = $1',
    ['belaidiw91@gmail.com']
  );
  console.log('✅ Verified in site_users:', verifyRes.rows[0].email, '| Role:', verifyRes.rows[0].role);

} catch (e) {
  console.error('❌ Error:', e.message);
} finally {
  pool.end();
}
