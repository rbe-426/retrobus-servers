import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001';
const TEST_TOKEN = process.env.TEST_TOKEN || 'test-token'; // You'll need to provide a valid token

async function testTransactionEndpoint() {
  console.log('🧪 Test de création de transaction...\n');
  
  try {
    // Test 1: Créer une transaction
    console.log('📝 Test 1: POST /api/finance/transactions');
    const createResponse = await fetch(`${API_BASE}/api/finance/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_TOKEN}`
      },
      body: JSON.stringify({
        type: 'recette',
        amount: 100.50,
        description: 'Test transaction',
        category: 'ADHESION',
        date: new Date().toISOString()
      })
    });

    const status1 = createResponse.status;
    const data1 = await createResponse.json();
    
    console.log(`Status: ${status1}`);
    console.log('Response:', JSON.stringify(data1, null, 2));
    
    if (status1 !== 201) {
      console.error('❌ Erreur lors de la création de la transaction');
      return;
    }

    const transactionId = data1.id;
    console.log(`✅ Transaction créée: ${transactionId}\n`);

    // Test 2: Récupérer les transactions
    console.log('📝 Test 2: GET /api/finance/transactions');
    const getResponse = await fetch(`${API_BASE}/api/finance/transactions`, {
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`
      }
    });

    const status2 = getResponse.status;
    const data2 = await getResponse.json();
    
    console.log(`Status: ${status2}`);
    console.log('Response:', JSON.stringify(data2, null, 2));
    
    if (status2 !== 200) {
      console.error('❌ Erreur lors de la récupération des transactions');
      return;
    }

    console.log(`✅ ${data2.transactions?.length || 0} transaction(s) trouvée(s)\n`);

    // Test 3: Modifier la transaction
    if (transactionId) {
      console.log('📝 Test 3: PUT /api/finance/transactions/:id');
      const updateResponse = await fetch(`${API_BASE}/api/finance/transactions/${transactionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TEST_TOKEN}`
        },
        body: JSON.stringify({
          amount: 150.75,
          description: 'Test transaction modifiée'
        })
      });

      const status3 = updateResponse.status;
      const data3 = await updateResponse.json();
      
      console.log(`Status: ${status3}`);
      console.log('Response:', JSON.stringify(data3, null, 2));
      
      if (status3 === 200) {
        console.log('✅ Transaction modifiée avec succès\n');
      }

      // Test 4: Supprimer la transaction
      console.log('📝 Test 4: DELETE /api/finance/transactions/:id');
      const deleteResponse = await fetch(`${API_BASE}/api/finance/transactions/${transactionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${TEST_TOKEN}`
        }
      });

      const status4 = deleteResponse.status;
      const data4 = await deleteResponse.json();
      
      console.log(`Status: ${status4}`);
      console.log('Response:', JSON.stringify(data4, null, 2));
      
      if (status4 === 200) {
        console.log('✅ Transaction supprimée avec succès');
      }
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

testTransactionEndpoint();
