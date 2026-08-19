import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Charger les variables d'environnement
dotenv.config({ path: '.env' });

const prisma = new PrismaClient();

async function listServices() {
  try {
    console.log('📋 Liste des missions INÉO...\n');
    
    const services = await prisma.ineoMission.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`✅ ${services.length} mission(s) trouvée(s):\n`);
    
    services.forEach((service, index) => {
      console.log(`${index + 1}. ID: ${service.id}`);
      console.log(`   Service: ${service.serviceName || 'N/A'}`);
      console.log(`   Référence: ${service.serviceReference || 'N/A'}`);
      console.log(`   Véhicule: ${service.vehicleParc || 'N/A'}`);
      console.log(`   Départ: ${service.scheduledDeparture || 'N/A'}`);
      console.log(`   Statut: ${service.status || 'N/A'}`);
      console.log('');
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

listServices();
