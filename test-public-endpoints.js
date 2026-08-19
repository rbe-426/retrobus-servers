#!/usr/bin/env node

/**
 * Test des nouveaux endpoints publics
 * Vérifie que /public/vehicles et /public/events sont accessibles
 */

const API_BASE = 'http://localhost:3001';

async function testPublicEndpoints() {
  console.log('🧪 Testing public endpoints...\n');

  try {
    // Test 1: GET /public/vehicles
    console.log('📍 Test 1: GET /public/vehicles');
    const vehiclesRes = await fetch(`${API_BASE}/public/vehicles`);
    console.log(`Status: ${vehiclesRes.status}`);
    if (vehiclesRes.ok) {
      const vehicles = await vehiclesRes.json();
      console.log(`✅ Vehicles: ${vehicles.length || 0} items`);
      if (vehicles.length > 0) {
        console.log(`   First vehicle:`, vehicles[0]);
      }
    } else {
      console.log(`❌ Error: ${vehiclesRes.status}`);
    }
    console.log('');

    // Test 2: GET /public/events
    console.log('📍 Test 2: GET /public/events');
    const eventsRes = await fetch(`${API_BASE}/public/events`);
    console.log(`Status: ${eventsRes.status}`);
    if (eventsRes.ok) {
      const events = await eventsRes.json();
      console.log(`✅ Events: ${events.length || 0} items`);
      if (events.length > 0) {
        console.log(`   First event:`, events[0]);
      }
    } else {
      console.log(`❌ Error: ${eventsRes.status}`);
    }
    console.log('');

    // Test 3: GET /public/vehicles/:parc
    console.log('📍 Test 3: GET /public/vehicles/RBE-001');
    const vehicleRes = await fetch(`${API_BASE}/public/vehicles/RBE-001`);
    console.log(`Status: ${vehicleRes.status}`);
    if (vehicleRes.ok) {
      const vehicle = await vehicleRes.json();
      console.log(`✅ Vehicle found:`, vehicle);
    } else {
      console.log(`❌ Error: ${vehicleRes.status}`);
    }
    console.log('');

    // Test 4: GET /public/events/:id
    console.log('📍 Test 4: GET /public/events/ev-demo-1');
    const eventRes = await fetch(`${API_BASE}/public/events/ev-demo-1`);
    console.log(`Status: ${eventRes.status}`);
    if (eventRes.ok) {
      const event = await eventRes.json();
      console.log(`✅ Event found:`, event);
    } else {
      console.log(`❌ Error: ${eventRes.status}`);
    }
    console.log('');

    console.log('✅ All tests completed!');
  } catch (err) {
    console.error('❌ Test failed:', err.message);
  }
}

testPublicEndpoints();
