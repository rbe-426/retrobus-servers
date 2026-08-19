import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🚗 Reinjectting vehicles...\n');
    
    const vehicles = [
      {
        parc: '001',
        name: 'Citroën 2CV',
        type: 'Utilitaire',
        matricule: '75-AB-001',
        registrationYear: 1975,
        status: 'OPERATIONAL'
      },
      {
        parc: '002',
        name: 'Renault Dauphine',
        type: 'Berline',
        matricule: '75-AB-002',
        registrationYear: 1960,
        status: 'OPERATIONAL'
      },
      {
        parc: '003',
        name: 'Peugeot 404',
        type: 'Berline',
        matricule: '75-AB-003',
        registrationYear: 1970,
        status: 'OPERATIONAL'
      }
    ];

    for (const vehicleData of vehicles) {
      try {
        const vehicle = await prisma.vehicle.create({
          data: vehicleData
        });
        console.log(`✅ Created vehicle: ${vehicle.name} (${vehicle.parc})`);
      } catch (e) {
        if (e.code === 'P2002') {
          console.log(`⚠️ Vehicle ${vehicleData.parc} already exists`);
        } else {
          throw e;
        }
      }
    }

    console.log('\n✅ Vehicles reinjected!');

  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
