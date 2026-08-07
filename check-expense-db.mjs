import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  try {
    const reports = await prisma.finance_expense_reports.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`\nNotes de frais en BD: ${reports.length}`);
    reports.forEach(r => {
      console.log(`  - ${r.id}: ${r.description} (${r.amount}€) - ${r.status}`);
    });
  } catch (e) {
    console.error('❌ Erreur:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
