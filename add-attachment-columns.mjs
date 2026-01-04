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

console.log('🔧 Ajout des colonnes pour pièces jointes...\n');

try {
  // Vérifier si les colonnes existent déjà
  const cols = await c.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'finance_expense_reports' 
    AND column_name IN ('attachmentUrl', 'attachmentFileName', 'attachmentType')
  `);

  if (cols.rows.length === 0) {
    console.log('📝 Ajout des colonnes...');
    
    await c.query(`
      ALTER TABLE finance_expense_reports
      ADD COLUMN IF NOT EXISTS "attachmentUrl" TEXT,
      ADD COLUMN IF NOT EXISTS "attachmentFileName" TEXT,
      ADD COLUMN IF NOT EXISTS "attachmentType" TEXT
    `);
    
    console.log('✅ Colonnes ajoutées:');
    console.log('   - attachmentUrl (TEXT)');
    console.log('   - attachmentFileName (TEXT)');
    console.log('   - attachmentType (TEXT)');
  } else {
    console.log('✅ Les colonnes existent déjà');
  }

  // Vérifier la structure finale
  const finalCols = await c.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'finance_expense_reports' 
    ORDER BY ordinal_position
  `);

  console.log('\n📊 Structure finale:');
  finalCols.rows.forEach(r => console.log(`   - ${r.column_name}: ${r.data_type}`));

} catch (error) {
  console.error('❌ Erreur:', error.message);
} finally {
  await c.end();
}
