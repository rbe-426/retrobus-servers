import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  const docs = await prisma.financial_documents.findMany();
  console.log('✅ Total documents:', docs.length);
  
  const byType = {};
  docs.forEach(d => {
    byType[d.type] = (byType[d.type] || 0) + 1;
  });
  console.log('📊 By type:', byType);
  
  console.log('\n📋 Last 5 documents:');
  docs.slice(0, 5).forEach(d => {
    console.log(`  - ${d.id} | Type: ${d.type} | Number: ${d.number} | Title: ${d.title}`);
  });
} finally {
  await prisma.$disconnect();
}
