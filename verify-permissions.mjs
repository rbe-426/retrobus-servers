/**
 * Script: Vérifier les permissions assignées
 * Usage: node verify-permissions.mjs
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TARGET_USERS = ['Jaffer', 'Méthusan', 'Jarina', 'Nour BAYOUDH'];

async function verifyPermissions() {
  try {
    console.log('\n🔍 Vérification des permissions assignées...\n');

    for (const userName of TARGET_USERS) {
      console.log(`\n📝 Vérification pour ${userName}:\n`);

      // Chercher en site_users
      const siteUser = await prisma.site_users.findFirst({
        where: {
          OR: [
            { firstName: { contains: userName, mode: 'insensitive' } },
            { lastName: { contains: userName, mode: 'insensitive' } }
          ]
        },
        include: {
          user_permissions: true
        }
      });

      // Chercher en members
      const member = await prisma.members.findFirst({
        where: {
          OR: [
            { firstName: { contains: userName, mode: 'insensitive' } },
            { lastName: { contains: userName, mode: 'insensitive' } }
          ]
        }
      });

      if (siteUser) {
        console.log(`✅ ${siteUser.firstName} ${siteUser.lastName} (site_users)`);
        console.log(`   Email: ${siteUser.email}`);
        console.log(`   Username: ${siteUser.username}`);
        console.log(`   Rôle: ${siteUser.role}`);
        
        if (siteUser.customPermissions) {
          const perms = JSON.parse(siteUser.customPermissions);
          console.log(`   customPermissions JSON: ${siteUser.customPermissions}`);
        }

        if (siteUser.user_permissions && siteUser.user_permissions.length > 0) {
          console.log(`\n   Entrées user_permissions (${siteUser.user_permissions.length}):`);
          siteUser.user_permissions.forEach(perm => {
            console.log(`     - ${perm.resource}: ${perm.actions} (${perm.grantedAt.toLocaleDateString()})`);
            if (perm.reason) {
              console.log(`       Raison: ${perm.reason}`);
            }
          });
        } else {
          console.log(`   ⚠️  Aucune entrée user_permissions trouvée`);
        }
      } else if (member) {
        console.log(`✅ ${member.firstName} ${member.lastName} (member)`);
        console.log(`   Email: ${member.email}`);
        console.log(`   Matricule: ${member.matricule}`);
        console.log(`   Status: ${member.membershipStatus}`);
        
        if (member.permissions) {
          const perms = JSON.stringify(member.permissions, null, 2);
          console.log(`   Permissions JSON:`);
          console.log(perms.split('\n').map(l => '   ' + l).join('\n'));
        } else {
          console.log(`   ⚠️  Aucune permission JSON trouvée`);
        }
      } else {
        console.log(`❌ ${userName} non trouvé`);
      }
    }

    // Statistiques globales
    console.log('\n\n📊 STATISTIQUES GLOBALES:\n');

    const totalPermissions = await prisma.user_permissions.count();
    const permissionsByAction = await prisma.user_permissions.groupBy({
      by: ['actions'],
      _count: {
        id: true
      }
    });

    console.log(`Total des entrées user_permissions: ${totalPermissions}`);
    console.log(`Répartition par action:`);
    permissionsByAction.forEach(group => {
      console.log(`  ${group.actions}: ${group._count.id}`);
    });

    // Permissions DENY
    const denyPermissions = await prisma.user_permissions.findMany({
      where: {
        actions: 'DENY'
      },
      include: {
        site_users: {
          select: { username: true, firstName: true, lastName: true }
        }
      }
    });

    console.log(`\nPermissions DENY (REFUSÉES): ${denyPermissions.length}`);
    if (denyPermissions.length > 0) {
      const groupedByUser = {};
      denyPermissions.forEach(perm => {
        const key = `${perm.site_users.firstName} ${perm.site_users.lastName} (@${perm.site_users.username})`;
        if (!groupedByUser[key]) {
          groupedByUser[key] = [];
        }
        groupedByUser[key].push(perm.resource);
      });

      Object.entries(groupedByUser).forEach(([user, resources]) => {
        console.log(`  ${user}:`);
        resources.forEach(resource => {
          console.log(`    - ${resource}`);
        });
      });
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verifyPermissions();
