import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Charger les variables d'environnement
dotenv.config({ path: '.env' });

const prisma = new PrismaClient();

async function deleteAllServices() {
  try {
    console.log('🗑️  Suppression de toutes les missions INÉO...');
    
    const result = await prisma.ineoMission.deleteMany({});
    
    console.log(`✅ ${result.count} mission(s) supprimée(s) avec succès`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAllServices();
