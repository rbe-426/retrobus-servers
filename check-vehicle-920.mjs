import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Vérification du véhicule 920...\n');

  // Chercher le véhicule par parc = '920'
  const vehicle = await prisma.vehicle.findFirst({
    where: { parc: '920' }
  });

  if (!vehicle) {
    console.log('❌ Véhicule 920 non trouvé!');
    return;
  }

  console.log('✅ Véhicule trouvé:');
  console.log(`   ID: ${vehicle.id}`);
  console.log(`   Parc: ${vehicle.parc}`);
  console.log(`   Marque: ${vehicle.marque}`);
  console.log(`   Modèle: ${vehicle.modele}`);
  console.log(`   isPublic: ${vehicle.isPublic}`);
  console.log(`   Status: ${vehicle.etat}\n`);

  if (!vehicle.isPublic) {
    console.log('⚠️  Le véhicule N\'EST PAS public: isPublic = false');
    console.log('🔧 Mise à jour en cours...');

    const updated = await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: { isPublic: true }
    });

    console.log('✅ Mise à jour réussie!');
    console.log(`   isPublic: ${updated.isPublic}\n`);
  } else {
    console.log('✅ Le véhicule EST déjà public: isPublic = true\n');
  }

  // Tester l'endpoint public
  console.log('🧪 Test de l\'endpoint public...');
  try {
    const response = await fetch('http://localhost:4000/public/vehicles/920');
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Endpoint public fonctionne:');
      console.log(`   Status: ${response.status}`);
      console.log(`   Vehicle: ${data.parc || data.id}`);
    } else {
      console.log('❌ Endpoint retourne une erreur:');
      console.log(`   Status: ${response.status}`);
      console.log(`   Error: ${data.error}`);
    }
  } catch (e) {
    console.log('⚠️  Endpoint public non accessible (API non démarrée?)');
    console.log(`   Erreur: ${e.message}`);
  }

  console.log('\n✅ Vérification terminée');
}

main().catch(console.error).finally(() => prisma.$disconnect());
