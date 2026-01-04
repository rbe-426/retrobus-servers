import fetch from 'node-fetch';

async function main() {
  try {
    console.log('🧪 Test création NDF via API...\n');
    
    const token = 'stub.dGVzdEBleGFtcGxlLmNvbQ=='; // test@example.com
    
    const payload = {
      description: 'Test API NDF',
      amount: 75.50,
      date: new Date().toISOString().split('T')[0],
      status: 'open'
    };
    
    console.log('Payload envoyé:');
    console.log(JSON.stringify(payload, null, 2));
    
    const res = await fetch('http://localhost:4000/api/finance/expense-reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    
    const data = await res.json();
    
    console.log('\n✅ Réponse API:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.report) {
      console.log('\n📋 NDF créée:');
      console.log(`   ID: ${data.report.id}`);
      console.log(`   Description: ${data.report.description}`);
      console.log(`   Montant: ${data.report.amount}€`);
      console.log(`   userId: ${data.report.userId}`);
      console.log(`   createdBy: ${data.report.createdBy}`);
    }
    
  } catch (e) {
    console.error('❌ Erreur:', e.message);
  }
}

main();
