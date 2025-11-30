import prisma from './api/src/prisma-client.js';

async function checkUserRole() {
  try {
    // Chercher l'utilisateur w.belaidi
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { contains: 'belaidi' } },
          { username: { contains: 'belaidi' } },
          { email: 'w.belaidi@...' } // à ajuster si vous savez l'email exact
        ]
      }
    });

    if (!user) {
      console.log('❌ Utilisateur w.belaidi non trouvé');
      console.log('\n📋 Affichage de tous les utilisateurs:');
      const allUsers = await prisma.user.findMany({
        select: { id: true, email: true, username: true, role: true, createdAt: true }
      });
      console.table(allUsers);
    } else {
      console.log('✅ Utilisateur trouvé:');
      console.log(`  ID: ${user.id}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Username: ${user.username}`);
      console.log(`  Rôle actuel: ${user.role}`);
      
      console.log('\n🔧 Pour promouvoir en admin, exécutez:');
      console.log(`  npx ts-node promote-to-admin.ts ${user.id}`);
    }
  } catch (error) {
    console.error('Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserRole();
