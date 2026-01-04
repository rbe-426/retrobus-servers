import fetch from 'node-fetch';

async function main() {
  try {
    console.log('🧪 Test création opération programmée via API...\n');
    
    const token = 'stub.dGVzdEBleGFtcGxlLmNvbQ=='; // test@example.com
    
    const payload = {
      type: 'expense',
      description: 'Test opération programmée',
      amount: 150.00,
      dueDate: new Date().toISOString().split('T')[0],
      category: 'Dépenses administratives',
      recurring: 'MONTHLY',
      frequency: 'MONTHLY',
      notes: 'Test API'
    };
    
    console.log('Payload envoyé:');
    console.log(JSON.stringify(payload, null, 2));
    
    const res = await fetch('http://localhost:4000/api/finance/scheduled-operations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    
    const text = await res.text();
    console.log('\n📊 Status:', res.status);
    console.log('Response:', text);
    
    if (res.ok) {
      try {
        const data = JSON.parse(text);
        console.log('\n✅ Opération créée:');
        console.log(JSON.stringify(data, null, 2));
      } catch (e) {
        console.log('⚠️ Réponse non-JSON');
      }
    }
    
  } catch (e) {
    console.error('❌ Erreur:', e.message);
  }
}

main();
