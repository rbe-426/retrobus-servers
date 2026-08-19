import fetch from 'node-fetch';

async function testPermissionsEndpointCall() {
  try {
    console.log('\n🧪 === TESTING /api/user-permissions ENDPOINT CALL ===\n');

    // Jarina's member ID from database
    const jarinaId = '1774963929195_dhqc16mrelj';
    const jarinaEmail = 'jarina.amolot@gmail.com';

    // Try to connect to backend server
    const port = process.env.PORT || 4000;
    const baseUrl = `http://localhost:${port}`;
    
    console.log(`Testing endpoint at: ${baseUrl}`);
    console.log(`Jarina ID: ${jarinaId}`);
    console.log(`Jarina Email: ${jarinaEmail}\n`);

    console.log(`1️⃣ TEST CALL #1: Using member ID`);
    console.log(`   URL: ${baseUrl}/api/user-permissions/${jarinaId}`);
    
    try {
      const res1 = await fetch(`${baseUrl}/api/user-permissions/${jarinaId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data1 = await res1.json();
      console.log(`   Status: ${res1.status}`);
      console.log(`   Permissions count: ${data1.permissions?.length || 0}`);
      
      if (data1.permissions && data1.permissions.length > 0) {
        console.log(`   ✅ Got permissions:`);
        data1.permissions.forEach(p => {
          console.log(`      - ${p.resource}: ${p.actions?.join(',') || 'NO ACTIONS'}`);
        });
      } else {
        console.log(`   ❌ NO permissions returned!`);
      }
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
    }

    console.log(`\n2️⃣ TEST CALL #2: Using email`);
    console.log(`   URL: ${baseUrl}/api/user-permissions/${jarinaEmail}`);
    
    try {
      const res2 = await fetch(`${baseUrl}/api/user-permissions/${jarinaEmail}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data2 = await res2.json();
      console.log(`   Status: ${res2.status}`);
      console.log(`   Permissions count: ${data2.permissions?.length || 0}`);
      
      if (data2.permissions && data2.permissions.length > 0) {
        console.log(`   ✅ Got permissions:`);
        data2.permissions.forEach(p => {
          console.log(`      - ${p.resource}: ${p.actions?.join(',') || 'NO ACTIONS'}`);
        });
      } else {
        console.log(`   ❌ NO permissions returned!`);
      }
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
    }

  } catch (e) {
    console.error('❌ Error:', e.message);
  }
}

testPermissionsEndpointCall();
