#!/usr/bin/env node

/**
 * Migration script pour ajouter les champs manquants aux notes de frais existantes
 * Ajoute userId, createdBy, et timestamps aux documents historiques
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKUP_DIR = path.join(__dirname, 'backups');
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function isValidTimestamp(str) {
  return TIMESTAMP_PATTERN.test(str) || !str;
}

function migrateExpenseReport(report) {
  const migrated = { ...report };

  // Ajouter userId si manquant
  if (!migrated.userId) {
    migrated.userId = 'legacy';
  }

  // Ajouter createdBy si manquant
  if (!migrated.createdBy) {
    migrated.createdBy = 'Legacy User';
  }

  // Ajouter createdAt si manquant (utiliser la date du report)
  if (!migrated.createdAt) {
    migrated.createdAt = migrated.date 
      ? new Date(migrated.date).toISOString()
      : new Date().toISOString();
  }

  // Ajouter updatedAt si manquant
  if (!migrated.updatedAt) {
    migrated.updatedAt = migrated.createdAt;
  }

  // Normaliser les statuts (anciens: PENDING, PAID → nouveaux: open, closed, reimbursed)
  if (migrated.status === 'PENDING') migrated.status = 'open';
  if (migrated.status === 'PAID') migrated.status = 'reimbursed';
  if (migrated.status === 'APPROVED') migrated.status = 'closed';

  return migrated;
}

function migrateBackupFile(filePath) {
  console.log(`📁 Migrating: ${filePath}`);
  
  try {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // Migrer les notes de frais
    if (content.tables?.finance_expense_reports?.data) {
      content.tables.finance_expense_reports.data = content.tables.finance_expense_reports.data.map(migrateExpenseReport);
    }

    // Sauvegarder la version migrée
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
    console.log(`✅ Migrated: ${filePath}`);
    return true;
  } catch (e) {
    console.error(`❌ Error migrating ${filePath}:`, e.message);
    return false;
  }
}

async function main() {
  console.log('\n🚀 Migration: Expense Reports Data Enrichment\n');

  if (!fs.existsSync(BACKUP_DIR)) {
    console.error(`❌ Backup directory not found: ${BACKUP_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json'));
  
  if (files.length === 0) {
    console.warn('⚠️  No backup files found');
    return;
  }

  console.log(`Found ${files.length} backup file(s)\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const file of files) {
    const filePath = path.join(BACKUP_DIR, file);
    if (migrateBackupFile(filePath)) {
      successCount++;
    } else {
      errorCount++;
    }
  }

  console.log(`\n✨ Migration complete:`);
  console.log(`  ✅ Success: ${successCount}`);
  console.log(`  ❌ Errors: ${errorCount}\n`);
}

main().catch(console.error);
