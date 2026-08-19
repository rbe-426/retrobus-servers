/**
 * Script: Tester le filtrage des permissions
 * Simule l'appel API pour charger les permissions et vérifie le DENY
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CARD_RESOURCES = {
  'RETRO_DEMANDES': 'RétroDemandes',
  'VEHICLES': 'RétroBus',
  'FINANCE': 'Gestion Financière',
  'EVENTS': 'Gestion des Événements',
  'MEMBERS': 'Gérer les adhésions',
  'ADHESION_MANAGEMENT': 'Édition des Adhésions',
  'STOCK': 'Gestion des Stocks',
  'RETROMERCH': 'Gestion RétroMerch',
  'NEWSLETTER': 'Gestion Newsletter',
  'SITE_MANAGEMENT': 'Gestion du Site',
  'RETROSUPPORT': 'RétroSupport'
};

async function testPermissionFiltering() {
  try {
    console.log('\n🧪 Test du filtrage des permissions\n');

    // Récupérer tous les membres avec permissions
    const members = await prisma.members.findMany({
      where: {
        permissions: {
          not: null
        }
      }
    });

    for (const member of members) {
      console.log(`\n👤 Utilisateur: ${member.firstName || member.name}`);
      console.log(`   Email: ${member.email}`);
      console.log(`   ID: ${member.id}\n`);

      const perms = member.permissions;
      
      if (perms && perms.blockedResources && Array.isArray(perms.blockedResources)) {
        // Simuler la transformation que l'API fait
        const convertedPermissions = perms.blockedResources.map(resource => ({
          resource,
          actions: ['DENY'],
          reason: 'Restrictive mode enabled'
        }));

        console.log(`   📋 Permissions converties pour le frontend (${convertedPermissions.length}):`);
        convertedPermissions.forEach(p => {
          const cardName = CARD_RESOURCES[p.resource];
          console.log(`      ├─ ${p.resource}`);
          console.log(`      │  actions: ${p.actions.join(', ')}`);
          console.log(`      │  carte: ${cardName || '⚠️ UNKNOWN'}`);
        });

        // Simuler le filtrage dans MyRBE.jsx
        console.log(`\n   🔒 Résultat du filtrage (shouldShowCard):`);
        Object.entries(CARD_RESOURCES).forEach(([resource, cardName]) => {
          const isDenied = convertedPermissions.some(p =>
            p.resource === resource && p.actions && p.actions.includes('DENY')
          );
          const status = isDenied ? '❌ BLOQUÉ' : '✅ VISIBLE';
          console.log(`      ${resource.padEnd(25)} (${cardName.padEnd(30)}) → ${status}`);
        });
      }
    }

    console.log('\n\n✨ Test terminé!');
    console.log('   Les permissions devraient maintenant se refléter correctement dans MyRBE');
    
  } catch (e) {
    console.error('❌ Erreur:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

testPermissionFiltering();
