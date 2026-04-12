import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

(async () => {
  try {
    // Get all vehicles
    const vehicles = await prisma.vehicle.findMany({
      select: { id: true, parc: true, modele: true, marque: true, caracteristiques: true }
    });
    
    console.log('=== TOUS LES VÉHICULES ===');
    vehicles.forEach(v => {
      console.log(`[${v.parc}] ${v.marque} ${v.modele} (ID: ${v.id})`);
    });
    
    // Find 920
    const v920 = await prisma.vehicle.findFirst({ where: { parc: '920' } });
    console.log('\n=== CARACTÉRISTIQUES 920 ===');
    console.log(v920?.caracteristiques?.substring(0, 200) || 'Pas de caractéristiques');
    
    // Find BMW
    const bmw = await prisma.vehicle.findFirst({ 
      where: { marque: { contains: 'BMW', mode: 'insensitive' } } 
    });
    
    if (bmw) {
      console.log(`\n=== BMW TROUVÉE ===`);
      console.log(`Parc: ${bmw.parc}, Model: ${bmw.modele}`);
      
      // Copy caracteristiques from 920 to BMW
      if (v920?.caracteristiques) {
        const updated = await prisma.vehicle.update({
          where: { id: bmw.id },
          data: { caracteristiques: v920.caracteristiques }
        });
        console.log(`✅ Caractéristiques copiées vers ${bmw.parc}`);
      } else {
        console.log(`❌ Pas de caractéristiques à copier depuis 920`);
      }
    } else {
      console.log(`❌ Pas de BMW trouvée`);
    }
    
    await prisma.$disconnect();
  } catch (e) {
    console.error('❌ Erreur:', e.message);
    process.exit(1);
  }
})();
