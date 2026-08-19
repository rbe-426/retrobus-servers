const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function backup() {
  try {
    const backup = {};
    
    console.log('💾 Sauvegarde des members...');
    backup.members = await prisma.members.findMany();
    console.log(`   ✅ ${backup.members.length} membres sauvegardés`);
    
    console.log('💾 Sauvegarde des retro_request...');
    backup.retro_request = await prisma.retro_request.findMany();
    console.log(`   ✅ ${backup.retro_request.length} demandes sauvegardées`);
    
    console.log('💾 Sauvegarde des retro_request_file...');
    backup.retro_request_file = await prisma.retro_request_file.findMany();
    console.log(`   ✅ ${backup.retro_request_file.length} fichiers sauvegardés`);
    
    console.log('💾 Sauvegarde des retro_request_status_log...');
    backup.retro_request_status_log = await prisma.retro_request_status_log.findMany();
    console.log(`   ✅ ${backup.retro_request_status_log.length} logs de statut sauvegardés`);
    
    console.log('💾 Sauvegarde des vehicle_maintenance...');
    backup.vehicle_maintenance = await prisma.vehicle_maintenance.findMany();
    console.log(`   ✅ ${backup.vehicle_maintenance.length} maintenances sauvegardées`);
    
    console.log('💾 Sauvegarde des usage...');
    backup.usage = await prisma.usage.findMany();
    console.log(`   ✅ ${backup.usage.length} usages sauvegardés`);
    
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `backup-${timestamp}.json`);
    
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
    
    console.log(`\n✅ Backup écrit dans: ${backupFile}`);
    console.log(`\n📊 Statistiques:`);
    console.log(`   - Members: ${backup.members.length}`);
    console.log(`   - Retro Requests: ${backup.retro_request.length}`);
    console.log(`   - Fichiers: ${backup.retro_request_file.length}`);
    console.log(`   - Status Logs: ${backup.retro_request_status_log.length}`);
    console.log(`   - Maintenances: ${backup.vehicle_maintenance.length}`);
    console.log(`   - Usages: ${backup.usage.length}`);
    
    process.exit(0);
  } catch (e) {
    console.error('❌ Erreur:', e.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

backup();
