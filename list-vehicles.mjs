import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  try {
    const vehicles = await prisma.vehicle.findMany({
      take: 10
    });
    
    console.log(`✅ Found ${vehicles.length} vehicles:`);
    vehicles.forEach(v => {
      console.log(`   - ID: ${v.id}, parc: ${v.parc}, type: ${v.type}, modele: ${v.modele}`);
    });
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
