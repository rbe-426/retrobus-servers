import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function syncRetroActusToDb() {
  try {
    console.log('🔄 Synchronisation des RetroActus existantes vers Prisma...');

    // Charger les RetroActus depuis state (runtime-state.json)
    let stateData = {};
    try {
      const fs = await import('fs').then(m => m.default);
      const path = await import('path').then(m => m.default);
      const stateFile = path.join(process.cwd(), 'runtime-state.json');
      if (fs.existsSync(stateFile)) {
        const data = fs.readFileSync(stateFile, 'utf-8');
        stateData = JSON.parse(data);
        console.log('✅ État chargé depuis runtime-state.json');
      }
    } catch (e) {
      console.log('⚠️ Pas de runtime-state.json trouvé, c\'est OK');
    }

    const retroNews = stateData.retroNews || [];

    if (retroNews.length === 0) {
      console.log('ℹ️ Aucune RetroActu à synchroniser');
      return;
    }

    console.log(`📰 ${retroNews.length} RetroActus trouvées dans l'état`);

    // Insérer/mettre à jour chacune
    let saved = 0;
    for (const news of retroNews) {
      try {
        const existing = await prisma.retroNews.findUnique({ where: { id: news.id } });
        
        if (!existing) {
          await prisma.retroNews.create({
            data: {
              id: news.id,
              title: news.title || 'Sans titre',
              content: news.content || news.body || '',
              author: news.author || 'anonyme',
              published: news.published || false,
              createdBy: news.createdBy || 'import',
              createdAt: news.createdAt ? new Date(news.createdAt) : new Date(),
              publishedAt: news.publishedAt ? new Date(news.publishedAt) : null
            }
          });
          saved++;
          console.log(`✅ Sauvegardée: "${news.title}"`);
        } else {
          console.log(`⏭️ Existe déjà: "${news.title}"`);
        }
      } catch (e) {
        console.error(`❌ Erreur pour "${news.title}": ${e.message}`);
      }
    }

    console.log(`\n✅ Synchronisation complète: ${saved} nouvelles sauvegardées`);
  } catch (e) {
    console.error('❌ Erreur:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

syncRetroActusToDb();
