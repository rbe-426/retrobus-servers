#!/usr/bin/env node
/**
 * reset-traffic-analytics.mjs
 * Script pour réinitialiser tous les compteurs de trafic analytics
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetTrafficAnalytics() {
  console.log('🔄 Réinitialisation des compteurs de trafic analytics...\n');

  try {
    // Compter les événements avant suppression
    const countBefore = await prisma.analyticsTrafficEvent.count();
    console.log(`📊 Événements actuels: ${countBefore}`);

    if (countBefore === 0) {
      console.log('✅ Aucun événement à supprimer, compteurs déjà à zéro.');
      return;
    }

    // Demander confirmation
    console.log(`\n⚠️  Vous allez supprimer ${countBefore} événements.`);
    console.log('   Cette action est IRRÉVERSIBLE.\n');

    // Supprimer tous les événements
    const result = await prisma.analyticsTrafficEvent.deleteMany({});
    
    console.log(`\n✅ Suppression terminée: ${result.count} événements supprimés`);
    console.log('📊 Compteurs de trafic remis à zéro\n');

    // Vérification
    const countAfter = await prisma.analyticsTrafficEvent.count();
    console.log(`✓ Vérification: ${countAfter} événements restants\n`);

    if (countAfter === 0) {
      console.log('🎉 Réinitialisation réussie! Tous les compteurs sont à zéro.');
    } else {
      console.log('⚠️  Attention: Des événements subsistent.');
    }

  } catch (error) {
    console.error('❌ Erreur lors de la réinitialisation:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécution
resetTrafficAnalytics();
