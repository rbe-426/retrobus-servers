/**
 * Script de diagnostic - Teste l'authentification w.belaidi
 * 1. Teste la connexion
 * 2. Teste l'endpoint /api/me
 * 3. Vérifie que les rôles sont retournés
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.VITE_API_URL || 'http://localhost:4000';
const username = 'w.belaidi';
const password = 'Waiyl9134#';

console.log(`🔍 Diagnostic w.belaidi authentication\n`);
console.log(`API URL: ${API_URL}`);
console.log(`Username: ${username}\n`);

try {
  // 1. Try login
  console.log('1️⃣  Attempting login...');
  const loginRes = await fetch(`${API_URL}/auth/member-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: username, password })
  });

  console.log(`   Response status: ${loginRes.status}`);
  const loginData = await loginRes.json();
  console.log(`   Response:`, JSON.stringify(loginData, null, 2));

  if (!loginData.token) {
    console.log('❌ No token received!');
    process.exit(1);
  }

  const token = loginData.token;
  console.log(`   ✅ Token received: ${token.substring(0, 20)}...`);

  // 2. Test /api/me endpoint
  console.log('\n2️⃣  Testing /api/me endpoint...');
  const meRes = await fetch(`${API_URL}/api/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  console.log(`   Response status: ${meRes.status}`);
  const meData = await meRes.json();
  console.log(`   Response:`, JSON.stringify(meData, null, 2));

  if (meData.user) {
    console.log('\n✅ User data received:');
    console.log(`   ID: ${meData.user.id}`);
    console.log(`   Email: ${meData.user.email}`);
    console.log(`   Role: ${meData.user.role}`);
    console.log(`   Roles array:`, meData.user.roles || 'N/A');
    
    // Check if role is one of the allowed ones
    const allowedRoles = ['ADMIN', 'PRESIDENT', 'VICE_PRESIDENT', 'TRESORIER'];
    if (allowedRoles.includes(meData.user.role)) {
      console.log(`\n✅ Role "${meData.user.role}" is in allowed roles for expense management!`);
    } else {
      console.log(`\n❌ Role "${meData.user.role}" is NOT in allowed roles: ${allowedRoles.join(', ')}`);
    }
  } else {
    console.log('❌ No user data in response!');
  }

} catch (e) {
  console.error('❌ Error:', e.message);
}
