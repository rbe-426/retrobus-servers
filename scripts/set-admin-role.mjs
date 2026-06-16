/**
 * Script pour donner le rôle ADMIN à n.bayoudh
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setAdminRole() {
  try {
    console.log('🔍 Mise à jour du rôle pour n.bayoudh...');
    
    const updated = await prisma.members.update({
      where: {
        matricule: 'n.bayoudh'
      },
      data: {
        role: 'ADMIN',
        updatedAt: new Date()
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        matricule: true,
        role: true
      }
    });

    console.log('✅ Rôle mis à jour avec succès !');
    console.log(JSON.stringify(updated, null, 2));
    console.log('\n🔐 L\'utilisateur n.bayoudh a maintenant le rôle ADMIN');
    console.log('📝 Il peut maintenant uploader des photos pour l\'équipe');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setAdminRole();
