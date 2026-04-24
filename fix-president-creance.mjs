import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixPresidentCreance() {
  try {
    // Trouver la créance président
    const debt = await prisma.debt.findFirst({
      where: {
        debtorName: {
          contains: 'BELAIDI',
          mode: 'insensitive'
        },
        type: 'CRÉANCE'
      }
    });

    if (!debt) {
      console.log('❌ Créance président non trouvée');
      return;
    }

    console.log('📋 Créance trouvée:', debt.description);
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

fixPresidentCreance();
