/**
 * Script: Appliquer les permissions restrictives au profil matricule RBE
 * Ressources bloquées: finances, RetroDAO, adhésions, site_management, RetroMerch, newsletter
 * 
 * Usage: node assign-permissions-rbe.mjs
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Ressources à bloquer (mêmes que pour les autres utilisateurs restrictifs)
const RESTRICTED_RESOURCES = [
  'finances',
  'RetroDAO',
  'adhésions',
  'member_editing',
  'site_management',
  'RetroMerch',
  'newsletter'
];

async function assignPermissionsToRBE() {
  try {
    console.log('\n🔐 Attribution des permissions restrictives au profil matricule RBE...\n');

    // Chercher le membre avec matricule RBE
    const rbeProfile = await prisma.members.findFirst({
      where: {
        matricule: 'RBE'
      }
    });

    if (!rbeProfile) {
      console.log('❌ Erreur: Aucun profil avec matricule "RBE" trouvé dans la base de données');
      console.log('\n📋 Affichage des matricules disponibles:');
      const allMembers = await prisma.members.findMany({
        select: {
          id: true,
          matricule: true,
          firstName: true,
          lastName: true,
          email: true
        }
      });
      
      allMembers.forEach(m => {
        console.log(`   - ${m.matricule}: ${m.firstName} ${m.lastName} (${m.email})`);
      });
      
      process.exit(1);
    }

    console.log(`✅ Profil trouvé:`);
    console.log(`   Matricule: ${rbeProfile.matricule}`);
    console.log(`   Nom: ${rbeProfile.firstName} ${rbeProfile.lastName}`);
    console.log(`   Email: ${rbeProfile.email}`);
    console.log(`\n📝 Application des permissions restrictives...\n`);

    // Mettre à jour les permissions JSON du membre
    const restrictedPermissions = {
      blockedResources: RESTRICTED_RESOURCES,
      restrictiveMode: true,
      grantedAt: new Date().toISOString(),
      grantedBy: 'ADMIN_SCRIPT',
      appliedFor: 'matricule RBE'
    };

    await prisma.members.update({
      where: { id: rbeProfile.id },
      data: {
        permissions: restrictedPermissions
      }
    });

    console.log(`✅ Champ 'permissions' JSON mis à jour sur le profil membre`);
    console.log(`\n📊 Ressources bloquées:`);
    RESTRICTED_RESOURCES.forEach(resource => {
      console.log(`   ❌ ${resource}`);
    });

    console.log(`\n✨ Permissions restrictives appliquées avec succès à RBE!`);
    console.log(`\n💡 Résumé:`);
    console.log(`   - Profil: ${rbeProfile.firstName} ${rbeProfile.lastName}`);
    console.log(`   - Matricule: ${rbeProfile.matricule}`);
    console.log(`   - Ressources bloquées: ${RESTRICTED_RESOURCES.length}`);
    console.log(`   - Mode restrictif: ACTIVÉ`);

  } catch (error) {
    console.error('❌ Erreur lors de l\'application des permissions:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
assignPermissionsToRBE();
