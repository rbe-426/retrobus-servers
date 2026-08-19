import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: 920 }
    });
    
    if (vehicle) {
      console.log('✅ Vehicle 920 found:');
      console.log('   - parc:', vehicle.parc);
      console.log('   - type:', vehicle.type);
      console.log('   - modele:', vehicle.modele);
    } else {
      console.log('❌ Vehicle 920 not found');
    }
    
    // Also check usages for this parc
    if (vehicle) {
      const usages = await prisma.usage.findMany({
        where: { parc: vehicle.parc }
      });
      console.log(`✅ Found ${usages.length} usages for parc ${vehicle.parc}`);
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
