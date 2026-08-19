import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function uid() {
  return Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

async function testCreate() {
  try {
    console.log('🧪 Test création directe via Prisma...');
    
    const reportData = {
      id: uid(),
      userId: 'test@retrobus.fr',
      createdBy: 'Test User',
      date: new Date(),
      description: 'Test direct Prisma',
      amount: 99.99,
      status: 'open',
      planned: false,
      fileName: null,
      fileUrl: null,
      eventId: null
    };
    
    console.log('Données à créer:', reportData);
    
    const saved = await prisma.finance_expense_reports.create({ data: reportData });
    console.log('✅ Créée avec succès:', saved.id);
    
    // Vérifier qu'elle est bien là
    const found = await prisma.finance_expense_reports.findUnique({
      where: { id: saved.id }
    });
    
    if (found) {
      console.log('✅ Retrouvée en BD:', found.id);
    } else {
      console.log('❌ NOT FOUND in DB!');
    }
  } catch (e) {
    console.error('❌ Erreur Prisma:', e.message);
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

testCreate();
