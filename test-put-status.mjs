import fetch from 'node-fetch';

async function main() {
  try {
    console.log('🧪 Test changement statut via API PUT...\n');
    
    const token = 'stub.YmVsYWlkaXc5MUBnbWFpbC5jb20='; // belaidiw91@gmail.com en base64
    const reportId = '1767491698768_p503lp9dp';
    
    console.log('Avant changement:');
    let res = await fetch(`http://localhost:4000/api/finance/expense-reports`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    let data = await res.json();
    let report = data.reports?.find(r => r.id === reportId);
    if (report) {
      console.log(`   Statut: ${report.status}`);
    } else {
      console.log('   ❌ NDF non trouvée');
    }
    
    console.log('\nEnvoi PUT pour changer le statut en "paid"...');
    res = await fetch(`http://localhost:4000/api/finance/expense-reports/${reportId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status: 'paid' })
    });
    
    const updateResponse = await res.json();
    console.log('Réponse API:');
    console.log(JSON.stringify(updateResponse, null, 2));
    
    console.log('\nAprès changement (via GET):');
    res = await fetch(`http://localhost:4000/api/finance/expense-reports`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    data = await res.json();
    report = data.reports?.find(r => r.id === reportId);
    if (report) {
      console.log(`   Statut: ${report.status}`);
      console.log('   ✅ Statut changé en base!');
    } else {
      console.log('   ❌ NDF non trouvée');
    }
    
  } catch (e) {
    console.error('❌ Erreur:', e.message);
  }
}

main();
