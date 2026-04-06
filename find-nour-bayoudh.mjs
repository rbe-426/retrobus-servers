import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

async function checkNourPermissions() {
  console.log('📋 Vérification des permissions de Nour BAYOUDH...\n');

  try {
    const nour = await prisma.members.findFirst({
      where: {
        OR: [
          { firstName: { contains: 'Nour', mode: 'insensitive' } },
          { lastName: { contains: 'Bayoudh', mode: 'insensitive' } }
        ]
      }
    });

    if (!nour) {
      console.log('❌ Nour non trouvé');
      return;
    }

    console.log(`✅ Nour BAYOUDH (${nour.id})`);
    console.log(`   Email: ${nour.email}`);
    console.log(`   Permissions (JSON): ${nour.permissions ? JSON.stringify(nour.permissions) : 'undefined'}\n`);

    // Vérifier dans user_permissions
    const perms = await prisma.user_permissions.findMany({
      where: { userId: nour.id }
    });

    console.log(`📝 ${perms.length} entrées dans user_permissions:`);
    if (perms.length === 0) {
      console.log('   (aucune)')
    } else {
      perms.forEach(p => {
        console.log(`   - ${p.resource}: ${p.actions}`);
      });
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkNourPermissions();
