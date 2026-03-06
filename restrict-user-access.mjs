import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🔒 Configuration des restrictions d\'accès...\n');

  const users = ['jsalim.camaroudine', 'm.ravichandran', 'j.amolot'];
  
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
    await prisma.user_permissions.deleteMany({
      where: { userId: siteUser.id }
    });
    console.log(`   🗑️  Permissions précédentes supprimées`);

    // Ajouter les restrictions
    for (const { resource, label } of restrictedResources) {
      await prisma.user_permissions.create({
        data: {
          id: crypto.randomUUID(),
          userId: siteUser.id,
          resource: resource,
          actions: JSON.stringify(['DENY']), // 🔒 Stocké comme JSON string
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
  console.log('📋 RÉSUMÉ DES RESTRICTIONS');
  console.log('='.repeat(80) + '\n');

  console.log('❌ ACCÈS REFUSÉ À:');
  restrictedResources.forEach(({ label }) => {
    console.log(`   • ${label}`);
  });

  console.log('\n✅ ACCÈS AUTORISÉ À:');
  console.log(`   • Tableau de bord`);
  console.log(`   • Gestion des véhicules (parc)`);
  console.log(`   • Gestion de la maintenance`);
  console.log(`   • Événements`);
  console.log(`   • Autres fonctionnalités`);

  console.log('\n⏰ STATUT: TEMPORAIRE');
  console.log('ℹ️  Peut être révoqué quand nécessaire\n');
}

main()
  .catch(e => {
    console.error('❌ Erreur:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
