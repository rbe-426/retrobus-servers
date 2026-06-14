/**
 * Script pour restaurer les images uploadées de Waiyl et Methusan
 * Les fichiers existent bel et bien dans uploads/team-avatars/
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function restoreUploadedImages() {
  try {
    await prisma.teamMember.update({
      where: { id: 'team_1' },
      data: { image: '/uploads/team-avatars/team_1-1781473879218.png' }
    });
    console.log('✅ Image de Waiyl Belaidi restaurée');

    await prisma.teamMember.update({
      where: { id: 'team_2' },
      data: { image: '/uploads/team-avatars/team_2-1781473872315.png' }
    });
    console.log('✅ Image de Methusan Ravichandran restaurée');

    await prisma.teamMember.update({
      where: { id: 'team_3' },
      data: { image: '/assets/team/jaffer-camaroudine.jpg' }
    });
    console.log('✅ Image de Jaffer Camaroudine restaurée');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

restoreUploadedImages();
