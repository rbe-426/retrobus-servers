#!/usr/bin/env node

/**
 * Diagnostic: Check if TOKEN_SECRET is properly configured
 * Run this on your Railway deployment to verify
 */

console.log('🔍 TOKEN_SECRET Configuration Diagnostic\n');

// Check 1: Environment variable
const tokenSecret = process.env.TOKEN_SECRET;
if (tokenSecret) {
  console.log('✅ TOKEN_SECRET is SET in environment');
  console.log(`   Value: ${tokenSecret.substring(0, 30)}...${tokenSecret.substring(tokenSecret.length - 10)}`);
  console.log(`   Length: ${tokenSecret.length} characters`);
} else {
  console.log('❌ TOKEN_SECRET is NOT set in environment variables');
  console.log('   → Backend will generate a RANDOM secret each time');
  console.log('   → This causes token validation to FAIL (401 errors)\n');
  
  // Simulate what happens
  const crypto = require('crypto');
  const fallback1 = crypto.randomBytes(32).toString('hex');
  const fallback2 = crypto.randomBytes(32).toString('hex');
  console.log('   Example of what happens:');
  console.log(`   Token creation uses: ${fallback1.substring(0, 20)}...`);
  console.log(`   Token validation uses: ${fallback2.substring(0, 20)}...`);
  console.log('   Signature mismatch → 401 Unauthorized\n');
}

// Check 2: Other important variables
const envVars = {
  'NODE_ENV': 'production',
  'PORT': '8080',
  'DATABASE_URL': 'Set',
  'CSRF_SECRET': 'Set',
  'VITE_API_URL': 'Set'
};

console.log('📋 Other Environment Variables:\n');
Object.entries(envVars).forEach(([key, needed]) => {
  const value = process.env[key];
  if (value) {
    console.log(`✅ ${key} = ${typeof value === 'string' && value.length > 50 ? value.substring(0, 30) + '...' : value}`);
  } else {
    console.log(`⚠️  ${key} is NOT set`);
  }
});

console.log('\n📌 SOLUTION:\n');
console.log('1. Go to Railway Dashboard');
console.log('2. Select your interne-api service');
console.log('3. Go to Variables/Environment');
console.log('4. Add TOKEN_SECRET = retrobus_secure_token_secret_2026_stable_production_key');
console.log('5. Redeploy');
console.log('6. Check logs - you should see ✅ above\n');
