import pkg from 'pg';
const { Client } = pkg;

const c = new Client({
  host: 'yamanote.proxy.rlwy.net',
  port: 18663,
  user: 'postgres',
  password: 'kufBlJfvgFQSHCnQyUgVqwGLthMXtyot',
  database: 'railway'
});

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

console.log('🔍 ===== DIAGNOSTIC SYNCHRONISATION =====\n');

const res = await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");

console.log('📊 Tables avec "finance" ou "expense":');
const financeTables = [];
res.rows.forEach(r => {
  const name = r.table_name;
  if (name.includes('finance') || name.includes('expense')) {
    console.log(`  ✅ ${name}`);
    financeTables.push(name);
  }
});

console.log('\n📋 VÉRIFICATION DES DONNÉES:\n');

// Vérifier chaque table finance
for (const table of financeTables) {
  try {
    const res = await c.query(`SELECT COUNT(*) as count FROM ${table}`);
    const count = res.rows[0].count;
    console.log(`${table}: ${count} enregistrements`);
  } catch(e) {
    console.log(`${table}: ❌ Erreur - ${e.message}`);
  }
}

await c.end();
