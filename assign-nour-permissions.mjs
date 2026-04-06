import pkg from '@prisma/client';
import { randomUUID } from 'crypto';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

async function assignNourPermissions() {
  console.log('🔐 Attribution des permissions à Nour BAYOUDH...\n');

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
    const nour = await prisma.members.findFirst({
      where: {
        OR: [
          { firstName: { contains: 'Nour', mode: 'insensitive' } },
          { lastName: { contains: 'Bayoudh', mode: 'insensitive' } }
        ]
      }
    });

    if (!nour) {
      console.log('❌ Nour non trouvé');
      return;
    }

    console.log(`✅ Trouvé: Nour BAYOUDH (${nour.id})\n`);

    // 1. Mettre à jour customPermissions dans la table members
    const customPerms = {
      blockedResources: targetResources,
      restrictiveMode: true,
      grantedAt: new Date().toISOString(),
      grantedBy: 'ADMIN_SCRIPT_FIX'
    };

    await prisma.members.update({
      where: { id: nour.id },
      data: {
        customPermissions: JSON.stringify(customPerms)
      }
    });

    console.log('✅ customPermissions mis à jour dans members table\n');

    // 2. Créer les 7 entrées dans user_permissions
    for (const resource of targetResources) {
      await prisma.user_permissions.create({
        data: {
          id: randomUUID(),
          userId: nour.id,
          resource: resource,
          actions: 'DENY',
          reason: 'Accès restreint - Permission refusée',
          grantedAt: new Date(),
          updatedAt: new Date(),
          grantedBy: 'ADMIN_SCRIPT_FIX'
        }
      });
    }

    console.log(`✅ ${targetResources.length} permissions créées dans user_permissions:\n`);

    // 3. Afficher les permissions finales
    const perms = await prisma.user_permissions.findMany({
      where: { userId: nour.id }
    });

    console.log('📋 Permissions finales de Nour BAYOUDH:');
    perms.forEach(p => {
      console.log(`   - ${p.resource}: ${p.actions}`);
    });

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

assignNourPermissions();
