/**
 * Script: Vérifier l'existence de Nour BAYOUDH dans la base de données
 * Usage: node check-users-nour.mjs
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUsers() {
  try {
    console.log('\n🔍 Vérification de l\'existence de Nour BAYOUDH...\n');

    // Chercher dans site_users (admin users)
    const siteUserNour = await prisma.site_users.findFirst({
      where: {
        OR: [
          { firstName: { contains: 'Nour', mode: 'insensitive' } },
          { lastName: { contains: 'BAYOUDH', mode: 'insensitive' } },
          { email: { contains: 'nour', mode: 'insensitive' } },
          { username: { contains: 'nour', mode: 'insensitive' } }
        ]
      }
    });

    // Chercher dans members (adhérents)
    const memberNour = await prisma.members.findFirst({
      where: {
        OR: [
          { firstName: { contains: 'Nour', mode: 'insensitive' } },
          { lastName: { contains: 'BAYOUDH', mode: 'insensitive' } },
          { email: { contains: 'nour', mode: 'insensitive' } }
        ]
      }
    });

    console.log('📋 RÉSULTATS:\n');

    if (siteUserNour) {
      console.log('✅ Nour BAYOUDH trouvé dans site_users:');
      console.log('   ID:', siteUserNour.id);
      console.log('   Username:', siteUserNour.username);
      console.log('   Email:', siteUserNour.email);
      console.log('   Nom:', siteUserNour.firstName, siteUserNour.lastName);
      console.log('   Rôle:', siteUserNour.role);
      console.log('   Actif:', siteUserNour.isActive);
    } else {
      console.log('❌ Nour BAYOUDH PAS trouvé dans site_users');
    }

    console.log('');

    if (memberNour) {
      console.log('✅ Nour BAYOUDH trouvé dans membres:');
      console.log('   ID:', memberNour.id);
      console.log('   Email:', memberNour.email);
      console.log('   Nom:', memberNour.firstName, memberNour.lastName);
      console.log('   Status:', memberNour.membershipStatus);
      console.log('   Matricule:', memberNour.matricule);
    } else {
      console.log('❌ Nour BAYOUDH PAS trouvé dans membres');
    }

    // Afficher aussi les autres utilisateurs pour contexte
    console.log('\n\n📊 AUTRES UTILISATEURS CIBLES:\n');

    const targetNames = ['Jaffer', 'Méthusan', 'Jarina'];
    
    for (const name of targetNames) {
      const siteUser = await prisma.site_users.findFirst({
        where: {
          OR: [
            { firstName: { contains: name, mode: 'insensitive' } },
            { lastName: { contains: name, mode: 'insensitive' } }
          ]
        }
      });

      const member = await prisma.members.findFirst({
        where: {
          OR: [
            { firstName: { contains: name, mode: 'insensitive' } },
            { lastName: { contains: name, mode: 'insensitive' } }
          ]
        }
      });

      console.log(`\n${name}:`);
      if (siteUser) {
        console.log(`  ✅ site_users: ${siteUser.username} (${siteUser.email})`);
      } else {
        console.log(`  ❌ site_users: non trouvé`);
      }
      
      if (member) {
        console.log(`  ✅ members: ${member.firstName} ${member.lastName} (${member.email})`);
      } else {
        console.log(`  ❌ members: non trouvé`);
      }
    }

    // Afficher la liste complète des utilisateurs pour aide à la configuration
    console.log('\n\n📌 LISTE DE TOUS LES UTILISATEURS DISPONIBLES:\n');

    const allSiteUsers = await prisma.site_users.findMany({
      select: { id: true, username: true, firstName: true, lastName: true, email: true, role: true, isActive: true }
    });

    console.log('=== SITE_USERS (Admin) ===');
    if (allSiteUsers.length === 0) {
      console.log('(aucun utilisateur site_users trouvé)');
    } else {
      allSiteUsers.forEach((user, idx) => {
        console.log(`${idx + 1}. ${user.firstName} ${user.lastName} (@${user.username}) - ${user.email} [${user.role}]`);
      });
    }

    const allMembers = await prisma.members.findMany({
      select: { id: true, firstName: true, lastName: true, email: true, membershipStatus: true, matricule: true }
    });

    console.log('\n=== MEMBERS (Adhérents) ===');
    if (allMembers.length === 0) {
      console.log('(aucun membre trouvé)');
    } else {
      allMembers.forEach((member, idx) => {
        console.log(`${idx + 1}. ${member.firstName} ${member.lastName} - ${member.email} [${member.membershipStatus}]`);
      });
    }

    console.log('\n✅ Vérification complétée!\n');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();
