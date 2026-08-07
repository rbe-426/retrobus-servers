/**
 * Script: Vérifier que les permissions bloquées correspondent bien aux cartes MyRBE
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

async function verifyPermissions() {
  try {
    console.log('\n✅ Vérification des permissions syncronisées avec les cartes\n');

    const members = await prisma.members.findMany({
      where: {
        permissions: {
          not: null
        }
      }
    });

    for (const member of members) {
      const perms = member.permissions;
      if (perms && perms.blockedResources) {
        console.log(`\n👤 ${member.firstName || member.name}`);
        console.log(`   Mode restrictif: ${perms.restrictiveMode ? 'OUI' : 'NON'}`);
        console.log(`   Cartes bloquées (${perms.blockedResources.length}):`);
        
        perms.blockedResources.forEach(resource => {
          const cardName = CARD_RESOURCES[resource];
          if (cardName) {
            console.log(`     ✅ ${resource} -> ${cardName}`);
          } else {
            console.log(`     ⚠️  ${resource} -> CARTE NON TROUVÉE`);
          }
        });
      }
    }

    console.log('\n\n📋 Résumé des ressources available:');
    Object.entries(CARD_RESOURCES).forEach(([resource, card]) => {
      console.log(`   ${resource.padEnd(25)} -> ${card}`);
    });

    console.log('\n✨ Vérification terminée!');
    
  } catch (e) {
    console.error('❌ Erreur:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

verifyPermissions();
