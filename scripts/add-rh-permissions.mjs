/**
 * Script pour ajouter les permissions "Gestion RH" à n.bayoudh
 * Droits : consulter, modifier, éditer
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addRHPermissions() {
  try {
    console.log('🔍 Recherche de l\'utilisateur n.bayoudh...');
    
    // Trouver l'utilisateur par matricule
    const user = await prisma.members.findFirst({
      where: {
        matricule: 'n.bayoudh'
      }
    });

    if (!user) {
      console.error('❌ Utilisateur n.bayoudh non trouvé');
      process.exit(1);
    }

    console.log(`✅ Utilisateur trouvé : ${user.firstName} ${user.lastName} (${user.email})`);
    
    // Récupérer les permissions actuelles
    const currentPermissions = user.permissions ? JSON.parse(JSON.stringify(user.permissions)) : [];
    console.log('📋 Permissions actuelles :', JSON.stringify(currentPermissions, null, 2));
    
    // Vérifier si la permission "Gestion RH" existe déjà
    const rhPermIndex = currentPermissions.findIndex(p => 
      p.module === 'Gestion RH' || p.name === 'Gestion RH'
    );
    
    const rhPermission = {
      module: 'Gestion RH',
      name: 'Gestion RH',
      rights: ['consulter', 'modifier', 'éditer'],
      addedAt: new Date().toISOString()
    };
    
    if (rhPermIndex >= 0) {
      console.log('⚠️  Permission "Gestion RH" déjà existante, mise à jour...');
      currentPermissions[rhPermIndex] = rhPermission;
    } else {
      console.log('➕ Ajout de la permission "Gestion RH"...');
      currentPermissions.push(rhPermission);
    }
    
    // Mettre à jour les permissions dans la base de données
    const updatedUser = await prisma.members.update({
      where: {
        id: user.id
      },
      data: {
        permissions: currentPermissions,
        updatedAt: new Date()
      }
    });
    
    console.log('✅ Permissions mises à jour avec succès !');
    console.log('📋 Nouvelles permissions :', JSON.stringify(updatedUser.permissions, null, 2));
    
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour des permissions :', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
addRHPermissions();
