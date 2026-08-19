/**
 * Script pour restaurer l'image de Jaffer Camaroudine
 * qui existe bel et bien dans externe/public/assets/team/
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function restoreJafferImage() {
  try {
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

restoreJafferImage();
