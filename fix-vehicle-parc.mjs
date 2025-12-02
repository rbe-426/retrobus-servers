import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backupsDir = path.join(__dirname, 'backups');

// Find the latest backup
const indexPath = path.join(backupsDir, 'index.json');
const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));

if (index.length === 0) {
  console.error('❌ Aucun backup trouvé');
  process.exit(1);
}

// Use the latest backup
const latestBackupName = index[index.length - 1].name;
const latestBackupPath = path.join(backupsDir, latestBackupName);
const dataPath = path.join(latestBackupPath, 'data.json');

if (!fs.existsSync(dataPath)) {
  console.error(`❌ Backup data not found: ${dataPath}`);
  process.exit(1);
}

console.log(`📂 Lecture du backup: ${latestBackupName}`);

const backupData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

// Find vehicles with empty parc
if (backupData.tables?.Vehicle?.data) {
  console.log(`📍 Avant: ${backupData.tables.Vehicle.data.length} véhicule(s)`);
  
  backupData.tables.Vehicle.data.forEach((vehicle, idx) => {
    if (!vehicle.parc || vehicle.parc === '' || vehicle.parc === null) {
      console.log(`   ⚠️  Véhicule ${idx} a parc vide: "${vehicle.parc}"`);
      console.log(`      Changement en parc: "920"`);
      vehicle.parc = '920';
    }
  });
  
  // Ensure parc is set on all vehicles
  backupData.tables.Vehicle.data = backupData.tables.Vehicle.data.map(v => ({
    ...v,
    parc: v.parc || '920'
  }));
  
  console.log(`✅ Après: tous les véhicules ont un parc`);
  backupData.tables.Vehicle.data.forEach((v, idx) => {
    console.log(`   Véhicule ${idx}: parc="${v.parc}"`);
  });
}

// Write updated backup
fs.writeFileSync(dataPath, JSON.stringify(backupData, null, 2), 'utf-8');

// Create restore-info.json to force loading of this backup at startup
const restoreInfoPath = path.join(backupsDir, 'restore-info.json');
fs.writeFileSync(restoreInfoPath, JSON.stringify({
  backupToRestore: latestBackupName,
  reason: 'Fixed vehicle parc number',
  timestamp: new Date().toISOString()
}, null, 2), 'utf-8');

console.log(`\n✅ Backup modifié avec succès`);
console.log(`✅ restore-info.json créé - le serveur chargera ce backup au prochain démarrage`);
console.log(`\n💡 Prochaines étapes:`);
console.log(`   1. Redémarrer le serveur: npm run dev`);
console.log(`   2. Vérifier les données: GET /api/vehicles`);
