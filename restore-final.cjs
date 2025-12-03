const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function restore() {
  try {
    const backupDir = path.join(__dirname, 'backups');
    
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('backup-') && f.endsWith('.json') && f !== 'backup-stats.json')
      .sort()
      .reverse();

    if (files.length === 0) {
      throw new Error('Aucun fichier de backup trouvé');
    }

    const latestBackupFile = path.join(backupDir, files[0]);
    console.log(`📂 Utilisation du backup: ${files[0]}\n`);

    const backupData = JSON.parse(fs.readFileSync(latestBackupFile, 'utf-8'));

    console.log('💾 Restauration des members...');
    for (const member of backupData.members) {
      try {
        await prisma.members.upsert({
          where: { id: member.id },
          update: member,
          create: member
        });
      } catch (e) {
        console.warn(`   ⚠️ Erreur member ${member.id}: ${e.message}`);
      }
    }
    console.log(`   ✅ ${backupData.members.length} membres restaurés`);

    console.log('💾 Restauration des retro_request...');
    for (const request of backupData.retro_request) {
      try {
        const member = await prisma.members.findUnique({
          where: { id: request.userId }
        });

        if (!member) {
          console.warn(`   ⚠️ Membre ${request.userId} introuvable`);
          continue;
        }

        await prisma.retro_request.upsert({
          where: { id: request.id },
          update: request,
          create: request
        });
      } catch (e) {
        console.warn(`   ⚠️ Erreur demande ${request.id}: ${e.message}`);
      }
    }
    console.log(`   ✅ ${backupData.retro_request.length} demandes restaurées`);

    console.log('💾 Restauration des retro_request_file...');
    for (const file of backupData.retro_request_file) {
      try {
        await prisma.retro_request_file.upsert({
          where: { id: file.id },
          update: file,
          create: file
        });
      } catch (e) {
        console.warn(`   ⚠️ Erreur fichier ${file.id}: ${e.message}`);
      }
    }
    console.log(`   ✅ ${backupData.retro_request_file.length} fichiers restaurés`);

    console.log('💾 Restauration des retro_request_status_log...');
    for (const log of backupData.retro_request_status_log) {
      try {
        await prisma.retro_request_status_log.upsert({
          where: { id: log.id },
          update: log,
          create: log
        });
      } catch (e) {
        console.warn(`   ⚠️ Erreur log ${log.id}: ${e.message}`);
      }
    }
    console.log(`   ✅ ${backupData.retro_request_status_log.length} logs restaurés`);

    console.log('💾 Restauration des vehicle_maintenance...');
    for (const maintenance of backupData.vehicle_maintenance) {
      try {
        await prisma.vehicle_maintenance.upsert({
          where: { id: maintenance.id },
          update: maintenance,
          create: maintenance
        });
      } catch (e) {
        console.warn(`   ⚠️ Erreur maintenance ${maintenance.id}: ${e.message}`);
      }
    }
    console.log(`   ✅ ${backupData.vehicle_maintenance.length} maintenances restaurées`);

    console.log('💾 Restauration des usage...');
    for (const usage of backupData.usage) {
      try {
        await prisma.usage.upsert({
          where: { id: usage.id },
          update: usage,
          create: usage
        });
      } catch (e) {
        console.warn(`   ⚠️ Erreur usage ${usage.id}: ${e.message}`);
      }
    }
    console.log(`   ✅ ${backupData.usage.length} usages restaurés`);

    console.log('\n🎉 Restauration complète!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

restore();
