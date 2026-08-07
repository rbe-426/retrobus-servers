/**
 * Script: Assigner les permissions restrictives aux utilisateurs manquants
 * Utilisateurs: Jaffer, Méthusan, Jarina
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BLOCKED_RESOURCES = [
  'FINANCE',
  'RETRO_DEMANDES',
  'MEMBERS',
  'ADHESION_MANAGEMENT',
  'SITE_MANAGEMENT',
  'RETROMERCH',
  'NEWSLETTER'
];

const TARGET_USERS = ['Jaffer', 'Méthusan', 'Jarina'];

async function addMissingPermissions() {
  try {
    console.log('\n🔐 Attribution des permissions restrictives aux utilisateurs manquants...\n');

    for (const userName of TARGET_USERS) {
      console.log(`\n🔍 Recherche de ${userName}...`);

      // Chercher le membre
      const member = await prisma.members.findFirst({
        where: {
          OR: [
            { firstName: { contains: userName, mode: 'insensitive' } },
            { lastName: { contains: userName, mode: 'insensitive' } }
          ]
        }
      });

      if (member) {
        console.log(`   Trouvé: ${member.firstName || member.name} (${member.email})`);
        
        // Vérifier s'il a déjà des permissions
        if (member.permissions && member.permissions.blockedResources) {
          console.log(`   ⏭️  Permissions existantes: ${member.permissions.blockedResources.join(', ')}`);
        } else {
          // Ajouter les permissions
          const newPermissions = {
            blockedResources: BLOCKED_RESOURCES,
            restrictiveMode: true,
            createdAt: new Date()
          };

          await prisma.members.update({
            where: { id: member.id },
            data: { permissions: newPermissions }
          });

          console.log(`   ✅ Permissions assignées:`);
          console.log(`      - Ressources bloquées: ${BLOCKED_RESOURCES.join(', ')}`);
          console.log(`      - Mode restrictif: OUI\n`);
        }
      } else {
        console.log(`   ❌ Utilisateur non trouvé dans les membres`);
      }
    }

    console.log('\n✨ Attribution terminée!');
    
  } catch (e) {
    console.error('\n❌ Erreur:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

addMissingPermissions();
