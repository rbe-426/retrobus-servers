import fetch from 'node-fetch';

const API_BASE = 'https://attractive-kindness-rbe-serveurs.up.railway.app';
const token = 'stub.' + Buffer.from('test@retrobus.fr').toString('base64');

async function testCreateExpense() {
  try {
    console.log('🧪 Test création note de frais...');
    
    const res = await fetch(`${API_BASE}/api/finance/expense-reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        description: 'Test note de frais',
        amount: 50.00,
        date: new Date().toISOString(),
        notes: 'Ceci est un test'
      })
    });

    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Response:', JSON.stringify(data, null, 2));

    if (res.ok) {
      console.log('\n✅ Note créée avec ID:', data.report?.id || data.id);
      
      // Vérifier qu'elle est bien dans la BD
      console.log('\n🔍 Rechargement des notes de frais...');
      const getRes = await fetch(`${API_BASE}/api/finance/expense-reports`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const getData = await getRes.json();
      console.log('Notes trouvées:', getData.reports?.length || 0);
      console.log(JSON.stringify(getData, null, 2));
    }
  } catch (e) {
    console.error('❌ Erreur:', e.message);
  }
}

testCreateExpense();
