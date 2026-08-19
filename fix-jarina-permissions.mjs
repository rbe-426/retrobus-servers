import pkg from '@prisma/client';
import { randomUUID } from 'crypto';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

async function fixJarinaPermissions() {
  console.log('🔧 Correction des permissions pour Jarina...\n');

  try {
    // Trouver Jarina
    const jarina = await prisma.site_users.findUnique({
      where: { username: 'j.amolot' }
    });

    if (!jarina) {
      console.log('❌ Jarina non trouvée');
      return;
    }

    console.log(`✅ Trouvée: ${jarina.firstname} ${jarina.lastname} (${jarina.username})`);

    // Mettre à jour customPermissions avec les NOUVEAUX noms
    const updatedPermissions = {
      blockedResources: [
        'FINANCE',
        'RETRO_DEMANDES',
        'MEMBERS',
        'ADHESION_MANAGEMENT',
        'SITE_MANAGEMENT',
        'RETROMERCH',
        'NEWSLETTER'
      ],
      restrictiveMode: true,
      grantedAt: new Date().toISOString(),
      grantedBy: 'ADMIN_SCRIPT_FIX'
    };

    const updated = await prisma.site_users.update({
      where: { username: 'j.amolot' },
      data: {
        customPermissions: JSON.stringify(updatedPermissions)
      }
    });

    console.log('\n✅ customPermissions mis à jour:');
    console.log(typeof updated.customPermissions === 'string' 
      ? JSON.parse(updated.customPermissions)
      : updated.customPermissions);

    // Maintenant supprimer LES ANCIENNES entrées user_permissions
    const oldPermissions = await prisma.user_permissions.deleteMany({
      where: {
        userId: jarina.id,
        resource: {
          in: ['finances', 'RetroDAO', 'adhésions', 'member_editing', 'site_management', 'RetroMerch', 'newsletter']
        }
      }
    });

    console.log(`\n🗑️  ${oldPermissions.count} anciennes entrées supprimées`);

    // Créer les NOUVELLES entrées avec les bons noms
    const newResources = [
      'FINANCE',
      'RETRO_DEMANDES', 
      'MEMBERS',
      'ADHESION_MANAGEMENT',
      'SITE_MANAGEMENT',
      'RETROMERCH',
      'NEWSLETTER'
    ];

    for (const resource of newResources) {
      await prisma.user_permissions.create({
        data: {
          id: randomUUID(),
          userId: jarina.id,
          resource: resource,
          actions: 'DENY',
          reason: 'Accès restreint - Permission refusée',
          grantedAt: new Date(),
          updatedAt: new Date(),
          grantedBy: 'ADMIN_SCRIPT_FIX'
        }
      });
    }

    console.log(`\n✅ ${newResources.length} NOUVELLES entrées créées avec les bons noms`);
    console.log('\n📋 Nouvelles permissions de Jarina:');
    console.log(newResources.join(', '));

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixJarinaPermissions();
