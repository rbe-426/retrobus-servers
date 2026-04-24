/**
 * Script pour nettoyer la configuration du site RetroMerch
 * Supprime toutes les configs invalides
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanSiteConfig() {
  try {
    console.log('🧹 Nettoyage de la configuration du site RetroMerch...\n');

    // Supprimer toutes les configs existantes
    const deleted = await prisma.retromerch_site_config.deleteMany({});
    
    console.log(`✅ ${deleted.count} configurations supprimées`);
    console.log('\nLa configuration par défaut sera utilisée sur le site.');
    console.log('Vous pouvez maintenant configurer votre site via l\'éditeur.\n');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanSiteConfig();
