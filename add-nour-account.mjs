import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { pbkdf2Sync } from 'crypto';

const prisma = new PrismaClient();

// Fonction de hachage PBKDF2
function hashPassword(plainPassword) {
  const iterations = 100000;
  const keylen = 64;
  const saltLength = 16;
  
  const salt = crypto.randomBytes(saltLength).toString('hex');
  const hash = pbkdf2Sync(plainPassword, salt, iterations, keylen, 'sha256').toString('hex');
  
  return `${salt}:${hash}:${iterations}`;
}

async function main() {
  console.log('👤 Création du compte Nour Bayoudh...\n');

  try {
    // Générer un mot de passe temporaire
    const tempPassword = 'RBE2025Nour';
    const hashedPassword = hashPassword(tempPassword);

    // Créer l'utilisateur site_users
    const siteUser = await prisma.site_users.create({
      data: {
        id: crypto.randomUUID(),
        username: 'n.bayoudh',
        email: 'n.bayoudh@retrobus-essonne.fr',
        passwordHash: hashedPassword,
        firstName: 'Nour',
        lastName: 'BAYOUDH',
        roles: JSON.stringify(['MEMBER']),
        hasInternalAccess: true,
        hasExternalAccess: false,
        loginEnabled: false,
        isActive: true,
        mustChangePassword: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null
      }
    });

    console.log('✅ Utilisateur site_users créé:');
    console.log(`   • ID: ${siteUser.id}`);
    console.log(`   • Username: ${siteUser.username}`);
    console.log(`   • Email: ${siteUser.email}`);
    console.log(`   • Password provisoire: ${tempPassword}`);
    
    // Créer le profil adhérent
    const member = await prisma.members.create({
      data: {
        id: crypto.randomUUID(),
        firstName: 'Nour',
        lastName: 'BAYOUDH',
        email: 'n.bayoudh@retrobus-essonne.fr',
        matricule: 'BAYOUDH-N',
        membershipType: 'STANDARD',
        membershipStatus: 'ACTIVE',
        membershipStartDate: new Date(),
        hasLinkedAccess: true,
        newsletter: true,
        role: 'MEMBER',
        linkedSiteUserId: siteUser.id,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log('\n✅ Profil adhérent créé:');
    console.log(`   • ID: ${member.id}`);
    console.log(`   • Matricule: ${member.matricule}`);
    console.log(`   • Lié à site_users: ${member.linkedSiteUserId}`);

    console.log('\n' + '='.repeat(80));
    console.log('📋 INFOS DE CONNEXION');
    console.log('='.repeat(80));
    console.log(`\n🔗 Username: n.bayoudh`);
    console.log(`📧 Email: n.bayoudh@retrobus-essonne.fr`);
    console.log(`🔑 Password provisoire: ${tempPassword}`);
    console.log('\n⚠️  L\'utilisateur DOIT changer son mot de passe à la première connexion\n');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
