import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetPresidentCreance() {
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
    console.log('   Nature actuelle:', debt.debtNature);
    
    // Remettre en DETTE_NORMALE
    await prisma.debt.update({
      where: { id: debt.id },
      data: {
        debtNature: 'DETTE_NORMALE',
        updatedAt: new Date()
      }
    });

    console.log('✅ Nature remise en DETTE_NORMALE');
    console.log('\n🔄 Recalcul en cours...\n');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetPresidentCreance();
