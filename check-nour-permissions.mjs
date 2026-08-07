/**
 * Script: Vérifier les permissions de Nour BAYOUDH spécifiquement
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkNour() {
  try {
    console.log('\n🔍 Vérification des permissions de Nour BAYOUDH...\n');

    const nour = await prisma.members.findFirst({
      where: {
        firstName: { contains: 'Nour', mode: 'insensitive' }
      }
    });

    if (!nour) {
      console.log('❌ Nour BAYOUDH non trouvé');
      return;
    }

    console.log(`✅ Trouvé: ${nour.firstName} ${nour.lastName}`);
    console.log(`   ID: ${nour.id}`);
    console.log(`   Email: ${nour.email}`);
    console.log(`   Matricule: ${nour.matricule}`);
    console.log(`   Status: ${nour.membershipStatus}`);
    console.log(`\n📋 Permissions JSON assignées:`);

    if (nour.permissions) {
      console.log(JSON.stringify(nour.permissions, null, 2));
    } else {
      console.log('⚠️  Aucune permission trouvée');
    }

    console.log(`\n✅ Vérification complétée!`);

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkNour();
