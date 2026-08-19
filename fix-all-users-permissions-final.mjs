import pkg from '@prisma/client';
import { randomUUID } from 'crypto';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

async function fixAllUsers() {
  console.log('🔧 Correction des permissions pour ALL USERS...\n');

  const users = [
    { username: 'jsalim.camaroudine', name: 'Jaffer' },
    { username: 'm.ravichandran', name: 'Méthusan' },
    { username: 'j.amolot', name: 'Jarina' },
    // Nour BAYOUDH sera traité en dernier
  ];

  const targetResources = [
    'FINANCE',
    'RETRO_DEMANDES',
    'MEMBERS',
    'ADHESION_MANAGEMENT',
    'SITE_MANAGEMENT',
    'RETROMERCH',
    'NEWSLETTER'
  ];

  try {
    for (const user of users) {
      console.log(`\n📝 Traitement de ${user.name} (${user.username})...`);
      
      const siteUser = await prisma.site_users.findUnique({
        where: { username: user.username }
      });

      if (!siteUser) {
        console.log(`  ❌ Non trouvé`);
        continue;
      }

      // 1. Mettre à jour customPermissions
      const updatedPermissions = {
        blockedResources: targetResources,
        restrictiveMode: true,
        grantedAt: new Date().toISOString(),
        grantedBy: 'ADMIN_SCRIPT_FIX'
      };

      await prisma.site_users.update({
        where: { id: siteUser.id },
        data: {
          customPermissions: JSON.stringify(updatedPermissions)
        }
      });

      console.log(`  ✅ customPermissions mis à jour`);

      // 2. Supprimer les anciennes permissions (avec anciens noms)
      const oldResourcesNames = ['finances', 'RetroDAO', 'adhésions', 'member_editing', 'site_management', 'RetroMerch', 'newsletter'];
      
      const deletedOld = await prisma.user_permissions.deleteMany({
        where: {
          userId: siteUser.id,
          resource: {
            in: oldResourcesNames
          }
        }
      });

      console.log(`  🗑️  ${deletedOld.count} anciennes entrées supprimées`);

      // 3. Vérifier quelles nouvelles permissions existent déjà
      const existing = await prisma.user_permissions.findMany({
        where: {
          userId: siteUser.id,
          resource: {
            in: targetResources
          }
        }
      });

      const existingResources = existing.map(p => p.resource);
      const missingResources = targetResources.filter(r => !existingResources.includes(r));

      console.log(`  ✅ ${existingResources.length} nouvelles permissions existent`);

      // 4. Créer les permissions manquantes
      if (missingResources.length > 0) {
        for (const resource of missingResources) {
          await prisma.user_permissions.create({
            data: {
              id: randomUUID(),
              userId: siteUser.id,
              resource: resource,
              actions: 'DENY',
              reason: 'Accès restreint - Permission refusée',
              grantedAt: new Date(),
              updatedAt: new Date(),
              grantedBy: 'ADMIN_SCRIPT_FIX'
            }
          });
        }
        console.log(`  ➕ ${missingResources.length} permissions manquantes créées`);
      }
    }

    console.log('\n\n📊 RÉSUMÉ FINAL:');
    console.log('================\n');

    for (const user of users) {
      const siteUser = await prisma.site_users.findUnique({
        where: { username: user.username }
      });

      if (!siteUser) continue;

      const perms = await prisma.user_permissions.findMany({
        where: { userId: siteUser.id }
      });

      console.log(`${user.name} (${user.username}): ${perms.length} permissions`);
      perms.forEach(p => {
        console.log(`  - ${p.resource}: ${p.actions}`);
      });
      console.log('');
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixAllUsers();
