/**
 * Script: Appliquer les permissions Urbex à Gaëlle Champenois
 * Mêmes restrictions que Jarina et Méthusan
 * Usage: node apply-gaelle-urbex-permissions.mjs
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function applyGaellePermissions() {
  console.log('🔒 Application des permissions Urbex à Gaëlle Champenois...\n');

  try {
    // Trouver Gaëlle dans members
    const gaelle = await prisma.members.findFirst({
      where: { matricule: 'g.champenois' }
    });

    if (!gaelle) {
      console.log('❌ Gaëlle Champenois non trouvée dans members');
      return;
    }

    console.log(`✅ Profil trouvé: ${gaelle.firstName} ${gaelle.lastName}`);
    console.log(`   Matricule: ${gaelle.matricule}`);
    console.log(`   Email: ${gaelle.email}`);

    // Ressources bloquées (mêmes que Jarina et Méthusan)
    const restrictedResources = [
      { resource: 'FINANCE', label: 'Finances' },
      { resource: 'RETRO_DEMANDES', label: 'Rétro Demandes' },
      { resource: 'MEMBERS', label: 'Gestion des adhérents' },
      { resource: 'ADHESION_MANAGEMENT', label: 'Gestion des adhésions' },
      { resource: 'SITE_MANAGEMENT', label: 'Gestion du site' },
      { resource: 'RETROMERCH', label: 'Gestion RétroMerch' },
      { resource: 'NEWSLETTER', label: 'Gestion Newsletter' }
    ];

    // Mettre à jour le champ permissions JSON du membre
    const restrictedPermissions = {
      blockedResources: restrictedResources.map(r => r.resource),
      restrictiveMode: true,
      grantedAt: new Date().toISOString(),
      grantedBy: 'ADMIN',
      appliedFor: 'Urbex - mêmes permissions que Jarina et Méthusan'
    };

    await prisma.members.update({
      where: { id: gaelle.id },
      data: {
        permissions: restrictedPermissions
      }
    });

    console.log(`\n✅ Champ 'permissions' JSON mis à jour sur le profil membre`);

    console.log('\n' + '='.repeat(80));
    console.log('📋 PERMISSIONS APPLIQUÉES À GAËLLE CHAMPENOIS');
    console.log('='.repeat(80) + '\n');

    console.log('❌ ACCÈS REFUSÉ À:');
    restrictedResources.forEach(({ label }) => {
      console.log(`   • ${label}`);
    });

    console.log('\n✅ ACCÈS AUTORISÉ À:');
    console.log(`   • Tableau de bord (MyRBE)`);
    console.log(`   • Gestion des véhicules (parc)`);
    console.log(`   • Gestion de la maintenance`);
    console.log(`   • Événements`);
    console.log(`   • RétroPlanification`);
    console.log(`   • RétroSupport`);
    console.log(`   • Stock`);

    console.log('\n🎯 PROFIL: Urbex (comme Jarina et Méthusan)');
    console.log('📝 Ces permissions sont identiques aux autres membres Urbex\n');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

applyGaellePermissions();
