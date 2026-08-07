import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Charger les variables d'environnement
dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient();

async function deleteAllServices() {
  try {
    console.log('🗑️  Suppression de tous les services planifiés...');
    
    const result = await prisma.vehicle_service_schedule.deleteMany({});
    
    console.log(`✅ ${result.count} service(s) supprimé(s) avec succès`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAllServices();
