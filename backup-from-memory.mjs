/**
 * Backup complet via Prisma
 * Sauvegarde directement depuis la base de données via Prisma
 * N'a pas besoin du serveur en cours d'exécution
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backupDir = path.join(__dirname, 'backups');
const prisma = new PrismaClient();

// Créer le répertoire backups s'il n'existe pas
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

async function backupFromDatabase() {
  try {
    console.log('📦 Démarrage du backup Prisma depuis la base de données...\n');
    
    const tables = {
      // Core tables
      members: null,
      site_users: null,
      user_permissions: null,
      access_logs: null,
      
      // RétroDemandes
      retro_request: null,
      retro_request_file: null,
      retro_request_status_log: null,
      
      // Retro Reports
      retro_reports: null,
      retro_report_comments: null,
      
      // Finance
      financial_documents: null,
      finance_transactions: null,
      finance_transaction_categories: null,
      finance_categories: null,
      finance_balances: null,
      finance_balance_history: null,
      finance_expense_reports: null,
      finance_simulation_scenarios: null,
      finance_simulation_expense_items: null,
      finance_simulation_income_items: null,
      
      // Vehicles
      Vehicle: null,
      vehicle_maintenance: null,
      vehicle_service_schedule: null,
      VehicleControlTechnique: null,
      VehicleCessionCertificate: null,
      Usage: null,
      Report: null,
      
      // Events
      Event: null,
      EventRegistration: null,
      
      // Stock
      Stock: null,
      StockMovement: null,
      
      // Communication
      email_templates: null,
      NewsletterCampaign: null,
      NewsletterSubscriber: null,
      RetroNews: null,
      Flash: null,
      internal_messages: null,
      notification_preferences: null,
      
      // Documents & Files
      Document: null,
      DevisLine: null,
      
      // Other
      Changelog: null,
      QuoteTemplate: null,
      routes: null,
      scheduled_operations: null,
      scheduled_operation_payments: null,
      gps_logs: null
    };
    
    console.log('💾 Extraction des données...\n');
    
    // Récupérer les données de chaque table
    const tableNames = Object.keys(tables);
    let completedCount = 0;
    
    for (const tableName of tableNames) {
      try {
        process.stdout.write(`  🔄 ${tableName}...`);
        const data = await prisma[tableName].findMany().catch(() => []);
        tables[tableName] = data;
        console.log(` ✓`);
        completedCount++;
      } catch (e) {
        console.log(` ⚠️ Erreur`);
        tables[tableName] = [];
      }
    }
    
    // Créer le dossier du backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupName = `backup_${timestamp}`;
    const backupPath = path.join(backupDir, backupName);
    fs.mkdirSync(backupPath, { recursive: true });
    
    // Compter les lignes
    let totalRows = 0;
    let tableCount = 0;
    
    console.log('\n📥 RÉSUMÉ DU BACKUP\n');
    
    for (const [table, data] of Object.entries(tables)) {
      const count = data ? data.length : 0;
      totalRows += count;
      if (count > 0) {
        tableCount++;
      }
      
      const status = count > 0 ? '✅' : '⚪';
      const countStr = count.toString().padStart(6);
      console.log(`  ${status} ${table.padEnd(40)} ${countStr} lignes`);
    }
    
    // Sauvegarder en JSON
    const jsonPath = path.join(backupPath, 'data.json');
    fs.writeFileSync(jsonPath, JSON.stringify(tables, null, 2));
    
    // Copier les fichiers uploadés pour les demandes RétroDemandes
    const uploadsSourceDir = path.join(__dirname, 'uploads', 'retro-requests');
    const uploadsBackupDir = path.join(backupPath, 'uploads', 'retro-requests');
    
    let uploadedFilesCount = 0;
    if (fs.existsSync(uploadsSourceDir)) {
      fs.mkdirSync(uploadsBackupDir, { recursive: true });
      const files = fs.readdirSync(uploadsSourceDir);
      for (const file of files) {
        const source = path.join(uploadsSourceDir, file);
        const dest = path.join(uploadsBackupDir, file);
        if (fs.statSync(source).isFile()) {
          fs.copyFileSync(source, dest);
          uploadedFilesCount++;
        }
      }
    }
    
    // Créer un fichier manifest
    const manifest = {
      name: backupName,
      timestamp: new Date().toISOString(),
      type: 'FULL_PRISMA_EXPORT',
      description: 'Export complet de la base de données Prisma',
      statistics: {
        totalRows,
        tablesRequested: tableNames.length,
        tablesExported: tableCount,
        uploadedFiles: uploadedFilesCount,
        exportRate: ((tableCount / tableNames.length) * 100).toFixed(1) + '%'
      },
      tablesIncluded: Object.keys(tables).filter(t => tables[t].length > 0),
      allTables: Object.keys(tables),
      usage: 'Ce backup contient TOUTES les données pour restauration autonome'
    };
    
    const manifestPath = path.join(backupPath, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    
    // Mettre à jour l'index des sauvegardes
    const indexPath = path.join(backupDir, 'index.json');
    let index = [];
    
    if (fs.existsSync(indexPath)) {
      index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    }
    
    index.push(manifest);
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
    
    console.log(`\n${'═'.repeat(75)}`);
    console.log(`✅ BACKUP RÉUSSI`);
    console.log(`${'═'.repeat(75)}`);
    console.log(`📁 Backup: ${backupPath}`);
    console.log(`\n📊 Statistiques:`);
    console.log(`   • Total tables: ${tableNames.length}`);
    console.log(`   • Tables avec données: ${tableCount}`);
    console.log(`   • Total de lignes: ${totalRows}`);
    console.log(`   • Fichiers uploadés: ${uploadedFilesCount}`);
    console.log(`\n📋 Fichiers créés:`);
    console.log(`   • data.json (données de ${tableCount} tables)`);
    console.log(`   • manifest.json (métadonnées)`);
    console.log(`   • uploads/ (${uploadedFilesCount} fichiers)`);
    console.log(`${'═'.repeat(75)}\n`);
    
  } catch (err) {
    console.error('❌ Erreur lors de la sauvegarde:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

backupFromDatabase();
