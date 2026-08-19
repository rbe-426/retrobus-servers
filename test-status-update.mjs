import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🧪 Test changement statut directement en BD...\n');
    
    // Récupérer la NDF
    const before = await prisma.finance_expense_reports.findUnique({
      where: { id: '1767491698768_p503lp9dp' }
    });
    
    console.log('Avant:');
    console.log(`   Statut: ${before.status}`);
    
    // Changer le statut
    const updated = await prisma.finance_expense_reports.update({
      where: { id: '1767491698768_p503lp9dp' },
      data: { status: 'approved' }
    });
    
    console.log('\nAprès update:');
    console.log(`   Statut: ${updated.status}`);
    
    // Relire pour confirmer
    const verified = await prisma.finance_expense_reports.findUnique({
      where: { id: '1767491698768_p503lp9dp' }
    });
    
    console.log('\nVérification (relecture):');
    console.log(`   Statut: ${verified.status}`);
    
    console.log('\n✅ Test passé - la mise à jour fonctionne en BD');
    
  } catch (e) {
    console.error('❌ Erreur:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
