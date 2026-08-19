import bcrypt from 'bcrypt';

/**
 * Script pour générer un hash de mot de passe pour Le Musée
 * 
 * Usage: node scripts/generate-musee-password.mjs "VotreMotDePasse"
 */

const password = process.argv[2];

if (!password) {
  console.error('❌ Erreur: Veuillez fournir un mot de passe');
  console.log('Usage: node scripts/generate-musee-password.mjs "VotreMotDePasse"');
  process.exit(1);
}

try {
  console.log('🔐 Génération du hash...');
  
  const hash = await bcrypt.hash(password, 10);
  
  console.log('\n✅ Hash généré avec succès!\n');
  console.log('Hash à copier dans musee.routes.js:');
  console.log('━'.repeat(80));
  console.log(hash);
  console.log('━'.repeat(80));
  console.log('\nExemple d\'utilisation:');
  console.log(`{
  id: 'musee-X',
  username: 'votre.username',
  passwordHash: '${hash}',
  role: 'admin',
  createdAt: new Date()
}`);
} catch (error) {
  console.error('❌ Erreur lors de la génération:', error.message);
  process.exit(1);
}
