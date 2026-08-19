import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

async function cleanupOldPermissions() {
  console.log('🗑️  Suppression des ANCIENNES entrées de permissions pour Jarina...\n');

  try {
    const jarina = await prisma.site_users.findUnique({
      where: { username: 'j.amolot' }
    });

    if (!jarina) {
      console.log('❌ Jarina non trouvée');
      return;
    }

    // Supprimer les ANCIENNES entrées (avec les anciens noms)
    const oldResources = ['finances', 'RetroDAO', 'adhésions', 'member_editing', 'site_management', 'RetroMerch', 'newsletter'];
    
    const deleted = await prisma.user_permissions.deleteMany({
      where: {
        userId: jarina.id,
        resource: {
          in: oldResources
        }
      }
    });

    console.log(`✅ ${deleted.count} anciennes entrées supprimées:`);
    console.log(oldResources.join(', '));

    // Vérifier les NEW permissions qui restent
    const newPermissions = await prisma.user_permissions.findMany({
      where: { userId: jarina.id }
    });

    console.log(`\n✅ ${newPermissions.length} NOUVELLES permissions actives:`);
    newPermissions.forEach(p => {
      console.log(`   - ${p.resource}: ${p.actions}`);
    });

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupOldPermissions();
