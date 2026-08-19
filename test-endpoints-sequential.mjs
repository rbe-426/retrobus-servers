#!/usr/bin/env node

/**
 * Better test - creates vehicle first, then tests usage with that parc
 */

const BASE_URL = process.env.API_URL || 'https://attractive-kindness-rbe-serveurs.up.railway.app';
const TOKEN_RAW = 'stub.' + Buffer.from('test@retrobus.fr').toString('base64');
const AUTH_HEADER = `Bearer ${TOKEN_RAW}`;

async function runTests() {
  console.log('🧪 Testing endpoints in sequence...\n');

  try {
    // Test 1: Create Vehicle
    console.log('1️⃣ Creating Vehicle...');
    const vehicleData = {
      parc: `TEST-${Math.random().toString(36).substring(7).toUpperCase()}`,
      marque: 'Test Brand',
      modele: 'Test Model',
      type: 'car',
      etat: 'OK'
    };

    const vehicleRes = await fetch(`${BASE_URL}/api/vehicle`, {
      method: 'POST',
      headers: {
        'Authorization': AUTH_HEADER,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(vehicleData)
    });

    const vehicleJson = await vehicleRes.json();
    console.log(`   Status: ${vehicleRes.status}`);
    
    if (!vehicleRes.ok) {
      console.log(`   ❌ Error:`, vehicleJson);
      return;
    }
    
    console.log(`   ✅ Vehicle created: parc=${vehicleJson.parc}\n`);

    // Test 2: Create Event
    console.log('2️⃣ Creating Event...');
    const eventRes = await fetch(`${BASE_URL}/api/event`, {
      method: 'POST',
      headers: {
        'Authorization': AUTH_HEADER,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: `Test Event ${Date.now()}`,
        date: new Date().toISOString()
      })
    });

    const eventJson = await eventRes.json();
    console.log(`   Status: ${eventRes.status}`);
    if (eventRes.ok) console.log(`   ✅ Event created\n`);
    else console.log(`   ❌ Error:`, eventJson, '\n');

    // Test 3: Create Flash
    console.log('3️⃣ Creating Flash...');
    const flashRes = await fetch(`${BASE_URL}/api/flash`, {
      method: 'POST',
      headers: {
        'Authorization': AUTH_HEADER,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: 'Test flash content'
      })
    });

    const flashJson = await flashRes.json();
    console.log(`   Status: ${flashRes.status}`);
    if (flashRes.ok) console.log(`   ✅ Flash created\n`);
    else console.log(`   ❌ Error:`, flashJson, '\n');

    // Test 4: Create Usage with the parc we created
    console.log(`4️⃣ Creating Usage with parc=${vehicleJson.parc}...`);
    const usageRes = await fetch(`${BASE_URL}/api/usage`, {
      method: 'POST',
      headers: {
        'Authorization': AUTH_HEADER,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        parc: vehicleJson.parc,
        startedAt: new Date().toISOString(),
        conducteur: 'Test Driver'
      })
    });

    const usageJson = await usageRes.json();
    console.log(`   Status: ${usageRes.status}`);
    if (usageRes.ok) {
      console.log(`   ✅ Usage created\n`);
    } else {
      console.log(`   ❌ Error:`, usageJson, '\n');
    }

    // Summary
    console.log('════════════════════════════════════════');
    console.log('✅ All tests completed!');
    console.log('   Vehicle: ✅');
    console.log('   Event: ' + (eventRes.ok ? '✅' : '❌'));
    console.log('   Flash: ' + (flashRes.ok ? '✅' : '❌'));
    console.log('   Usage: ' + (usageRes.ok ? '✅' : '❌'));
    console.log('════════════════════════════════════════');

  } catch (e) {
    console.error('❌ Test error:', e.message);
  }
}

runTests();
