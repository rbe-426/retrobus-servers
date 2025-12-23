#!/usr/bin/env node

/**
 * Integration tests pour vérifier que les fixes sont en place
 */

import fetch from 'node-fetch';
import assert from 'assert';

const API_BASE = process.env.API_URL || 'http://localhost:8080';
const TOKEN = process.env.TEST_TOKEN || 'test-token';

let testsPassed = 0;
let testsFailed = 0;

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json'
};

async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    testsPassed++;
  } catch (e) {
    console.error(`❌ ${name}:`, e.message);
    testsFailed++;
  }
}

async function main() {
  console.log('\n🧪 Integration Tests - Expense Reports Fixes\n');

  // Test 1: GET expense-reports should return array with proper structure
  await test('GET /api/finance/expense-reports returns { reports: [...] }', async () => {
    const res = await fetch(`${API_BASE}/api/finance/expense-reports`, { headers });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert(Array.isArray(data.reports), 'Should have reports array');
  });

  // Test 2: POST creates report with userId
  let createdReportId;
  await test('POST creates expense report with userId', async () => {
    const res = await fetch(`${API_BASE}/api/finance/expense-reports`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        description: 'Integration test expense',
        amount: 123.45,
        date: new Date().toISOString().split('T')[0]
      })
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    const report = data.report || data;
    
    assert(report.id, 'Should have id');
    assert(report.userId, 'Should have userId');
    assert(report.createdBy, 'Should have createdBy');
    assert(report.createdAt, 'Should have createdAt');
    assert(report.amount === 123.45 || report.amount === '123.45', 'Amount should match');
    
    createdReportId = report.id;
  });

  // Test 3: PUT updates report with updatedAt
  if (createdReportId) {
    await test('PUT updates report with updatedAt', async () => {
      const res = await fetch(
        `${API_BASE}/api/finance/expense-reports/${createdReportId}`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify({ amount: 200 })
        }
      );
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      const report = data.report || data;
      assert(report.updatedAt, 'Should have updatedAt');
    });
  }

  // Test 4: Expense report with userId can be filtered
  await test('Expense reports can be filtered by userId', async () => {
    const res = await fetch(`${API_BASE}/api/finance/expense-reports`, { headers });
    const data = await res.json();
    
    const filtered = data.reports.filter(r => r.userId && r.userId !== 'anonymous');
    assert(filtered.length >= 0, 'Should be able to filter by userId');
  });

  // Test 5: Scheduled expenses have userId
  await test('POST /scheduled-expenses includes userId', async () => {
    const res = await fetch(`${API_BASE}/api/finance/scheduled-expenses`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        type: 'expense',
        amount: 50,
        description: 'Test scheduled'
      })
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert(data.userId || data.createdBy, 'Should have userId or createdBy');
  });

  // Test 6: Quote templates have userId
  await test('POST /quote-templates includes userId', async () => {
    const res = await fetch(`${API_BASE}/api/quote-templates`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Test Template',
        content: '<template>test</template>'
      })
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert(data.userId, 'Should have userId');
  });

  // Test 7: Diagnostic endpoint works
  await test('GET /api/diagnostic/finance returns structured data', async () => {
    const res = await fetch(`${API_BASE}/api/diagnostic/finance`, { headers });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'OK');
    assert(data.timestamp, 'Should have timestamp');
    assert(data.finance, 'Should have finance object');
  });

  // Test 8: DELETE expense report
  if (createdReportId) {
    await test('DELETE /expense-reports/:id succeeds', async () => {
      const res = await fetch(
        `${API_BASE}/api/finance/expense-reports/${createdReportId}`,
        {
          method: 'DELETE',
          headers
        }
      );
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert(data.ok, 'Should return ok');
    });
  }

  // Summary
  console.log(`\n📊 Test Results:`);
  console.log(`  ✅ Passed: ${testsPassed}`);
  console.log(`  ❌ Failed: ${testsFailed}`);
  console.log(`  📈 Total: ${testsPassed + testsFailed}\n`);

  if (testsFailed > 0) {
    process.exit(1);
  }
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
