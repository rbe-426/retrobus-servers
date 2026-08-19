import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUser() {
  try {
    const user = await prisma.members.findUnique({
      where: { email: 'belaidiw91@gmail.com' }
    });

    if (user) {
      console.log('📋 Données utilisateur:');
      console.log('  Email:', user.email);
      console.log('  firstName:', user.firstName);
      console.log('  lastName:', user.lastName);
      console.log('  prenom:', user.prenom);
      console.log('  nom:', user.nom);
      console.log('  matricule:', user.matricule);
    } else {
      console.log('❌ Utilisateur non trouvé');
    }
  } catch (e) {
    console.error('❌ Erreur:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();
