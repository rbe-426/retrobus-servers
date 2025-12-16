#!/usr/bin/env node

import dotenv from 'dotenv';

dotenv.config();

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001';
const TEST_EMAIL = 'test@example.com';
const TEST_TOKEN = `stub.${Buffer.from(TEST_EMAIL).toString('base64')}`;

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

let testsPassed = 0;
let testsFailed = 0;

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

async function test(name, fn) {
  try {
    log(`\n▶️  ${name}`, 'blue');
    await fn();
    log(`✅ ${name}`, 'green');
    testsPassed++;
  } catch (error) {
    log(`❌ ${name}: ${error.message}`, 'red');
    testsFailed++;
  }
}

async function request(method, path, body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TEST_TOKEN}`
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${API_BASE}${path}`, options);
  const data = await response.json();
  
  return { status: response.status, data };
}

// ==========================================
// TEST TRANSACTIONS
// ==========================================
let transactionId = null;

await test('POST /api/finance/transactions - Créer une transaction', async () => {
  const { status, data } = await request('POST', '/api/finance/transactions', {
    type: 'recette',
    amount: 100.50,
    description: 'Test transaction recette',
    category: 'ADHESION',
    date: new Date().toISOString()
  });
  
  if (status !== 201) throw new Error(`Status ${status}, expected 201. ${JSON.stringify(data)}`);
  if (!data.id) throw new Error('No transaction ID returned');
  
  transactionId = data.id;
  log(`  → Created transaction: ${transactionId}`, 'cyan');
});

await test('GET /api/finance/transactions - Récupérer les transactions', async () => {
  const { status, data } = await request('GET', '/api/finance/transactions');
  
  if (status !== 200) throw new Error(`Status ${status}, expected 200`);
  if (!Array.isArray(data.transactions)) throw new Error('transactions is not an array');
  
  log(`  → Found ${data.transactions.length} transactions`, 'cyan');
});

await test('PUT /api/finance/transactions/:id - Modifier une transaction', async () => {
  if (!transactionId) throw new Error('No transaction ID from previous test');
  
  const { status, data } = await request('PUT', `/api/finance/transactions/${transactionId}`, {
    amount: 150.75,
    description: 'Test transaction modifiée'
  });
  
  if (status !== 200) throw new Error(`Status ${status}, expected 200. ${JSON.stringify(data)}`);
  if (data.amount !== 150.75) throw new Error('Amount not updated');
  
  log(`  → Updated transaction amount to ${data.amount}`, 'cyan');
});

await test('DELETE /api/finance/transactions/:id - Supprimer une transaction', async () => {
  if (!transactionId) throw new Error('No transaction ID from previous test');
  
  const { status, data } = await request('DELETE', `/api/finance/transactions/${transactionId}`);
  
  if (status !== 200) throw new Error(`Status ${status}, expected 200. ${JSON.stringify(data)}`);
  
  log(`  → Deleted transaction ${transactionId}`, 'cyan');
});

// ==========================================
// TEST DEVIS LINES
// ==========================================
let devisLineId = null;

await test('POST /api/devis-lines - Créer une ligne de devis', async () => {
  const { status, data } = await request('POST', '/api/devis-lines', {
    devisId: 'DEVIS-001',
    description: 'Service test',
    quantity: 2,
    unitPrice: 100,
    totalPrice: 200,
    order: 0
  });
  
  if (status !== 201) throw new Error(`Status ${status}, expected 201. ${JSON.stringify(data)}`);
  if (!data.id) throw new Error('No devis line ID returned');
  
  devisLineId = data.id;
  log(`  → Created devis line: ${devisLineId}`, 'cyan');
});

await test('GET /api/devis-lines - Récupérer toutes les lignes de devis', async () => {
  const { status, data } = await request('GET', '/api/devis-lines');
  
  if (status !== 200) throw new Error(`Status ${status}, expected 200`);
  if (!Array.isArray(data)) throw new Error('devis lines is not an array');
  
  log(`  → Found ${data.length} devis lines`, 'cyan');
});

await test('GET /api/devis-lines/:devisId - Récupérer les lignes d\'un devis spécifique', async () => {
  const { status, data } = await request('GET', '/api/devis-lines/DEVIS-001');
  
  if (status !== 200) throw new Error(`Status ${status}, expected 200`);
  if (!Array.isArray(data.lines)) throw new Error('lines is not an array');
  
  log(`  → Found ${data.lines.length} lines for DEVIS-001`, 'cyan');
});

await test('PUT /api/devis-lines/:lineId - Modifier une ligne de devis', async () => {
  if (!devisLineId) throw new Error('No devis line ID from previous test');
  
  const { status, data } = await request('PUT', `/api/devis-lines/${devisLineId}`, {
    quantity: 3,
    totalPrice: 300
  });
  
  if (status !== 200) throw new Error(`Status ${status}, expected 200. ${JSON.stringify(data)}`);
  if (data.quantity !== 3) throw new Error('Quantity not updated');
  
  log(`  → Updated devis line quantity to ${data.quantity}`, 'cyan');
});

await test('DELETE /api/devis-lines/:lineId - Supprimer une ligne de devis', async () => {
  if (!devisLineId) throw new Error('No devis line ID from previous test');
  
  const { status, data } = await request('DELETE', `/api/devis-lines/${devisLineId}`);
  
  if (status !== 200) throw new Error(`Status ${status}, expected 200. ${JSON.stringify(data)}`);
  
  log(`  → Deleted devis line ${devisLineId}`, 'cyan');
});

// ==========================================
// TEST FINANCIAL DOCUMENTS
// ==========================================
let docId = null;

await test('POST /api/financial-documents - Créer un document financier', async () => {
  const { status, data } = await request('POST', '/api/financial-documents', {
    type: 'QUOTE',
    number: 'QUOTE-001',
    title: 'Devis test',
    description: 'Devis de test',
    amount: 500,
    createdBy: 'test-user'
  });
  
  if (status !== 201) throw new Error(`Status ${status}, expected 201. ${JSON.stringify(data)}`);
  if (!data.id) throw new Error('No document ID returned');
  
  docId = data.id;
  log(`  → Created document: ${docId}`, 'cyan');
});

await test('GET /api/financial-documents - Récupérer les documents financiers', async () => {
  const { status, data } = await request('GET', '/api/financial-documents');
  
  if (status !== 200) throw new Error(`Status ${status}, expected 200`);
  if (!Array.isArray(data.financialDocuments) && !Array.isArray(data)) {
    throw new Error('Documents is not an array');
  }
  
  const docs = data.financialDocuments || data;
  log(`  → Found ${docs.length} financial documents`, 'cyan');
});

await test('PUT /api/financial-documents/:docId - Modifier un document financier', async () => {
  if (!docId) throw new Error('No document ID from previous test');
  
  const { status, data } = await request('PUT', `/api/financial-documents/${docId}`, {
    amount: 600,
    description: 'Devis modifié'
  });
  
  if (status !== 200) throw new Error(`Status ${status}, expected 200. ${JSON.stringify(data)}`);
  if (data.amount !== 600) throw new Error('Amount not updated');
  
  log(`  → Updated document amount to ${data.amount}`, 'cyan');
});

await test('DELETE /api/financial-documents/:docId - Supprimer un document financier', async () => {
  if (!docId) throw new Error('No document ID from previous test');
  
  const { status, data } = await request('DELETE', `/api/financial-documents/${docId}`);
  
  if (status !== 200) throw new Error(`Status ${status}, expected 200. ${JSON.stringify(data)}`);
  
  log(`  → Deleted document ${docId}`, 'cyan');
});

// ==========================================
// SCHEMA VALIDATION TESTS
// ==========================================
await test('Schema Validation: Transaction fields exist', async () => {
  const { status, data } = await request('POST', '/api/finance/transactions', {
    type: 'depense',
    amount: 50,
    description: 'Test schema validation',
    category: 'AUTRE',
    date: new Date().toISOString()
  });
  
  if (status !== 201) throw new Error(`Status ${status}`);
  
  const tx = data;
  if (!tx.id || !tx.type || !tx.amount || !tx.description) {
    throw new Error('Missing required fields in response');
  }
  
  // Clean up
  await request('DELETE', `/api/finance/transactions/${tx.id}`);
  log(`  → Schema validation passed`, 'cyan');
});

await test('Schema Validation: DevisLine fields exist', async () => {
  const { status, data } = await request('POST', '/api/devis-lines', {
    devisId: 'TEST-DEVIS',
    description: 'Test item',
    quantity: 1,
    unitPrice: 100,
    totalPrice: 100
  });
  
  if (status !== 201) throw new Error(`Status ${status}`);
  
  const line = data;
  if (!line.id || !line.devisId || !line.description) {
    throw new Error('Missing required fields in response');
  }
  
  // Clean up
  await request('DELETE', `/api/devis-lines/${line.id}`);
  log(`  → Schema validation passed`, 'cyan');
});

await test('Schema Validation: FinancialDocument fields exist', async () => {
  const { status, data } = await request('POST', '/api/financial-documents', {
    type: 'INVOICE',
    number: 'INV-TEST-001',
    title: 'Test Invoice',
    amount: 1000,
    createdBy: 'test-user'
  });
  
  if (status !== 201) throw new Error(`Status ${status}`);
  
  const doc = data;
  if (!doc.id || !doc.type || !doc.number || !doc.title) {
    throw new Error('Missing required fields in response');
  }
  
  // Clean up
  await request('DELETE', `/api/financial-documents/${doc.id}`);
  log(`  → Schema validation passed`, 'cyan');
});

// ==========================================
// RAPPORT FINAL
// ==========================================
log('\n' + '='.repeat(50), 'cyan');
log('RAPPORT DES TESTS', 'cyan');
log('='.repeat(50), 'cyan');
log(`✅ Tests passés: ${testsPassed}`, 'green');
log(`❌ Tests échoués: ${testsFailed}`, testsFailed > 0 ? 'red' : 'green');
log('='.repeat(50), 'cyan');

if (testsFailed === 0) {
  log('\n🎉 TOUS LES TESTS SONT PASSÉS!', 'green');
  process.exit(0);
} else {
  log(`\n⚠️  ${testsFailed} test(s) ont échoué`, 'red');
  process.exit(1);
}
