/**
 * Backup complet depuis le serveur en mémoire
 * 
 * Ce script sauvegarde l'état en mémoire du serveur en cours d'exécution.
 * Assurez-vous que le serveur tourne: npm run dev
 * 
 * Usage: npm run backup:full
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  console.log('📦 Lancement du backup depuis le serveur en mémoire...\n');
  
  // Exécuter le script de backup depuis la mémoire
  execSync('node backup-from-memory.mjs', {
    cwd: __dirname,
    stdio: 'inherit',
    env: {
      ...process.env,
      API_URL: process.env.API_URL || 'http://localhost:3001'
    }
  });
  
  process.exit(0);
} catch (err) {
  console.error('❌ Erreur lors de l\'exécution du backup');
  process.exit(1);
}

