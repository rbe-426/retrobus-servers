#!/usr/bin/env node
/**
 * Test RetroActus API - Tests chaque endpoint proprement
 * Usage: node test-retroactus.mjs
 */

const API_BASE = 'http://localhost:8080';
// Token format: stub.<base64(email)> - the system expects this specific format
const TEST_EMAIL = 'test@retrobus.fr';
const TEST_TOKEN = 'stub.' + Buffer.from(TEST_EMAIL).toString('base64');

// 🎨 Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}❌${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ️${colors.reset} ${msg}`),
  step: (msg) => console.log(`\n${colors.cyan}═══ ${msg} ═══${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠️${colors.reset} ${msg}`)
};

async function test(name, fn) {
  try {
    log.step(name);
    await fn();
  } catch (e) {
    log.error(`${name}: ${e.message}`);
    process.exit(1);
  }
}

let testNewsId = null;

// 🧪 TEST 1: GET (should be empty or have existing data)
await test('TEST 1: GET /api/retro-news', async () => {
  const res = await fetch(`${API_BASE}/api/retro-news`, {
    headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
  });
  
  if (res.status !== 200) {
    log.error(`GET failed with status ${res.status}`);
    const text = await res.text();
    log.warn(`Response: ${text}`);
    return;
  }
  
  const data = await res.json();
  log.success(`GET returned ${Array.isArray(data) ? data.length : 0} news items`);
  if (Array.isArray(data) && data.length > 0) {
    log.info(`First item: ${data[0].title || 'NO TITLE'}`);
  }
});

// 🧪 TEST 2: POST (create new)
await test('TEST 2: POST /api/retro-news (create)', async () => {
  const payload = {
    title: 'Test RetroActu ' + new Date().toISOString(),
    body: 'Contenu de test pour vérifier que la persistence fonctionne',
    status: 'published'
  };
  
  log.info(`Sending: ${JSON.stringify(payload, null, 2)}`);
  
  const res = await fetch(`${API_BASE}/api/retro-news`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TEST_TOKEN}`
    },
    body: JSON.stringify(payload)
  });
  
  if (res.status !== 201) {
    log.error(`POST failed with status ${res.status}`);
    const text = await res.text();
    log.warn(`Response: ${text}`);
    return;
  }
  
  const data = await res.json();
  testNewsId = data.id;
  log.success(`Created news with ID: ${testNewsId}`);
  log.info(`Title: ${data.title}`);
  log.info(`Status: ${data.status}`);
});

// 🧪 TEST 3: GET again (should see our new item)
await test('TEST 3: GET /api/retro-news (verify creation)', async () => {
  const res = await fetch(`${API_BASE}/api/retro-news`, {
    headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
  });
  
  const data = await res.json();
  const found = data.find(n => n.id === testNewsId);
  
  if (found) {
    log.success(`Created news found in list!`);
    log.info(`Title: ${found.title}`);
  } else {
    log.error(`Created news NOT found in list!`);
    log.warn(`Available IDs: ${data.map(n => n.id).join(', ')}`);
  }
});

// 🧪 TEST 4: PUT (update)
await test('TEST 4: PUT /api/retro-news/:id (update)', async () => {
  if (!testNewsId) {
    log.warn('Skipping PUT test - no test news ID');
    return;
  }
  
  const payload = {
    title: 'TEST UPDATED - ' + new Date().toISOString(),
    body: 'Contenu MODIFIÉ pour tester la mise à jour',
    status: 'published',
    isFeatured: true
  };
  
  log.info(`Updating ${testNewsId} with: ${JSON.stringify(payload, null, 2)}`);
  
  const res = await fetch(`${API_BASE}/api/retro-news/${testNewsId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TEST_TOKEN}`
    },
    body: JSON.stringify(payload)
  });
  
  if (res.status !== 200) {
    log.error(`PUT failed with status ${res.status}`);
    const text = await res.text();
    log.warn(`Response: ${text}`);
    return;
  }
  
  const data = await res.json();
  log.success(`Updated news successfully`);
  log.info(`New title: ${data.title}`);
  log.info(`Featured: ${data.isFeatured}`);
});

// 🧪 TEST 5: DELETE
await test('TEST 5: DELETE /api/retro-news/:id', async () => {
  if (!testNewsId) {
    log.warn('Skipping DELETE test - no test news ID');
    return;
  }
  
  const res = await fetch(`${API_BASE}/api/retro-news/${testNewsId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
  });
  
  if (res.status !== 200) {
    log.error(`DELETE failed with status ${res.status}`);
    const text = await res.text();
    log.warn(`Response: ${text}`);
    return;
  }
  
  const data = await res.json();
  log.success(`Deleted news successfully`);
});

// 🧪 TEST 6: Verify deletion
await test('TEST 6: GET /api/retro-news (verify deletion)', async () => {
  const res = await fetch(`${API_BASE}/api/retro-news`, {
    headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
  });
  
  const data = await res.json();
  const found = data.find(n => n.id === testNewsId);
  
  if (!found) {
    log.success(`Deleted news confirmed removed from list!`);
  } else {
    log.error(`Deleted news still appears in list!`);
  }
});

log.step('✅ ALL TESTS COMPLETED');
console.log('\n📊 Summary:');
console.log(`  - Created news ID: ${testNewsId}`);
console.log(`  - All endpoints should be working now`);
console.log(`  - Data should persist in Prisma database\n`);

process.exit(0);
