import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  try {
    const retroNews = await prisma.retroNews.findMany();
    
    console.log(`\n📰 RetroActus en BD: ${retroNews.length}`);
    
    if (retroNews.length === 0) {
      console.log('❌ Aucune RetroActu');
    } else {
      console.table(retroNews.map(news => ({
        id: news.id,
        title: news.title,
        published: news.published,
        isFeatured: news.isFeatured,
        createdAt: news.createdAt
      })));
    }
  } catch (e) {
    console.error('❌ Erreur:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
