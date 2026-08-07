#!/usr/bin/env node

// Script pour auditer les données financières via l'API
const API_BASE = 'https://attractive-kindness-rbe-serveurs.up.railway.app';

const endpoints = [
  { name: '📋 Transactions', url: '/api/finance/transactions' },
  { name: '💰 Solde', url: '/api/finance/balance' },
  { name: '📝 Notes de frais', url: '/api/finance/expense-reports' },
  { name: '⏰ Opérations programmées', url: '/api/finance/scheduled-expenses' },
  { name: '🏷️ Catégories', url: '/api/finance/categories' },
  { name: '📄 Documents (devis/factures)', url: '/api/finance/documents' },
  { name: '📊 Simulations', url: '/api/finance/simulations' }
];

async function checkEndpoint(name, url) {
  try {
    console.log(`\n${name}`);
    const response = await fetch(API_BASE + url);
    const contentType = response.headers.get('content-type') || '';
    
    if (!response.ok) {
      console.log(`   ❌ Status ${response.status}: ${response.statusText}`);
      return;
    }

    if (contentType.includes('application/json')) {
      const data = await response.json();
      
      if (Array.isArray(data)) {
        console.log(`   ✅ ${data.length} éléments`);
        data.slice(0, 3).forEach((item, i) => {
          const desc = item.description || item.name || item.title || item.id;
          const amount = item.amount ? ` - ${item.amount}€` : '';
          const type = item.type ? ` [${item.type}]` : '';
          console.log(`      ${i+1}. ${desc}${type}${amount}`);
        });
        if (data.length > 3) console.log(`      ... et ${data.length - 3} autres`);
      } else if (typeof data === 'object' && data !== null) {
        // Objet
        if (data.transactions && Array.isArray(data.transactions)) {
          console.log(`   ✅ ${data.transactions.length} transactions`);
          data.transactions.slice(0, 3).forEach((t, i) => {
            console.log(`      ${i+1}. [${t.type}] ${t.description} - ${t.amount}€`);
          });
        } else if (data.balance !== undefined) {
          console.log(`   ✅ Solde: ${data.balance}€`);
        } else if (data.reports) {
          console.log(`   ✅ ${data.reports.length} rapports`);
        } else {
          console.log(`   ✅ Données:`, JSON.stringify(data).substring(0, 100));
        }
      } else {
        console.log(`   ✅ Données:`, data);
      }
    } else {
      console.log(`   ℹ️ Content-type: ${contentType}`);
    }
  } catch (error) {
    console.log(`   ⚠️ Erreur: ${error.message}`);
  }
}

async function main() {
  console.log('🔍 ===== AUDIT DONNÉES FINANCIÈRES VIA API =====');
  console.log(`📡 API: ${API_BASE}\n`);

  for (const endpoint of endpoints) {
    await checkEndpoint(endpoint.name, endpoint.url);
  }

  console.log('\n✅ Audit terminé!');
}

main().catch(console.error);
