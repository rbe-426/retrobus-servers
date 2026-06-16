/**
 * Script pour remettre n.bayoudh à USER et vérifier w.belaidi
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixRoles() {
  try {
    console.log('🔄 Remise du rôle USER pour n.bayoudh...');
    
    const nour = await prisma.members.update({
      where: {
        matricule: 'n.bayoudh'
      },
      data: {
        role: 'USER',
        updatedAt: new Date()
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        matricule: true,
        role: true
      }
    });

    console.log('✅ n.bayoudh remis à USER:');
    console.log(JSON.stringify(nour, null, 2));

    console.log('\n🔍 Recherche de w.belaidi...');
    
    const waiyl = await prisma.members.findFirst({
      where: {
        OR: [
          { matricule: 'w.belaidi' },
          { email: { contains: 'belaidi' } },
          { firstName: { contains: 'WAIYL' } },
          { lastName: { contains: 'BELAIDI' } }
        ]
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        matricule: true,
        role: true,
        permissions: true
      }
    });

    if (!waiyl) {
      console.log('❌ w.belaidi non trouvé');
    } else {
      console.log('✅ w.belaidi trouvé:');
      console.log(JSON.stringify(waiyl, null, 2));
      
      if (waiyl.role !== 'ADMIN' && waiyl.role !== 'PRESIDENT') {
        console.log('\n⚠️  w.belaidi n\'a pas de rôle admin !');
        console.log('🔧 Attribution du rôle PRESIDENT...');
        
        const updated = await prisma.members.update({
          where: {
            id: waiyl.id
          },
          data: {
            role: 'PRESIDENT',
            updatedAt: new Date()
          }
        });
        
        console.log('✅ Rôle PRESIDENT attribué à w.belaidi');
      } else {
        console.log(`✅ w.belaidi a déjà le rôle: ${waiyl.role}`);
      }
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixRoles();
