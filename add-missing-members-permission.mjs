import pkg from '@prisma/client';
import { randomUUID } from 'crypto';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

async function addMissingMembersPermission() {
  console.log('➕ Ajout de la permission MEMBERS manquante pour Jarina...\n');

  try {
    const jarina = await prisma.site_users.findUnique({
      where: { username: 'j.amolot' }
    });

    if (!jarina) {
      console.log('❌ Jarina non trouvée');
      return;
    }

    // Vérifier si MEMBERS existe déjà
    const existing = await prisma.user_permissions.findFirst({
      where: {
        userId: jarina.id,
        resource: 'MEMBERS'
      }
    });

    if (existing) {
      console.log('✅ MEMBERS existe déjà');
      return;
    }

    // Créer MEMBERS
    const created = await prisma.user_permissions.create({
      data: {
        id: randomUUID(),
        userId: jarina.id,
        resource: 'MEMBERS',
        actions: 'DENY',
        reason: 'Accès restreint - Permission refusée',
        grantedAt: new Date(),
        updatedAt: new Date(),
        grantedBy: 'ADMIN_SCRIPT_FIX'
      }
    });

    console.log('✅ MEMBERS créé pour Jarina');

    // Afficher toutes les permissions finales
    const allPermissions = await prisma.user_permissions.findMany({
      where: { userId: jarina.id }
    });

    console.log(`\n📋 Toutes les permissions de Jarina (${allPermissions.length}):`);
    allPermissions.forEach(p => {
      console.log(`   - ${p.resource}: ${p.actions}`);
    });

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

addMissingMembersPermission();
