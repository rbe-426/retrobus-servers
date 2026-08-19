import { PrismaClient } from '@prisma/client';
import { hashPasswordForStorage, verifyPassword, generateTemporaryPassword } from './src/lib/passwordUtils.js';

const prisma = new PrismaClient();

async function testPasswordReset() {
  console.log('🔍 Test de réinitialisation de mot de passe\n');

  try {
    // 1. Générer un mot de passe temporaire
    const tempPassword = generateTemporaryPassword();
    console.log('1️⃣ Mot de passe temporaire généré:', tempPassword);

    // 2. Hasher le mot de passe
    const hashedPassword = hashPasswordForStorage(tempPassword);
    console.log('2️⃣ Hash généré:', hashedPassword.substring(0, 50) + '...');

    // 3. Vérifier que le hash fonctionne
    const isValid = verifyPassword(tempPassword, hashedPassword);
    console.log('3️⃣ Vérification du hash:', isValid ? '✅ OK' : '❌ ÉCHEC');

    if (!isValid) {
      console.error('❌ ERREUR CRITIQUE: Le hash ne correspond pas au mot de passe!');
      return;
    }

    // 4. Tester avec un utilisateur réel (Nour)
    console.log('\n4️⃣ Test avec Nour BAYOUDH...');
    
    const nour = await prisma.members.findFirst({
      where: {
        OR: [
          { firstName: { contains: 'Nour', mode: 'insensitive' } },
          { lastName: { contains: 'Bayoudh', mode: 'insensitive' } }
        ]
      }
    });

    if (!nour) {
      console.log('❌ Nour non trouvée');
      return;
    }

    console.log('   Utilisateur:', nour.firstName, nour.lastName);
    console.log('   Email:', nour.email);
    console.log('   Matricule:', nour.matricule);
    console.log('   Hash actuel:', nour.password.substring(0, 50) + '...');

    // 5. Vérifier que le hash actuel est bien au bon format
    const hashParts = nour.password.split(':');
    console.log('\n5️⃣ Format du hash actuel:');
    console.log('   Parties:', hashParts.length, '(attendu: 3)');
    if (hashParts.length === 3) {
      console.log('   ✅ Format correct (hash:salt:iterations)');
      console.log('   Hash length:', hashParts[0].length);
      console.log('   Salt length:', hashParts[1].length);
      console.log('   Iterations:', hashParts[2]);
    } else {
      console.log('   ❌ Format incorrect!');
    }

    // 6. Tester avec quelques mots de passe
    console.log('\n6️⃣ Test de connexion simulé:');
    
    // Générer un nouveau mot de passe pour le test
    const newPassword = generateTemporaryPassword();
    const newHash = hashPasswordForStorage(newPassword);
    
    console.log('   Nouveau mot de passe test:', newPassword);
    console.log('   Vérification:', verifyPassword(newPassword, newHash) ? '✅ OK' : '❌ ÉCHEC');
    
    // Tester avec un mauvais mot de passe
    console.log('   Mauvais mot de passe:', verifyPassword('wrongpassword', newHash) ? '❌ ACCEPTÉ (PROBLÈME!)' : '✅ REJETÉ (OK)');

    // 7. Vérifier dans site_users aussi
    console.log('\n7️⃣ Vérification dans site_users...');
    const nourSiteUser = await prisma.site_users.findFirst({
      where: { linkedMemberId: nour.id }
    });

    if (nourSiteUser) {
      console.log('   Compte site_users trouvé');
      console.log('   Email:', nourSiteUser.email);
      console.log('   Hash:', nourSiteUser.password.substring(0, 50) + '...');
      
      const siteUserHashParts = nourSiteUser.password.split(':');
      console.log('   Format:', siteUserHashParts.length === 3 ? '✅ Correct' : '❌ Incorrect');
    } else {
      console.log('   ⚠️ Pas de compte site_users lié');
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testPasswordReset();
