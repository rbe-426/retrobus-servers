/**
 * Script pour vérifier le rôle et les permissions de n.bayoudh
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUserRole() {
  try {
    console.log('🔍 Recherche de l\'utilisateur n.bayoudh...');
    
    // Chercher dans members
    const member = await prisma.members.findFirst({
      where: {
        matricule: 'n.bayoudh'
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        matricule: true,
        role: true,
        permissions: true,
        membershipStatus: true
      }
    });

    if (!member) {
      console.error('❌ Utilisateur non trouvé dans members');
    } else {
      console.log('✅ Utilisateur trouvé dans members:');
      console.log(JSON.stringify(member, null, 2));
    }

    // Chercher dans site_users
    const siteUser = await prisma.site_users.findFirst({
      where: {
        username: 'n.bayoudh'
      },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true
      }
    });

    if (!siteUser) {
      console.log('⚠️  Utilisateur non trouvé dans site_users');
    } else {
      console.log('✅ Utilisateur trouvé dans site_users:');
      console.log(JSON.stringify(siteUser, null, 2));
    }

    console.log('\n📋 Rôles autorisés pour upload avatar:');
    console.log('- ADMIN');
    console.log('- PRESIDENT');
    console.log('- VICE_PRESIDENT');
    console.log('- TRESORIER');
    console.log('- SECRETAIRE_GENERAL');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserRole();
