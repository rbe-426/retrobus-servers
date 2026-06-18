import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetTrafficData() {
  console.log('🗑️  Réinitialisation des données de trafic...');

  try {
    // Supprimer tous les événements de trafic
    const result = await prisma.analyticsTrafficEvent.deleteMany({});
    
    console.log(`✅ ${result.count} événements supprimés avec succès`);
    console.log('📅 Le système est prêt à enregistrer de nouvelles données à partir du 19 juin 2026 00h00');
    
    // Vérifier que la table est vide
    const count = await prisma.analyticsTrafficEvent.count();
    console.log(`📊 Nombre d'événements restants: ${count}`);
    
  } catch (error) {
    console.error('❌ Erreur lors de la réinitialisation:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

resetTrafficData();
