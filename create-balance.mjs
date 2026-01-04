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

console.log('💰 Création du solde initial...\n');

// Calculer le solde depuis les transactions
const txRes = await c.query(`
  SELECT COALESCE(SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE -amount END), 0) as balance
  FROM finance_transactions
`);

const balance = txRes.rows[0].balance || 0;
console.log(`Solde calculé: ${balance}€\n`);

// Créer le solde
try {
  const res = await c.query(
    `INSERT INTO finance_balances (id, balance, "isLocked", "createdAt")
     VALUES ($1, $2, false, NOW())
     RETURNING *`,
    [`bal_${Date.now()}`, balance]
  );
  console.log('✅ Solde créé:');
  console.log(`   ID: ${res.rows[0].id}`);
  console.log(`   Balance: ${res.rows[0].balance}€`);
  console.log(`   Locked: ${res.rows[0].isLocked}`);
} catch(e) {
  console.error('❌ Erreur:', e.message);
}

await c.end();
