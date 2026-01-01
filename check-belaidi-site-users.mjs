import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Check site_users
const res1 = await pool.query('SELECT id, email, role, "firstName", "lastName" FROM site_users WHERE email LIKE $1', ['%belaidi%']);
console.log('📋 In site_users:');
if (res1.rows.length > 0) {
  res1.rows.forEach(row => {
    console.log('  Email:', row.email, '| Role:', row.role, '| Name:', row.firstName, row.lastName);
  });
} else {
  console.log('  ❌ NOT FOUND');
}

// Check members
const res2 = await pool.query('SELECT id, email, role, "firstName", "lastName" FROM members WHERE email LIKE $1', ['%belaidi%']);
console.log('\n📋 In members:');
if (res2.rows.length > 0) {
  res2.rows.forEach(row => {
    console.log('  Email:', row.email, '| Role:', row.role, '| Name:', row.firstName, row.lastName);
  });
} else {
  console.log('  ❌ NOT FOUND');
}

pool.end();
