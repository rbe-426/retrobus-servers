/**
 * Script pour vérifier et créer les dossiers nécessaires pour les uploads
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const requiredDirs = [
  path.join(__dirname, 'uploads'),
  path.join(__dirname, 'uploads/temp'),
  path.join(__dirname, 'uploads/team-avatars')
];

console.log('🔍 Vérification des dossiers d\'upload...\n');

requiredDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    console.log(`✅ ${dir} - EXISTE`);
    
    // Vérifier les permissions
    try {
      fs.accessSync(dir, fs.constants.W_OK | fs.constants.R_OK);
      console.log(`   ✅ Permissions lecture/écriture OK`);
    } catch (err) {
      console.log(`   ❌ Permissions insuffisantes:`, err.message);
    }
  } else {
    console.log(`❌ ${dir} - N'EXISTE PAS`);
    console.log(`   ➡️ Création...`);
    
    try {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`   ✅ Créé avec succès`);
    } catch (err) {
      console.error(`   ❌ Erreur création:`, err.message);
    }
  }
  console.log('');
});

console.log('✅ Vérification terminée');
