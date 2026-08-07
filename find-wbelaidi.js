import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findUser() {
  try {
    console.log('=== Cherche w.belaidi ===\n');
    
    // Cherche par matricule
    console.log('📍 Cherche par matricule = "w.belaidi"');
    const byMatricule = await prisma.members.findFirst({
      where: { matricule: 'w.belaidi' }
    });
    if (byMatricule) {
      console.log(`✅ Trouvé: ${byMatricule.firstName} ${byMatricule.lastName}`);
      console.log(`   Email: ${byMatricule.email}`);
      console.log(`   ID: ${byMatricule.id}`);
      return;
    }

    // Cherche par email contenant "belaidi"
    console.log('\n📍 Cherche par email contenant "belaidi"');
    const byEmail = await prisma.members.findMany({
      where: { email: { contains: 'belaidi', mode: 'insensitive' } }
    });
    if (byEmail.length > 0) {
      byEmail.forEach(u => {
        console.log(`✅ Trouvé: ${u.firstName} ${u.lastName}`);
        console.log(`   Email: ${u.email}`);
        console.log(`   Matricule: ${u.matricule}`);
        console.log(`   ID: ${u.id}\n`);
      });
      return;
    }

    // Cherche par firstName
    console.log('\n📍 Cherche par firstName = "Waiyl"');
    const byName = await prisma.members.findMany({
      where: { firstName: { contains: 'Waiyl', mode: 'insensitive' } }
    });
    if (byName.length > 0) {
      byName.forEach(u => {
        console.log(`✅ Trouvé: ${u.firstName} ${u.lastName}`);
        console.log(`   Email: ${u.email}`);
        console.log(`   Matricule: ${u.matricule}`);
        console.log(`   ID: ${u.id}\n`);
      });
      return;
    }

    console.log('\n❌ Aucun utilisateur trouvé avec ces critères');
    console.log('\n=== TOUS LES MEMBRES ===');
    const all = await prisma.members.findMany({
      take: 20,
      select: { firstName: true, lastName: true, email: true, matricule: true }
    });
    console.table(all);

  } catch (e) {
    console.error('❌ Erreur:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

findUser();
