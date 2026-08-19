import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUserRole() {
  try {
    const user = await prisma.members.findFirst({
      where: {
        OR: [
          { email: 'w.belaidi@retrobus-essonne.fr' },
          { matricule: 'w.belaidi' },
        ]
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        matricule: true,
        role: true,
        permissions: true,
        status: true,
      }
    });

    if (user) {
      console.log('✅ Utilisateur trouvé:');
      console.log('ID:', user.id);
      console.log('Nom:', user.firstName, user.lastName);
      console.log('Email:', user.email);
      console.log('Matricule:', user.matricule);
      console.log('Rôle:', user.role);
      console.log('Permissions:', user.permissions);
      console.log('Status:', user.status);
    } else {
      console.log('❌ Utilisateur w.belaidi non trouvé');
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('Erreur:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkUserRole();
