#!/usr/bin/env node
/**
 * check-production-traffic.mjs
 * Vérifie les événements de trafic enregistrés (production incluse)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkProductionTraffic() {
  console.log('🔍 Vérification du trafic en production...\n');

  try {
    const events = await prisma.analyticsTrafficEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        eventType: true,
        path: true,
        source: true,
        referrer: true,
        createdAt: true
      }
    });

    const total = await prisma.analyticsTrafficEvent.count();

    console.log(`📊 Total événements enregistrés: ${total}\n`);

    if (total === 0) {
      console.log('⚠️  Aucun événement encore. Actions recommandées:');
      console.log('   1. Visitez https://www.association-rbe.fr/');
      console.log('   2. Naviguez sur quelques pages');
      console.log('   3. Relancez ce script après 30 secondes\n');
      return;
    }

    // Grouper par source
    const bySources = await prisma.analyticsTrafficEvent.groupBy({
      by: ['source'],
      _count: { id: true }
    });

    console.log('📍 Répartition par source:');
    bySources.forEach(s => {
      const emoji = s.source === 'google' ? '🔍' : 
                    s.source === 'site' ? '🌐' : 
                    s.source === 'direct' ? '⚡' : '📄';
      console.log(`   ${emoji} ${s.source || 'unknown'}: ${s._count.id} événements`);
    });

    console.log('\n🕐 20 derniers événements:');
    events.forEach(e => {
      const time = new Date(e.createdAt).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      const type = e.eventType.padEnd(18);
      const path = (e.path || '/').padEnd(30);
      const source = e.source || 'unknown';
      console.log(`   ${time} | ${type} | ${path} | ${source}`);
    });

    console.log('\n✅ Tracking en cours de fonctionnement!\n');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkProductionTraffic();
