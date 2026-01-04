import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('📋 Récupération des notes de frais...');
    const reports = await prisma.finance_expense_reports.findMany({
      orderBy: { createdAt: 'desc' }
    });

    console.log(`\n📊 Trouvé ${reports.length} notes de frais:\n`);
    
    reports.forEach((r, i) => {
      console.log(`${i + 1}. ID: ${r.id}`);
      console.log(`   Description: ${r.description}`);
      console.log(`   Montant: ${r.amount}€`);
      console.log(`   Statut: ${r.status}`);
      console.log(`   Créée: ${r.createdAt}`);
      console.log(`   Par: ${r.requestedByName || 'N/A'}`);
      console.log('');
    });

    // Demander confirmation avant suppression
    console.log('❌ Suppression des notes fictives (toutes les 4)...');
    const deleted = await prisma.finance_expense_reports.deleteMany();
    
    console.log(`✅ ${deleted.count} notes de frais supprimées`);
    
  } catch (e) {
    console.error('❌ Erreur:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
