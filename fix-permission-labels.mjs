/**
 * Script: Corriger les labels des permissions pour correspondre aux cartes MyRBE
 * 
 * Correspondance correcte:
 * - "finances" -> "FINANCE"
 * - "RetroDAO" -> "RETRO_DEMANDES" 
 * - "adhésions" -> "MEMBERS"
 * - "member_editing" -> "ADHESION_MANAGEMENT"
 * - "site_management" -> "SITE_MANAGEMENT"
 * - "RetroMerch" -> "RETROMERCH"
 * - "newsletter" -> "NEWSLETTER"
 * 
 * Usage: node fix-permission-labels.mjs
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Mapping des anciens labels vers les corrects
const LABEL_MAPPING = {
  'finances': 'FINANCE',
  'RetroDAO': 'RETRO_DEMANDES',
  'adhésions': 'MEMBERS',
  'member_editing': 'ADHESION_MANAGEMENT',
  'site_management': 'SITE_MANAGEMENT',
  'RetroMerch': 'RETROMERCH',
  'newsletter': 'NEWSLETTER'
};

async function fixPermissionLabels() {
  try {
    console.log('\n🔧 Correction des labels de permissions...\n');

    // Récupérer tous les membres avec des permissions restrictives
    const membersWithPermissions = await prisma.members.findMany({
      where: {
        permissions: {
          not: null
        }
      }
    });

    console.log(`📊 ${membersWithPermissions.length} membres avec permissions trouvés\n`);

    for (const member of membersWithPermissions) {
      const permissions = member.permissions;
      
      if (permissions && permissions.blockedResources && Array.isArray(permissions.blockedResources)) {
        const oldResources = [...permissions.blockedResources];
        const newResources = oldResources.map(resource => LABEL_MAPPING[resource] || resource);
        
        // Vérifier s'il y a des changements
        const hasChanges = oldResources.some((old, idx) => old !== newResources[idx]);
        
        if (hasChanges) {
          console.log(`👤 ${member.firstName || member.name || 'ID: ' + member.id}`);
          console.log(`   Ancien: [${oldResources.join(', ')}]`);
          console.log(`   Nouveau: [${newResources.join(', ')}]`);
          
          // Mettre à jour
          await prisma.members.update({
            where: { id: member.id },
            data: {
              permissions: {
                ...permissions,
                blockedResources: newResources
              }
            }
          });
          
          console.log(`   ✅ Mise à jour réussie\n`);
        } else {
          console.log(`👤 ${member.firstName || member.name || 'ID: ' + member.id}`);
          console.log(`   ⏭️  Pas de changement nécessaire\n`);
        }
      }
    }

    console.log('\n✨ Correction terminée!');
    
  } catch (e) {
    console.error('\n❌ Erreur:', e.message);
    throw e;
  } finally {
    await prisma.$disconnect();
  }
}

fixPermissionLabels();
