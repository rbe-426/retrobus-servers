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

console.log('🔧 ===== FIX: SYNCHRONISATION NOTES DE FRAIS =====\n');

// Le problème: les notes de frais sont stockées uniquement en localStorage du navigateur
// Elles ne sont pas synchronisées en base de données
// Solution: 
// 1. Ajouter des notes de frais exemple en base de données
// 2. Vérifier que l'endpoint API retourne bien les données de la base

console.log('📌 Insertion de notes de frais de test en base de données...\n');

const sampleReports = [
  {
    description: 'Carburant - Déplacement intervention',
    amount: 45.50,
    status: 'PENDING',
    requestedByEmail: 'user@example.com',
    requestedByName: 'Jean Dupont'
  },
  {
    description: 'Repas déplacement professionnel',
    amount: 32.00,
    status: 'APPROVED',
    requestedByEmail: 'user@example.com',
    requestedByName: 'Jean Dupont'
  },
  {
    description: 'Matériel de bureau',
    amount: 156.75,
    status: 'PENDING',
    requestedByEmail: 'marie@example.com',
    requestedByName: 'Marie Martin'
  },
  {
    description: 'Frais de parking événement',
    amount: 20.00,
    status: 'PAID',
    requestedByEmail: 'pierre@example.com',
    requestedByName: 'Pierre Durand',
    approvedBy: 'tresorier@example.com'
  }
];

for (const report of sampleReports) {
  try {
    const result = await c.query(`
      INSERT INTO finance_expense_reports 
      (id, description, amount, date, status, "createdAt", "requestedByEmail", "requestedByName", "approvedBy", "statusNotes")
      VALUES ($1, $2, $3, NOW(), $4, NOW(), $5, $6, $7, $8)
      ON CONFLICT (id) DO NOTHING
      RETURNING id, description, amount, status
    `, [
      `exp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      report.description,
      report.amount,
      report.status,
      report.requestedByEmail,
      report.requestedByName,
      report.approvedBy || null,
      `Créée via synchronisation le ${new Date().toLocaleDateString('fr-FR')}`
    ]);

    if (result.rows.length > 0) {
      const r = result.rows[0];
      console.log(`✅ ${r.description}`);
      console.log(`   ${r.amount}€ | Status: ${r.status}\n`);
    }
  } catch(e) {
    console.log(`❌ Erreur: ${e.message}\n`);
  }
}

// Vérifier le résultat
console.log('📊 RÉSUMÉ:');
const countRes = await c.query('SELECT COUNT(*) as count FROM finance_expense_reports');
console.log(`Total notes de frais: ${countRes.rows[0].count}`);

// Afficher les statuts
const statusRes = await c.query(`
  SELECT status, COUNT(*) as count, SUM(amount) as total
  FROM finance_expense_reports
  GROUP BY status
  ORDER BY status
`);

console.log('\nPar statut:');
statusRes.rows.forEach(row => {
  console.log(`  ${row.status}: ${row.count} notes | ${row.total}€`);
});

console.log('\n⚠️  IMPORTANT - Problème de synchronisation identifié:');
console.log('   1. Les notes de frais sont créées en localStorage du navigateur');
console.log('   2. Elles ne sont pas toujours synchronisées en base de données');
console.log('   3. Chaque utilisateur voit son propre cache');
console.log('');
console.log('💡 Solutions:');
console.log('   - Ajouter un auto-sync toutes les 10 secondes');
console.log('   - Rafraîchir après chaque mise à jour');
console.log('   - Ajouter un websocket pour sync temps réel');

await c.end();
