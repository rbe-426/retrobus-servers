import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Correction des restrictions d\'accès (actions format)...\n');

  const users = ['jsalim.camaroudine', 'm.ravichandran'];
  
  const restrictedResources = [
    { resource: 'FINANCE', label: 'Finances' },
    { resource: 'RETRO_DEMANDES', label: 'Rétro Demandes' },
    { resource: 'ADHESION_MANAGEMENT', label: 'Gestion des adhésions' },
    { resource: 'SITE_MANAGEMENT', label: 'Gestion du site' },
    { resource: 'RETROMERCH', label: 'Gestion RétroMerch' },
    { resource: 'NEWSLETTER', label: 'Gestion Newsletter' }
  ];

  for (const username of users) {
    console.log(`\n👤 ${username}:`);
    
    const siteUser = await prisma.site_users.findUnique({
      where: { username }
    });

    if (!siteUser) {
      console.log(`   ❌ Utilisateur non trouvé`);
      continue;
    }

    // Supprimer les permissions existantes pour ce user
    const deleted = await prisma.user_permissions.deleteMany({
      where: { userId: siteUser.id }
    });
    console.log(`   🗑️  ${deleted.count} permission(s) supprimée(s)`);

    // Ajouter les restrictions avec le bon format
    for (const { resource, label } of restrictedResources) {
      await prisma.user_permissions.create({
        data: {
          id: crypto.randomUUID(),
          userId: siteUser.id,
          resource: resource,
          actions: JSON.stringify(['DENY']), // ✅ Au format JSON string
          grantedBy: 'SYSTEM',
          reason: 'Accès temporairement restreint',
          createdAt: new Date(),
          updatedAt: new Date(),
          grantedAt: new Date()
        }
      });
      console.log(`   🚫 ${label}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📋 VÉRIFICATION FINALE');
  console.log('='.repeat(80) + '\n');

  for (const username of users) {
    const siteUser = await prisma.site_users.findUnique({
      where: { username }
    });

    if (!siteUser) continue;

    const perms = await prisma.user_permissions.findMany({
      where: { userId: siteUser.id }
    });

    console.log(`👤 ${username}:`);
    perms.forEach(p => {
      const actions = JSON.parse(p.actions || '[]');
      console.log(`   • ${p.resource}: ${JSON.stringify(actions)}`);
    });
  }

  console.log('\n✅ Restrictions corrigées!\n');
}

main()
  .catch(e => {
    console.error('❌ Erreur:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
