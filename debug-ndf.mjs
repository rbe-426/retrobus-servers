import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('📋 ===== DIAGNOSTIC NDF =====\n');
    
    // 1. Vérifier en base de données
    console.log('1️⃣  NDFs en base de données:');
    const dbReports = await prisma.finance_expense_reports.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`   Total: ${dbReports.length}`);
    dbReports.forEach((r, i) => {
      console.log(`   ${i + 1}. ID: ${r.id}`);
      console.log(`      Description: ${r.description}`);
      console.log(`      Montant: ${r.amount}€`);
      console.log(`      Statut: ${r.status}`);
      console.log(`      Créée par: ${r.requestedByName || r.createdBy || 'N/A'}`);
      console.log(`      Email: ${r.requestedByEmail || 'N/A'}`);
      console.log('');
    });

    // 2. Vérifier l'API
    console.log('\n2️⃣  NDFs via API GET /api/finance/expense-reports:');
    try {
      const res = await fetch('http://localhost:4000/api/finance/expense-reports', {
        headers: {
          'Authorization': 'Bearer stub.dGVzdEBleGFtcGxlLmNvbQ=='
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        const reports = data.reports || [];
        console.log(`   Total retourné: ${reports.length}`);
        reports.forEach((r, i) => {
          console.log(`   ${i + 1}. ID: ${r.id}`);
          console.log(`      Description: ${r.description}`);
          console.log(`      Montant: ${r.amount}€`);
          console.log(`      Statut: ${r.status}`);
          console.log('');
        });
      } else {
        console.log(`   ❌ Erreur API: ${res.status}`);
      }
    } catch (e) {
      console.log(`   ⚠️  Impossible de joindre l'API: ${e.message}`);
    }

  } catch (e) {
    console.error('❌ Erreur:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
