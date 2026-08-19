#!/usr/bin/env node

/**
 * CLI pour tester et diagnostiquer l'API Rétrobus
 * Usage: node cli-diagnostic.mjs <command> [args]
 */

import fetch from 'node-fetch';

const API_BASE = process.env.API_URL || 'http://localhost:8080';
const TOKEN = process.env.TEST_TOKEN || '';

const commands = {
  'test:expense-reports': testExpenseReports,
  'test:finance': testFinance,
  'diagnostic': runDiagnostic,
  'health': checkHealth,
  'help': showHelp
};

async function testExpenseReports() {
  if (!TOKEN) {
    console.error('❌ TEST_TOKEN not set');
    return;
  }
  
  console.log('\n🧪 Test: Expense Reports');
  const headers = { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
  
  // GET
  const getRes = await fetch(`${API_BASE}/api/finance/expense-reports`, { headers });
  console.log(`GET: ${getRes.status}`);
  
  // POST
  const postRes = await fetch(`${API_BASE}/api/finance/expense-reports`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ description: 'CLI Test', amount: 100 })
  });
  console.log(`POST: ${postRes.status}`);
  
  const { report } = await postRes.json();
  if (report?.id) {
    // PUT
    const putRes = await fetch(`${API_BASE}/api/finance/expense-reports/${report.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ amount: 150 })
    });
    console.log(`PUT: ${putRes.status}`);
    
    // DELETE
    const delRes = await fetch(`${API_BASE}/api/finance/expense-reports/${report.id}`, {
      method: 'DELETE',
      headers
    });
    console.log(`DELETE: ${delRes.status}`);
  }
}

async function testFinance() {
  if (!TOKEN) {
    console.error('❌ TEST_TOKEN not set');
    return;
  }
  
  console.log('\n🧪 Test: Finance Endpoints');
  const headers = { 'Authorization': `Bearer ${TOKEN}` };
  
  const endpoints = [
    '/api/finance/transactions',
    '/api/finance/expense-reports',
    '/api/finance/scheduled-expenses',
    '/api/finance/balance',
    '/api/finance/categories',
    '/api/financial-documents'
  ];
  
  for (const endpoint of endpoints) {
    const res = await fetch(`${API_BASE}${endpoint}`, { headers });
    console.log(`${endpoint}: ${res.status}`);
  }
}

async function runDiagnostic() {
  if (!TOKEN) {
    console.error('❌ TEST_TOKEN not set');
    return;
  }
  
  console.log('\n📊 Diagnostic: API Health');
  const headers = { 'Authorization': `Bearer ${TOKEN}` };
  
  const res = await fetch(`${API_BASE}/api/diagnostic/finance`, { headers });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

async function checkHealth() {
  console.log(`\n❤️ Health Check: ${API_BASE}`);
  try {
    const res = await fetch(`${API_BASE}/api/finance/balance`, {
      headers: { 'Authorization': `Bearer test` }
    });
    console.log(`Status: ${res.status}`);
    console.log('✅ API is running');
  } catch (e) {
    console.error('❌ API is not responding:', e.message);
  }
}

function showHelp() {
  console.log(`
CLI Diagnostic Commands:
  test:expense-reports  - Test expense reports CRUD
  test:finance          - Test all finance endpoints
  diagnostic            - Get API diagnostic data
  health                - Check API health
  help                  - Show this help
  
Environment:
  API_URL=http://localhost:8080
  TEST_TOKEN=your_token
  `);
}

const command = process.argv[2] || 'help';
const handler = commands[command];

if (handler) {
  handler().catch(console.error);
} else {
  console.error(`❌ Unknown command: ${command}`);
  showHelp();
}
