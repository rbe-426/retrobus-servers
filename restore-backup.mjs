import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const isLatest = args.includes('--latest');
const isInteractive = args.includes('--interactive');

const backupDir = path.join(__dirname, 'backups');
const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

function getLatestBackup() {
  const indexPath = path.join(backupDir, 'index.json');
  if (!fs.existsSync(indexPath)) return null;
  
  const backups = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  return backups.length > 0 ? backups[backups.length - 1] : null;
}

function listBackups() {
  const indexPath = path.join(backupDir, 'index.json');
  if (!fs.existsSync(indexPath)) {
    console.log('❌ Aucune sauvegarde trouvée');
    return;
  }

  const backups = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  if (backups.length === 0) {
    console.log('❌ Aucune sauvegarde trouvée');
    return;
  }

  console.log('📋 SAUVEGARDES DISPONIBLES\n');
  backups.forEach((backup, idx) => {
    const date = new Date(backup.timestamp).toLocaleString('fr-FR');
    console.log(`${idx + 1}. ${backup.name}`);
    console.log(`   📅 ${date} | 📊 ${backup.statistics.totalRows} lignes\n`);
  });
}

async function restoreBackup() {
  try {
    let backupName = null;

    if (isLatest) {
      // Restaurer la dernière sauvegarde
      const latest = getLatestBackup();
      if (!latest) {
        console.error('❌ Aucune sauvegarde trouvée');
        process.exit(1);
      }
      backupName = latest.name;
      console.log(`\n📦 Restauration de: ${backupName}\n`);
    } else if (isInteractive) {
      // Mode interactif - liste et choix
      console.log('');
      listBackups();
      const choice = await prompt('Choisir un numéro de sauvegarde: ');
      const index = parseInt(choice) - 1;
      
      const indexPath = path.join(backupDir, 'index.json');
      if (!fs.existsSync(indexPath)) {
        console.error('❌ Aucune sauvegarde trouvée');
        process.exit(1);
      }
      
      const backups = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
      if (index < 0 || index >= backups.length) {
        console.error('❌ Choix invalide');
        process.exit(1);
      }
      
      backupName = backups[index].name;
      console.log(`\n📦 Restauration de: ${backupName}\n`);
    } else {
      // Par défaut: restaurer la dernière
      const latest = getLatestBackup();
      if (!latest) {
        console.error('❌ Aucune sauvegarde trouvée');
        process.exit(1);
      }
      backupName = latest.name;
      console.log(`\n📦 Restauration de: ${backupName}\n`);
    }

    // Charger le backup
    const backupPath = path.join(backupDir, backupName);
    const dataPath = path.join(backupPath, 'data.json');
    const manifestPath = path.join(backupPath, 'manifest.json');

    if (!fs.existsSync(dataPath)) {
      console.error('❌ Fichier de données non trouvé');
      process.exit(1);
    }

    const backupData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

    console.log('═'.repeat(75));
    console.log('📋 DÉTAILS DU BACKUP');
    console.log('═'.repeat(75));
    console.log(`📅 Date: ${new Date(manifest.timestamp).toLocaleString('fr-FR')}`);
    console.log(`📊 Lignes: ${manifest.statistics.totalRows}`);
    console.log(`📦 Tables: ${manifest.statistics.tablesExported}`);
    console.log('\n📑 Tables incluses:');
    manifest.tablesIncluded.forEach(t => console.log(`   • ${t}`));
    console.log('═'.repeat(75));

    // Confirmation
    const confirm = await prompt('\n⚠️  Êtes-vous sûr? Les données actuelles seront remplacées (y/N): ');
    if (confirm.toLowerCase() !== 'y') {
      console.log('❌ Restauration annulée');
      rl.close();
      await prisma.$disconnect();
      process.exit(0);
    }

    console.log('\n🔄 Restauration en cours...\n');

    // Restaurer les données dynamiquement pour TOUTES les tables
    let totalRestored = 0;
    const tableModels = {
      members: prisma.members,
      site_users: prisma.site_users,
      user_permissions: prisma.user_permissions,
      access_logs: prisma.access_logs,
      retro_request: prisma.retro_request,
      retro_request_file: prisma.retro_request_file,
      retro_request_status_log: prisma.retro_request_status_log,
      retro_reports: prisma.retro_reports,
      retro_report_comments: prisma.retro_report_comments,
      financial_documents: prisma.financial_documents,
      finance_transactions: prisma.finance_transactions,
      finance_transaction_categories: prisma.finance_transaction_categories,
      finance_categories: prisma.finance_categories,
      finance_balances: prisma.finance_balances,
      finance_balance_history: prisma.finance_balance_history,
      finance_expense_reports: prisma.finance_expense_reports,
      finance_simulation_scenarios: prisma.finance_simulation_scenarios,
      finance_simulation_expense_items: prisma.finance_simulation_expense_items,
      finance_simulation_income_items: prisma.finance_simulation_income_items,
      Vehicle: prisma.Vehicle,
      vehicle_maintenance: prisma.vehicle_maintenance,
      vehicle_service_schedule: prisma.vehicle_service_schedule,
      VehicleControlTechnique: prisma.VehicleControlTechnique,
      VehicleCessionCertificate: prisma.VehicleCessionCertificate,
      Usage: prisma.Usage,
      Report: prisma.Report,
      Event: prisma.Event,
      EventRegistration: prisma.EventRegistration,
      Stock: prisma.Stock,
      StockMovement: prisma.StockMovement,
      email_templates: prisma.email_templates,
      NewsletterCampaign: prisma.NewsletterCampaign,
      NewsletterSubscriber: prisma.NewsletterSubscriber,
      RetroNews: prisma.RetroNews,
      Flash: prisma.Flash,
      internal_messages: prisma.internal_messages,
      notification_preferences: prisma.notification_preferences,
      Document: prisma.Document,
      DevisLine: prisma.DevisLine,
      Changelog: prisma.Changelog,
      QuoteTemplate: prisma.QuoteTemplate,
      routes: prisma.routes,
      scheduled_operations: prisma.scheduled_operations,
      scheduled_operation_payments: prisma.scheduled_operation_payments,
      gps_logs: prisma.gps_logs
    };

    // Restaurer les données de chaque table
    for (const [tableName, data] of Object.entries(backupData)) {
      if (data && Array.isArray(data) && data.length > 0) {
        const model = tableModels[tableName];
        if (!model) {
          console.log(`  ⚠️  Table ${tableName} non trouvée dans le modèle`);
          continue;
        }

        console.log(`  🔄 Restauration des ${tableName}...`);
        let restoreCount = 0;
        
        for (const record of data) {
          try {
            // Déterminer la clé primaire
            let whereClause = {};
            if (record.id) {
              whereClause = { id: record.id };
            } else if (record.parc) {
              whereClause = { parc: record.parc };
            }

            if (Object.keys(whereClause).length > 0) {
              await model.upsert({
                where: whereClause,
                update: record,
                create: record
              });
              restoreCount++;
              totalRestored++;
            }
          } catch (e) {
            console.warn(`    ⚠️ Erreur enregistrement: ${e.message}`);
          }
        }
        
        console.log(`  ✅ ${restoreCount} enregistrements restaurés`);
      }
    }

    // Copier les fichiers uploadés
    const uploadsSourceDir = path.join(backupPath, 'uploads', 'retro-requests');
    const uploadsDestDir = path.join(__dirname, 'uploads', 'retro-requests');
    
    if (fs.existsSync(uploadsSourceDir)) {
      console.log('  🔄 Restauration des fichiers uploadés...');
      fs.mkdirSync(uploadsDestDir, { recursive: true });
      const files = fs.readdirSync(uploadsSourceDir);
      for (const file of files) {
        const source = path.join(uploadsSourceDir, file);
        const dest = path.join(uploadsDestDir, file);
        if (fs.statSync(source).isFile()) {
          fs.copyFileSync(source, dest);
        }
      }
      console.log(`  ✅ ${files.length} fichiers restaurés`);
    }

    console.log(`\n${'═'.repeat(75)}`);
    console.log(`✅ RESTAURATION RÉUSSIE`);
    console.log(`${'═'.repeat(75)}`);
    console.log(`\n📊 Statistiques:`);
    console.log(`   • Total restauré: ${totalRestored} enregistrements`);
    console.log(`   • Fichiers restaurés: ${manifest.statistics.uploadedFiles || 0}`);
    console.log(`\n${'═'.repeat(75)}\n`);

    rl.close();
    await prisma.$disconnect();
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    rl.close();
    await prisma.$disconnect();
    process.exit(1);
  }
}

restoreBackup();
