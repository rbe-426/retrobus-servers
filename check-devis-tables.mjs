import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  host: 'yamanote.proxy.rlwy.net',
  port: 18663,
  database: 'railway',
  user: 'postgres',
  password: 'kufBlJfvgFQSHCnQyUgVqwGLthMXtyot'
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

  // Check tables with data
  const tables = ['DevisLine', 'QuoteTemplate', 'financial_documents'];
  
  for (const table of tables) {
    const countRes = await client.query(`SELECT COUNT(*) FROM "${table}"`);
    const count = countRes.rows[0].count;
    console.log(`📊 ${table}: ${count} rows`);
    
    if (count > 0) {
      const dataRes = await client.query(`SELECT * FROM "${table}" LIMIT 3`);
      console.log(`  Sample:`, dataRes.rows);
    }
  }
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
