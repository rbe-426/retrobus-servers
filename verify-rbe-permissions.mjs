/**
 * Script: Vérifier les permissions du profil matricule RBE
 * 
 * Usage: node verify-rbe-permissions.mjs
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyRBEPermissions() {
  try {
    console.log('\n🔍 Vérification des permissions du profil matricule RBE...\n');

    // Chercher le profil RBE
    const rbeProfile = await prisma.members.findFirst({
      where: {
        matricule: 'RBE'
      }
    });

    if (!rbeProfile) {
      console.log('❌ Profil RBE non trouvé');
      process.exit(1);
    }

    console.log('✅ Profil trouvé:');
    console.log(`   Matricule: ${rbeProfile.matricule}`);
    console.log(`   Nom: ${rbeProfile.firstName} ${rbeProfile.lastName}`);
    console.log(`   Email: ${rbeProfile.email}`);
    console.log(`   ID: ${rbeProfile.id}`);
    console.log(`   Status: ${rbeProfile.status}`);

    console.log('\n📋 Permissions appliquées:\n');

    if (rbeProfile.permissions && typeof rbeProfile.permissions === 'object') {
      const perms = rbeProfile.permissions;
      
      if (perms.restrictiveMode) {
        console.log('   🔒 Mode restrictif: ACTIVÉ');
      }

      if (perms.blockedResources && Array.isArray(perms.blockedResources)) {
        console.log(`\n   Ressources bloquées (${perms.blockedResources.length}):`);
        perms.blockedResources.forEach(resource => {
          console.log(`      ❌ ${resource}`);
        });
      }

      if (perms.grantedAt) {
        console.log(`\n   Assignées le: ${new Date(perms.grantedAt).toLocaleString('fr-FR')}`);
      }

      if (perms.grantedBy) {
        console.log(`   Assignées par: ${perms.grantedBy}`);
      }

      if (perms.appliedFor) {
        console.log(`   Appliquées pour: ${perms.appliedFor}`);
      }
    } else {
      console.log('   ⚠️  Aucune permission JSON trouvée');
    }

    console.log('\n✨ Vérification complète!\n');

  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter la vérification
verifyRBEPermissions();
