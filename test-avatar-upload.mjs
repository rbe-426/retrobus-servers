/**
 * Script pour tester l'upload d'avatar
 * Nécessite un membre existant dans la DB
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE = 'http://localhost:8080';
const MEMBER_ID = 'team_1'; // Waiyl Belaidi

async function testAvatarUpload() {
  console.log('🧪 Test upload avatar pour membre:', MEMBER_ID);
  
  // 1. Login pour obtenir le token
  console.log('\n1️⃣ Login...');
  const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'w.belaidi@retrobus-essonne.fr',
      password: 'votre_mot_de_passe_ici' // À remplacer
    })
  });

  if (!loginResponse.ok) {
    console.error('❌ Login échoué:', loginResponse.status);
    const error = await loginResponse.text();
    console.error(error);
    return;
  }

  const loginData = await loginResponse.json();
  const authToken = loginData.token;
  console.log('✅ Token obtenu:', authToken.substring(0, 20) + '...');

  // 2. Récupérer CSRF token
  console.log('\n2️⃣ Récupération CSRF token...');
  const csrfResponse = await fetch(`${API_BASE}/api/csrf-token`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${authToken}` }
  });

  if (!csrfResponse.ok) {
    console.error('❌ CSRF token échoué:', csrfResponse.status);
    return;
  }

  const csrfData = await csrfResponse.json();
  const csrfToken = csrfData.csrfToken;
  console.log('✅ CSRF token obtenu:', csrfToken.substring(0, 20) + '...');

  // 3. Créer une image de test
  console.log('\n3️⃣ Création image de test...');
  const testImagePath = path.join(__dirname, 'test-avatar.png');
  
  // Créer une image 100x100 PNG simple (carré bleu)
  const pngBuffer = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    // ... (header simplifié)
  ]);
  
  // Pour simplifier, utilisons un fichier existant ou créons un fichier texte
  fs.writeFileSync(testImagePath, 'fake image data for testing');
  console.log('✅ Fichier test créé:', testImagePath);

  // 4. Upload avatar
  console.log('\n4️⃣ Upload avatar...');
  
  const formData = new FormData();
  formData.append('avatar', fs.createReadStream(testImagePath), {
    filename: 'test-avatar.png',
    contentType: 'image/png'
  });

  const uploadResponse = await fetch(`${API_BASE}/api/team/${MEMBER_ID}/upload-avatar`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'X-CSRF-Token': csrfToken,
      ...formData.getHeaders()
    },
    body: formData
  });

  console.log('📊 Upload response status:', uploadResponse.status);
  
  if (uploadResponse.ok) {
    const result = await uploadResponse.json();
    console.log('✅ Upload réussi:', result);
  } else {
    const error = await uploadResponse.text();
    console.error('❌ Upload échoué:', error);
  }

  // Nettoyage
  fs.unlinkSync(testImagePath);
  console.log('\n🧹 Fichier test supprimé');
}

testAvatarUpload().catch(error => {
  console.error('❌ Erreur:', error);
});
