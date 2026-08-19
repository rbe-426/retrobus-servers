import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔧 Correction NDF test direct Prisma...\n');
    
    // Trouver la NDF créée directement
    const report = await prisma.finance_expense_reports.findFirst({
      where: { description: 'Test direct Prisma' }
    });
    
    if (!report) {
      console.log('❌ NDF "Test direct Prisma" non trouvée');
      return;
    }
    
    console.log('Avant:');
    console.log(`   ID: ${report.id}`);
    console.log(`   userId: ${report.userId || 'NULL'}`);
    console.log(`   createdBy: ${report.createdBy || 'NULL'}`);
    
    // Ajouter les champs manquants
    const updated = await prisma.finance_expense_reports.update({
      where: { id: report.id },
      data: {
        userId: 'test@example.com',
        createdBy: 'Test User',
        requestedByName: 'Test User',
        requestedByEmail: 'test@example.com'
      }
    });
    
    console.log('\nAprès:');
    console.log(`   ID: ${updated.id}`);
    console.log(`   userId: ${updated.userId}`);
    console.log(`   createdBy: ${updated.createdBy}`);
    console.log(`   requestedByName: ${updated.requestedByName}`);
    console.log(`   requestedByEmail: ${updated.requestedByEmail}`);
    
    console.log('\n✅ NDF mise à jour!');
    
  } catch (e) {
    console.error('❌ Erreur:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
