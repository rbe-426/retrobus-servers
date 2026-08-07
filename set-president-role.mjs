import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setPresidentRole() {
  try {
    const user = await prisma.members.update({
      where: { matricule: 'w.belaidi' },
      data: { role: 'PRESIDENT' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        matricule: true,
        role: true,
      }
    });

    console.log('✅ Rôle mis à jour:');
    console.log('Nom:', user.firstName, user.lastName);
    console.log('Matricule:', user.matricule);
    console.log('Nouveau rôle:', user.role);

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Erreur:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

setPresidentRole();
