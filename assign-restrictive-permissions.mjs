/**
 * Script: Assigner les permissions restrictives aux 4 utilisateurs
 * Utilisateurs: Jaffer, Méthusan, Jarina, Nour BAYOUDH
 * 
 * Permissions restrictées (BLOQUÉES):
 * - finances
 * - RetroDAO
 * - adhésions (member management)
 * - site_management
 * - RetroMerch
 * - newsletter
 * 
 * Usage: node assign-restrictive-permissions.mjs
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

// Ressources à bloquer
const RESTRICTED_RESOURCES = [
  'finances',
  'RetroDAO',
  'adhésions',
  'member_editing',
  'site_management',
  'RetroMerch',
  'newsletter'
];

// Utilisateurs cibles
const TARGET_USERS = ['Jaffer', 'Méthusan', 'Jarina', 'Nour'];

async function assignPermissions() {
  try {
    console.log('\n🔐 Attribution des permissions restrictives...\n');

    const assignedUsers = {};

    for (const userName of TARGET_USERS) {
      console.log(`\n📝 Traitement de ${userName}...`);

      // Chercher dans site_users
      let targetUser = await prisma.site_users.findFirst({
        where: {
          OR: [
            { firstName: { contains: userName, mode: 'insensitive' } },
            { lastName: { contains: userName, mode: 'insensitive' } }
          ]
        }
      });

      // Si pas trouvé en site_users, chercher en members
      if (!targetUser) {
        const member = await prisma.members.findFirst({
          where: {
            OR: [
              { firstName: { contains: userName, mode: 'insensitive' } },
              { lastName: { contains: userName, mode: 'insensitive' } }
            ]
          }
        });

        if (member) {
          console.log(`  ✅ Trouvé comme MEMBRE: ${member.firstName} ${member.lastName}`);
          assignedUsers[userName] = {
            type: 'member',
            id: member.id,
            name: `${member.firstName} ${member.lastName}`,
            email: member.email
          };

          // Mettre à jour les permissions JSON du membre
          const restrictedPermissions = {
            blockedResources: RESTRICTED_RESOURCES,
            restrictiveMode: true,
            grantedAt: new Date().toISOString(),
            grantedBy: 'ADMIN_SCRIPT'
          };

          await prisma.members.update({
            where: { id: member.id },
            data: {
              permissions: restrictedPermissions
            }
          });

          console.log(`  ✅ Permissions restrictives assignées au membre`);
          console.log(`     Ressources bloquées: ${RESTRICTED_RESOURCES.join(', ')}`);
        } else {
          console.log(`  ❌ ${userName} non trouvé dans site_users ou members`);
        }
      } else {
        console.log(`  ✅ Trouvé dans SITE_USERS: ${targetUser.firstName} ${targetUser.lastName}`);
        assignedUsers[userName] = {
          type: 'site_user',
          id: targetUser.id,
          name: `${targetUser.firstName} ${targetUser.lastName}`,
          email: targetUser.email,
          username: targetUser.username
        };

        // Créer les entrées de permissions pour chaque ressource
        for (const resource of RESTRICTED_RESOURCES) {
          try {
            // Supprimer l'entrée existante si elle existe
            await prisma.user_permissions.deleteMany({
              where: {
                userId: targetUser.id,
                resource: resource
              }
            });

            // Créer la nouvelle entrée
            await prisma.user_permissions.create({
              data: {
                id: randomUUID(),
                userId: targetUser.id,
                resource: resource,
                actions: 'DENY',
                grantedAt: new Date(),
                grantedBy: 'ADMIN_SCRIPT',
                reason: 'Accès restrictif - Permission refusée',
                updatedAt: new Date()
              }
            });

            console.log(`  ✅ Permission REFUSÉE pour ressource: ${resource}`);
          } catch (err) {
            if (err.code === 'P2002') {
              // Unique constraint - déjà existant
              console.log(`  ⚠️  Permission existante pour: ${resource} (mise à jour)`);
            } else {
              console.log(`  ❌ Erreur pour ${resource}: ${err.message}`);
            }
          }
        }

        // Mettre aussi à jour le champ customPermissions
        const customPermissions = {
          blockedResources: RESTRICTED_RESOURCES,
          restrictiveMode: true,
          grantedAt: new Date().toISOString(),
          grantedBy: 'ADMIN_SCRIPT'
        };

        await prisma.site_users.update({
          where: { id: targetUser.id },
          data: {
            customPermissions: JSON.stringify(customPermissions)
          }
        });

        console.log(`  ✅ Permissions restrictives complètes`);
      }
    }

    // Résumé final
    console.log('\n\n📊 RÉSUMÉ D\'ATTRIBUTION:\n');
    Object.entries(assignedUsers).forEach(([name, info]) => {
      console.log(`✅ ${name}`);
      console.log(`   Type: ${info.type}`);
      console.log(`   Nom: ${info.name}`);
      console.log(`   Email: ${info.email}`);
      if (info.username) {
        console.log(`   Username: ${info.username}`);
      }
      console.log(`   Ressources bloquées: ${RESTRICTED_RESOURCES.join(', ')}`);
      console.log('');
    });

    console.log(`\n✅ Permissions restrictives attribuées à ${Object.keys(assignedUsers).length} utilisateur(s)!`);
    console.log(`\nLes utilisateurs avec permissions restrictives ne peuvent accéder à:`);
    RESTRICTED_RESOURCES.forEach(resource => {
      console.log(`   - ${resource}`);
    });

  } catch (error) {
    console.error('❌ Erreur lors de l\'attribution des permissions:', error.message);
    if (error.code) {
      console.error('Code d\'erreur Prisma:', error.code);
    }
  } finally {
    await prisma.$disconnect();
  }
}

assignPermissions();
