import { PrismaClient } from '@prisma/client';
import { hashPasswordForStorage, verifyPassword, generateTemporaryPassword } from './src/lib/passwordUtils.js';

const prisma = new PrismaClient();

async function fixNourPassword() {
  console.log('🔧 Correction du mot de passe de Nour\n');

  try {
    // 1. Trouver Nour dans members
    const nourMember = await prisma.members.findFirst({
      where: {
        OR: [
          { firstName: { contains: 'Nour', mode: 'insensitive' } },
          { lastName: { contains: 'Bayoudh', mode: 'insensitive' } }
        ]
      }
    });

    if (!nourMember) {
      console.log('❌ Nour non trouvée dans members');
      return;
    }

    console.log('📋 Compte members:');
    console.log('   ID:', nourMember.id);
    console.log('   Email:', nourMember.email);
    console.log('   Matricule:', nourMember.matricule);
    console.log('   Hash actuel:', nourMember.password.substring(0, 50) + '...');

    // 2. Trouver Nour dans site_users
    const nourSiteUser = await prisma.site_users.findFirst({
      where: { linkedMemberId: nourMember.id }
    });

    if (nourSiteUser) {
      console.log('\n🔐 Compte site_users:');
      console.log('   ID:', nourSiteUser.id);
      console.log('   Email:', nourSiteUser.email);
      console.log('   Hash actuel:', nourSiteUser.password.substring(0, 50) + '...');
    } else {
      console.log('\n⚠️ Pas de compte site_users lié');
    }

    // 3. Comparer les hash
    if (nourSiteUser) {
      const sameHash = nourMember.password === nourSiteUser.password;
      console.log('\n🔍 Comparaison des hash:', sameHash ? '✅ IDENTIQUES' : '❌ DIFFÉRENTS');
      
      if (!sameHash) {
        console.log('\n⚠️ PROBLÈME DÉTECTÉ: Les deux comptes ont des mots de passe différents!');
        console.log('   Cela explique pourquoi la connexion échoue.');
      }
    }

    // 4. Générer un nouveau mot de passe et synchroniser les deux comptes
    console.log('\n🔄 Génération d\'un nouveau mot de passe temporaire...');
    const newPassword = generateTemporaryPassword();
    const newHash = hashPasswordForStorage(newPassword);

    console.log('   Nouveau mot de passe:', newPassword);
    console.log('   Nouveau hash:', newHash.substring(0, 50) + '...');

    // 5. Mettre à jour members
    await prisma.members.update({
      where: { id: nourMember.id },
      data: {
        password: newHash,
        isPasswordTemporary: true,
        mustChangePassword: true,
        updatedAt: new Date()
      }
    });
    console.log('\n✅ Mot de passe mis à jour dans members');

    // 6. Mettre à jour site_users (si existe)
    if (nourSiteUser) {
      await prisma.site_users.update({
        where: { id: nourSiteUser.id },
        data: {
          password: newHash,
          mustChangePassword: true,
          updatedAt: new Date()
        }
      });
      console.log('✅ Mot de passe mis à jour dans site_users');
    }

    console.log('\n🎯 SYNCHRONISATION TERMINÉE');
    console.log('\n📧 Nour peut maintenant se connecter avec:');
    console.log('   Identifiant: ' + nourMember.matricule + ' OU ' + nourMember.email);
    console.log('   Mot de passe: ' + newPassword);
    console.log('\n⚠️ IMPORTANT: Envoyez ce mot de passe à Nour par email!');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

fixNourPassword();
