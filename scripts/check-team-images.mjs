import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTeamImages() {
  try {
    const members = await prisma.teamMember.findMany({
      select: {
        id: true,
        name: true,
        image: true
      },
      orderBy: { name: 'asc' }
    });
    
    console.log('📋 Membres de l\'équipe et leurs images:\n');
    
    members.forEach(member => {
      console.log(`👤 ${member.name}`);
      console.log(`   ID: ${member.id}`);
      console.log(`   Image: ${member.image || '(aucune)'}`);
      console.log('');
    });
    
    console.log(`Total: ${members.length} membres`);
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTeamImages();
