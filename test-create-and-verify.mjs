import fetch from 'node-fetch';

const API_BASE = 'https://attractive-kindness-rbe-serveurs.up.railway.app';
const token = 'stub.' + Buffer.from('test@retrobus.fr').toString('base64');

async function test() {
  try {
    console.log('🧪 Création nouvelle note...');
    
    const res = await fetch(`${API_BASE}/api/finance/expense-reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        description: `Test ${Date.now()}`,
        amount: Math.random() * 100,
        date: new Date().toISOString(),
        notes: 'Test'
      })
    });

    console.log('Status:', res.status);
    const data = await res.json();
    const id = data.report?.id;
    console.log('✅ Créée:', id);

    // Attendre un peu
    await new Promise(r => setTimeout(r, 500));
    
    // Vérifier
    console.log('\n🔍 Vérification...');
    const getRes = await fetch(`${API_BASE}/api/finance/expense-reports`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const getData = await getRes.json();
    const found = getData.reports?.find(r => r.id === id);
    
    if (found) {
      console.log('✅ TROUVÉE en BD!');
    } else {
      console.log('❌ NOT FOUND');
      console.log('Notes actuelles:', getData.reports?.map(r => r.id));
    }
  } catch (e) {
    console.error('❌', e.message);
  }
}

test();
