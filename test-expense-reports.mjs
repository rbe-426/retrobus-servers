#!/usr/bin/env node

/**
 * Test script pour les notes de frais
 * Usage: node test-expense-reports.mjs <token>
 */

const API_BASE = process.env.API_URL || 'http://localhost:8080';
const TOKEN = process.argv[2] || process.env.TEST_TOKEN;

if (!TOKEN) {
  console.error('❌ Token manquant. Usage: node test-expense-reports.mjs <token>');
  process.exit(1);
}

async function test() {
  console.log('\n🧪 Test Endpoints Notes de Frais');
  console.log(`📍 Base URL: ${API_BASE}`);
  console.log(`🔐 Token: ${TOKEN.slice(0, 10)}...`);
  console.log('');

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${TOKEN}`
  };

  // Test 1: GET notes existantes
  console.log('1️⃣  GET /api/finance/expense-reports');
  try {
    const res = await fetch(`${API_BASE}/api/finance/expense-reports`, { headers });
    const data = await res.json();
    console.log(`✅ Status: ${res.status}`);
    console.log(`✅ Nombre de notes: ${data.reports?.length || 0}`);
    if (data.reports?.length > 0) {
      console.log(`✅ Première note:`, JSON.stringify(data.reports[0], null, 2));
    }
  } catch (e) {
    console.error(`❌ Erreur:`, e.message);
  }

  // Test 2: POST nouvelle note
  console.log('\n2️⃣  POST /api/finance/expense-reports (nouvelle note)');
  const newNote = {
    description: 'Test API note de frais',
    amount: 50.00,
    date: new Date().toISOString().split('T')[0],
    status: 'open'
  };

  try {
    const res = await fetch(`${API_BASE}/api/finance/expense-reports`, {
      method: 'POST',
      headers,
      body: JSON.stringify(newNote)
    });
    const data = await res.json();
    console.log(`✅ Status: ${res.status}`);
    console.log(`✅ Réponse:`, JSON.stringify(data.report || data, null, 2));

    // Test 3: PUT update si création OK
    if (data.report?.id || data.id) {
      const reportId = data.report?.id || data.id;
      console.log(`\n3️⃣  PUT /api/finance/expense-reports/${reportId} (mise à jour)`);
      
      try {
        const updateRes = await fetch(`${API_BASE}/api/finance/expense-reports/${reportId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ amount: 75.00, status: 'closed' })
        });
        const updateData = await updateRes.json();
        console.log(`✅ Status: ${updateRes.status}`);
        console.log(`✅ Réponse:`, JSON.stringify(updateData.report || updateData, null, 2));

        // Test 4: DELETE
        console.log(`\n4️⃣  DELETE /api/finance/expense-reports/${reportId} (suppression)`);
        try {
          const deleteRes = await fetch(`${API_BASE}/api/finance/expense-reports/${reportId}`, {
            method: 'DELETE',
            headers
          });
          const deleteData = await deleteRes.json();
          console.log(`✅ Status: ${deleteRes.status}`);
          console.log(`✅ Réponse:`, JSON.stringify(deleteData, null, 2));
        } catch (e) {
          console.error(`❌ Erreur DELETE:`, e.message);
        }
      } catch (e) {
        console.error(`❌ Erreur PUT:`, e.message);
      }
    }
  } catch (e) {
    console.error(`❌ Erreur POST:`, e.message);
  }

  // Test 5: Diagnostic
  console.log('\n5️⃣  GET /api/diagnostic/finance (diagnostic)');
  try {
    const res = await fetch(`${API_BASE}/api/diagnostic/finance`, { headers });
    const data = await res.json();
    console.log(`✅ Status: ${res.status}`);
    console.log(`✅ Diagnostic:`, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(`❌ Erreur:`, e.message);
  }

  console.log('\n✨ Tests terminés!');
}

test();
