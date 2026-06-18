import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTrafficData() {
  try {
    console.log('📊 Vérification des données de trafic...\n');

    // Compter tous les événements
    const totalEvents = await prisma.analyticsTrafficEvent.count();
    console.log(`Total événements: ${totalEvents}`);

    if (totalEvents === 0) {
      console.log('\n⚠️ AUCUN événement de trafic trouvé dans la base de données !');
      console.log('Les visites du site externe ne sont pas enregistrées.\n');
      console.log('Actions recommandées:');
      console.log('1. Vérifiez que le site externe pointe vers localhost:8080 (externe/.env)');
      console.log('2. Visitez le site externe pour générer des événements');
      console.log('3. Relancez ce script pour vérifier\n');
      return;
    }

    // Événements du mois en cours
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const monthlyEvents = await prisma.analyticsTrafficEvent.count({
      where: {
        createdAt: {
          gte: startOfMonth,
          lt: endOfMonth
        }
      }
    });

    console.log(`\nÉvénements du mois ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}: ${monthlyEvents}`);

    // Breakdown par type
    const eventsByType = await prisma.analyticsTrafficEvent.groupBy({
      by: ['eventType'],
      _count: {
        eventType: true
      },
      where: {
        createdAt: {
          gte: startOfMonth,
          lt: endOfMonth
        }
      }
    });

    console.log('\nDétail par type:');
    eventsByType.forEach(group => {
      console.log(`  - ${group.eventType}: ${group._count.eventType}`);
    });

    // Derniers événements
    const latestEvents = await prisma.analyticsTrafficEvent.findMany({
      take: 5,
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        eventType: true,
        path: true,
        source: true,
        createdAt: true
      }
    });

    console.log('\nDerniers événements:');
    latestEvents.forEach(event => {
      console.log(`  ${event.createdAt.toISOString()} | ${event.eventType} | ${event.path} | ${event.source}`);
    });

    // Statistiques journalières
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEvents = await prisma.analyticsTrafficEvent.count({
      where: {
        createdAt: {
          gte: today
        }
      }
    });

    console.log(`\nÉvénements aujourd'hui (${now.toLocaleDateString('fr-FR')}): ${todayEvents}`);

    console.log('\n✅ Vérification terminée');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    if (error.code === 'P2021') {
      console.log('\n⚠️ La table AnalyticsTrafficEvent n\'existe pas dans la base de données !');
      console.log('Exécutez les migrations Prisma : npx prisma migrate deploy');
    }
  } finally {
    await prisma.$disconnect();
  }
}

checkTrafficData();
