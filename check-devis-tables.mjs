import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  host: 'yamanote.proxy.rlwy.net',
  port: 18663,
  database: 'retrobus',
  user: 'postgres',
  password: 'hXjLJGLVlqkQF8f2'
});

try {
  await client.connect();
  
  // Check if devis or facture tables exist
  const res = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND (table_name LIKE '%devis%' OR table_name LIKE '%facture%' OR table_name LIKE '%quote%')
  `);
  
  console.log('📋 Tables contenant "devis", "facture" ou "quote":');
  if (res.rows.length === 0) {
    console.log('❌ Aucune table trouvée');
  } else {
    res.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
  }

  // Also check for generic document table
  const docRes = await client.query(`
    SELECT COUNT(*) FROM "Document"
  `);
  console.log(`\n📄 Documents dans la table Document: ${docRes.rows[0].count}`);
  
  // List all tables
  const allTables = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);
  
  console.log('\n📊 Toutes les tables:');
  allTables.rows.forEach(row => {
    console.log(`  - ${row.table_name}`);
  });

} catch (e) {
  console.error('❌ Erreur:', e.message);
} finally {
  await client.end();
}
