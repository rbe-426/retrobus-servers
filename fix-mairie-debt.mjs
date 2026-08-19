import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixMairieDebt() {
  try {
    // Trouver la dette MAIRIE CORBEIL
    const debt = await prisma.debt.findFirst({
      where: {
        debtorName: {
          contains: 'CORBEIL',
          mode: 'insensitive'
        },
        type: 'DETTE'
      }
    });

    if (!debt) {
      console.log('❌ Dette MAIRIE CORBEIL non trouvée');
      return;
    }

    console.log('📋 Dette trouvée:', debt.description);
    console.log('   Nature actuelle:', debt.debtNature || 'DETTE_NORMALE');
    
    // Mettre à jour en TROP_PERCU
    await prisma.debt.update({
      where: { id: debt.id },
      data: {
        debtNature: 'TROP_PERCU',
        updatedAt: new Date()
      }
    });

    console.log('✅ Nature changée en TROP_PERCU');
    console.log('\n🔄 Relancez maintenant: node recalculate-debts.mjs');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixMairieDebt();
