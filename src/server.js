import express from 'express';
import dotenv from 'dotenv';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import subventionsRouter from './subventions.mjs';
import retromerchRouter from './retromerch.mjs';
import { 
  generateTemporaryPassword, 
  hashPasswordForStorage, 
  verifyPassword, 
  validatePasswordStrength 
} from './lib/passwordUtils.js';
import { createTokenPair, verifyToken } from './lib/tokenService.js';
import { 
  generateCSRFToken, 
  csrfProtection, 
  includeNewCSRFToken, 
  cleanupExpiredTokens,
  debugCSRFStatus 
} from './lib/csrfService.js';
import authRoutes from './routes/auth.routes.js';
import systemRoutes from './routes/system.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
import eventsRoutes from './routes/events.routes.js';
import ticketingRoutes from './routes/ticketing.routes.js';
import museumRoutes from './routes/museum.routes.js';
import mailRoutes from './routes/mail.routes.js';
import templatesRoutes from './routes/templates.routes.js';
import bulletinFlowRoutes from './routes/bulletinFlow.routes.js';
import bulletinStatsRoutes from './routes/bulletinStats.routes.js';
import emailTemplateRoutes from './routes/emailTemplate.routes.js';
import teamRoutes from './routes/team.routes.js';
import changelogRoutes from './routes/changelog.routes.js';
import lumistudioRoutes from './routes/lumistudio.routes.js';
import processParcRoutes from './routes/processParc.routes.js';
import { sendExpenseReportNotification, sendTemplatedEmail, setNoreplyUserId } from './services/notificationService.js';
import { createMailSession } from './services/mailService.js';
// � Import module de calcul des KPI historiques
import { 
  calculateMonthlyKPIs, 
  calculateYearlyKPIs, 
  comparePeriodsKPIs, 
  getRecentMonthsKPIs,
  getDataRange,
  getAllPeriodsKPIs
} from './kpi-calculator.mjs';
// �🔐 Import modules de sécurité
import {
  helmetConfig,
  generalLimiter,
  authLimiter,
  uploadLimiter,
  sanitizeInput,
  sanitizeObject,
  validateEmail,
  validatePassword,
  validateMatricule,
  validateName,
  handleValidationErrors,
  maskSensitiveData,
  secureLogger,
  encryptSensitiveData,
  decryptSensitiveData,
  auditLog,
  getAuditLogs,
  getAuditLogsSummary
} from './security.js';
// 🚗 Import service d'identification de véhicules
import { identifyVehicle } from './services/vehicleIdentification.js';
// 🖼️ Import service de génération de plaques d'immatriculation
import { streamPlateSVG, detectPlateFormat } from './services/plateGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// 🔧 Modes avancés (désactivés par défaut en production)
// - LOAD_BACKUP_AT_BOOT : recharge un backup JSON au démarrage (❌ à éviter en prod)
// - ENABLE_RUNTIME_STATE_SAVE : écrit l'état mémoire dans runtime-state.json
// - ENABLE_MEMORY_FALLBACK : bascule en mémoire si Prisma ne répond pas
//
// PRODUCTION: Utilise Prisma comme source de vérité + runtime-state.json pour memoire
const LOAD_BACKUP_AT_BOOT = process.env.LOAD_BACKUP_AT_BOOT === 'true';
const ENABLE_MEMORY_FALLBACK = process.env.ENABLE_MEMORY_FALLBACK === 'true';
const ENABLE_RUNTIME_STATE_SAVE = process.env.ENABLE_RUNTIME_STATE_SAVE !== 'false'; // DEFAULT: true

// ============================================================
// 🔧 INITIALISATION PRISMA (source unique de vérité)
// ============================================================
let prisma = null;
let prismaAvailable = true; // Always true - Prisma is the single source of truth

// Initialize Prisma without blocking startup
try {
  prisma = new PrismaClient({
    log: ['error'], // Only error logs
  });
  
  // Test connection asynchronously (don't block startup)
  prisma.$queryRaw`SELECT 1`.catch(e => {
    console.error('❌ Database connection failed:', e.message);
    process.exit(1);
  });
} catch (e) {
  console.error('❌ CRITICAL: Failed to initialize Prisma:', e.message);
  process.exit(1);
}

const app = express();
const upload = multer({ dest: 'uploads/' });
const PORT = process.env.PORT || 4000;
const pathRoot = process.cwd();

// ============================================================
// � CONFIGURATION EMAIL - NODEMAILER
// ============================================================
let transporter = null;

const initMailer = () => {
  const emailUser = process.env.EMAIL_USER || 'association.rbe@gmail.com';
  const emailPass = process.env.EMAIL_PASSWORD;
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '587');

  if (!emailPass) {
    console.warn('⚠️  EMAIL_PASSWORD non configuré - emails de contact ne seront pas envoyés');
    return null;
  }

  try {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // true for 465, false for other ports
      auth: {
        user: emailUser,
        pass: emailPass
      }
    });
    console.log('✅ Email transporter initialisé');
    return transporter;
  } catch (error) {
    console.error('❌ Erreur initialisation email:', error.message);
    return null;
  }
};

// Initialiser le mailer au démarrage
initMailer();

// ============================================================
// �🚀 RÉTROBUS ESSONNE - SERVEUR API
// ============================================================
console.log('\n🚀 Serveur API en cours de démarrage...\n');

// Helpers
const uid = () => (global.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`);
const today = () => new Date().toISOString().split('T')[0];

// Helper pour enrichir un objet avec les infos utilisateur
const enrichWithUser = (obj, req) => ({
  ...obj,
  userId: obj.userId || req.user?.id || req.user?.email || 'anonymous',
  createdBy: obj.createdBy || req.user?.name || req.user?.email || 'Anonymous',
});

// Helper pour ajouter les timestamps standard
const withTimestamps = (obj) => ({
  ...obj,
  createdAt: obj.createdAt || new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

// ============================================================
// 🔧 ÉTAT EN MÉMOIRE - Pour endpoints non encore migrés vers Prisma
// ============================================================
const state = {
  members: [],
  siteUsers: [],
  notifications: [],
  vehicles: [],
  events: [],
  flashes: [],
  retroNews: [],
  transactions: [],
  expenseReports: [],
  documents: [],
  devisLines: [],
  quoteTemplates: [],
  financialDocuments: [],
  userPermissions: {},
  notificationPreferences: [],
  vehicleMaintenance: [],
  vehicleServiceSchedule: [],
  vehicleScheduleItem: [],
  vehicleUsage: [],
  scheduledOperations: [],
  scheduledOperationPayments: [],
  stock: [],
  stockMovements: [],
  vehicleCarteGrise: [],
  vehicleAssurance: [],
  vehicleControleTechnique: [],
  vehicleCertificatCession: [],
  vehicleEchancier: [],
  scheduled: [],
  simulations: [],
  bankBalance: 0,
  categories: [
    { id: 'adhesions', name: 'Adhésions', type: 'recette' },
    { id: 'evenements', name: 'Événements', type: 'recette' },
    { id: 'carburant', name: 'Carburant', type: 'depense' },
    { id: 'maintenance', name: 'Maintenance', type: 'depense' },
    { id: 'assurance', name: 'Assurance', type: 'depense' },
    { id: 'materiel', name: 'Matériel', type: 'depense' },
    { id: 'frais_admin', name: 'Frais administratifs', type: 'depense' },
    { id: 'autres', name: 'Autres', type: 'both' }
  ]
};

// Catégories financières par défaut (en mémoire car rarement modifiées)
const defaultCategories = state.categories;

const backupsDir = path.join(pathRoot, 'backups');
const runtimeStatePath = path.join(backupsDir, 'runtime-state.json');

const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const persistStateToDisk = () => {
  if (!ENABLE_RUNTIME_STATE_SAVE) {
    // Mode normal : on ne sauvegarde PAS l'état mémoire sur disque
    return;
  }
  try {
    ensureDirectoryExists(path.dirname(runtimeStatePath));
    fs.writeFileSync(runtimeStatePath, JSON.stringify({
      savedAt: new Date().toISOString(),
      state
    }, null, 2), 'utf-8');
  } catch (error) {
    // Silently fail - non-critical
  }
};

let stateSaveTimer = null;
const debouncedSave = () => {
  if (stateSaveTimer) clearTimeout(stateSaveTimer);
  stateSaveTimer = setTimeout(persistStateToDisk, 750);
};

const normalizeExtrasValue = (extras) => {
  if (extras === undefined) return undefined;
  if (extras === null) return null;
  if (typeof extras === 'string') return extras;
  try {
    return JSON.stringify(extras);
  } catch (error) {
    return null;
  }
};

const normalizeEventExtras = (event = {}) => {
  if (!event || typeof event !== 'object') return event;
  const normalized = { ...event };
  if (Object.prototype.hasOwnProperty.call(normalized, 'extras')) {
    const normalizedExtras = normalizeExtrasValue(normalized.extras);
    if (normalizedExtras === undefined) {
      delete normalized.extras;
    } else {
      normalized.extras = normalizedExtras;
    }
  }
  return normalized;
};

const normalizeEventCollection = (events = []) => events.map(ev => normalizeEventExtras(ev));

// Calculate next date based on frequency
const calculateNextDate = (currentDate, frequency) => {
  if (!currentDate || !frequency) return currentDate;
  
  const date = new Date(currentDate);
  const frequencyMap = {
    'WEEKLY': 7,
    'MONTHLY': 30,
    'QUARTERLY': 90,
    'SEMI_ANNUAL': 180,
    'YEARLY': 365,
    'ONE_SHOT': null
  };
  
  const days = frequencyMap[frequency] || frequencyMap[frequency.toUpperCase()] || 30;
  if (!days) return date; // ONE_SHOT - don't advance
  
  date.setDate(date.getDate() + days);
  return date;
};

const prismaEventFieldAllowList = new Set(['title', 'description', 'date', 'time', 'location', 'helloAssoUrl', 'adultPrice', 'childPrice', 'status', 'vehicleId', 'extras', 'currentParticipants']);

const buildPrismaEventUpdateData = (payload = {}) => {
  if (!payload || typeof payload !== 'object') return {};
  const normalized = normalizeEventExtras(payload);
  const data = {};
  prismaEventFieldAllowList.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(normalized, key) && normalized[key] !== undefined) {
      data[key] = normalized[key];
    }
  });
  if (data.date) {
    const parsedDate = new Date(data.date);
    if (!Number.isNaN(parsedDate.getTime())) {
      data.date = parsedDate;
    } else {
      delete data.date;
    }
  }
  return data;
};

const buildStateEventUpdateData = (payload = {}) => {
  if (!payload || typeof payload !== 'object') return {};
  const normalized = normalizeEventExtras(payload);
  if (normalized.date instanceof Date) {
    normalized.date = normalized.date.toISOString();
  } else if (normalized.date) {
    const parsedDate = new Date(normalized.date);
    if (!Number.isNaN(parsedDate.getTime())) {
      normalized.date = parsedDate.toISOString();
    }
  }
  return normalized;
};

const upsertEventInMemory = (event) => {
  if (!event) return null;
  if (!Array.isArray(state.events)) state.events = [];
  const normalized = normalizeEventExtras(event);
  const idx = state.events.findIndex(ev => ev.id === normalized.id);
  if (idx === -1) {
    state.events.push(normalized);
    return normalized;
  }
  state.events[idx] = { ...state.events[idx], ...normalized };
  return state.events[idx];
};

const updateEventInMemory = (eventId, updatePayload = {}) => {
  if (!Array.isArray(state.events)) state.events = [];
  const idx = state.events.findIndex(ev => ev.id === eventId);
  if (idx === -1) return null;
  const normalizedUpdate = normalizeEventExtras(updatePayload);
  const merged = {
    ...state.events[idx],
    ...normalizedUpdate,
    id: state.events[idx].id || eventId,
    updatedAt: new Date().toISOString()
  };
  state.events[idx] = normalizeEventExtras(merged);
  return state.events[idx];
};

// VEHICLE HELPERS ---------------------------------------------------------
const prismaVehicleFieldAllowList = new Set([
  'id', 'parc', 'type', 'modele', 'marque', 'subtitle', 'immat', 'etat',
  'miseEnCirculation', 'energie', 'description', 'history', 'caracteristiques',
  'gallery', 'backgroundImage', 'backgroundPosition', 'thumbnailImage', 'isPublic', 'fuel', 'mileage'
]);

const numericVehicleFields = new Set(['fuel', 'mileage']);
const dateVehicleFields = new Set(['miseEnCirculation']);
const booleanVehicleFields = new Set(['isPublic']);

const coerceVehicleValue = (key, value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  
  // DEBUG caracteristiques
  if (key === 'caracteristiques' || key === 'gallery') {
    console.log(`🔍 [COERCE] ${key}: type=${typeof value}, isArray=${Array.isArray(value)}, value=${typeof value === 'string' ? value.substring(0, 100) : JSON.stringify(value).substring(0, 100)}`);
  }
  
  if (numericVehicleFields.has(key)) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (dateVehicleFields.has(key)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (booleanVehicleFields.has(key)) {
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return Boolean(value);
  }
  if ((key === 'caracteristiques' || key === 'gallery') && typeof value === 'object' && Array.isArray(value)) {
    try {
      return JSON.stringify(value);
    } catch (error) {
      console.warn(`⚠️  Impossible de sérialiser ${key}:`, error.message);
      return null;
    }
  }
  return value;
};

const buildPrismaVehicleUpdateData = (payload = {}) => {
  if (!payload || typeof payload !== 'object') return {};
  const data = {};
  Object.keys(payload).forEach((key) => {
    if (!prismaVehicleFieldAllowList.has(key)) return;
    const coerced = coerceVehicleValue(key, payload[key]);
    if (coerced !== undefined) data[key] = coerced;
  });
  return data;
};

let vehicleLifecycleTableEnsured = false;
const ensureVehicleLifecycleTable = async () => {
  if (vehicleLifecycleTableEnsured || !prisma) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "VehicleLifecycleEvent" (
      "id" SERIAL PRIMARY KEY,
      "vehicleParc" TEXT NOT NULL,
      "eventType" TEXT NOT NULL,
      "severity" TEXT,
      "title" TEXT NOT NULL,
      "description" TEXT,
      "decision" TEXT,
      "immobilizing" BOOLEAN NOT NULL DEFAULT false,
      "reformReason" TEXT,
      "reformDate" TIMESTAMP(3),
      "decidedBy" TEXT,
      "createdBy" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "VehicleLifecycleEvent_vehicleParc_fkey"
        FOREIGN KEY ("vehicleParc") REFERENCES "Vehicle"("parc") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "VehicleLifecycleEvent_vehicleParc_idx" ON "VehicleLifecycleEvent"("vehicleParc");');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "VehicleLifecycleEvent_eventType_idx" ON "VehicleLifecycleEvent"("eventType");');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "VehicleLifecycleEvent_severity_idx" ON "VehicleLifecycleEvent"("severity");');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "VehicleLifecycleEvent_createdAt_idx" ON "VehicleLifecycleEvent"("createdAt");');
  vehicleLifecycleTableEnsured = true;
};

let expenseReportColumnsEnsured = false;
const ensureExpenseReportColumns = async () => {
  if (expenseReportColumnsEnsured || !prisma) return;
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "finance_expense_reports"
    ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'Note de frais avec justificatif',
    ADD COLUMN IF NOT EXISTS "notes" TEXT;
  `);
  expenseReportColumnsEnsured = true;
};

const nextLifecycleVehicleState = (eventType, severity, immobilizing) => {
  if (eventType === 'reforme') return { etat: 'reforme', isPublic: false };
  if (immobilizing || severity === 'critique') return { etat: 'immobilise' };
  if (severity === 'majeure') return { etat: 'en_panne' };
  return {};
};

const buildStateVehicleUpdateData = (payload = {}) => {
  if (!payload || typeof payload !== 'object') return {};
  const update = {};
  Object.keys(payload).forEach((key) => {
    let value = payload[key];
    if (dateVehicleFields.has(key)) {
      const date = new Date(value);
      value = Number.isNaN(date.getTime()) ? null : date.toISOString();
    } else if (booleanVehicleFields.has(key)) {
      if (typeof value === 'string') value = value.toLowerCase() === 'true';
      else value = Boolean(value);
    } else if (numericVehicleFields.has(key)) {
      const parsed = Number(value);
      value = Number.isFinite(parsed) ? parsed : null;
    } else if (key === 'caracteristiques' && typeof value === 'object') {
      try {
        value = JSON.stringify(value);
      } catch (error) {
        console.warn('⚠️  Impossible de sérialiser caracteristiques:', error.message);
        value = null;
      }
    }
    update[key] = value;
  });
  return update;
};

const upsertVehicleInMemory = (vehicle) => {
  if (!vehicle) return null;
  if (!Array.isArray(state.vehicles)) state.vehicles = [];
  const idx = state.vehicles.findIndex(v => v.parc === vehicle.parc);
  if (idx === -1) {
    state.vehicles.push({ ...vehicle });
    return state.vehicles[state.vehicles.length - 1];
  }
  state.vehicles[idx] = { ...state.vehicles[idx], ...vehicle };
  return state.vehicles[idx];
};

const updateVehicleInMemory = (parc, updatePayload = {}) => {
  if (!Array.isArray(state.vehicles)) state.vehicles = [];
  const idx = state.vehicles.findIndex(v => v.parc === parc || String(v.id) === String(parc));
  if (idx === -1) return null;
  state.vehicles[idx] = {
    ...state.vehicles[idx],
    ...updatePayload,
    parc: state.vehicles[idx].parc || parc,
    updatedAt: new Date().toISOString()
  };
  return state.vehicles[idx];
};

// ============================================================
// ⚠️  ATTENTION - SYSTÈME DE BACKUP JSON
// ============================================================
// - Ce système charge un snapshot complet des données dans `state`
//   à partir des fichiers présents dans le dossier `backups/`.
// - En PRODUCTION, on ne doit PAS utiliser ce mécanisme comme
//   persistance principale, car il peut réinjecter d'anciennes
//   données à chaque redémarrage.
// - La source de vérité en production doit être la base Prisma
//   (DATABASE_URL) et non les fichiers JSON.
//
// Recommandation :
//   LOAD_BACKUP_AT_BOOT = false
//   ENABLE_RUNTIME_STATE_SAVE = false
//   ENABLE_MEMORY_FALLBACK = false
// ============================================================

// 💾 CHARGEMENT DU BACKUP AU DÉMARRAGE
function loadBackupAtStartup() {
  try {
    const backupDir = backupsDir;
    
    // D'abord, chercher restore-info.json
    let backupName = null;
    const restoreInfoPath = path.join(backupDir, 'restore-info.json');
    
    if (fs.existsSync(restoreInfoPath)) {
      const restoreInfo = JSON.parse(fs.readFileSync(restoreInfoPath, 'utf-8'));
      backupName = restoreInfo.backupToRestore;
    }
    
    // Si pas de restore-info.json, charger le backup le plus récent de index.json
    if (!backupName) {
      const indexPath = path.join(backupDir, 'index.json');
      if (fs.existsSync(indexPath)) {
        const backups = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
        if (backups.length > 0) {
          // Prendre le dernier (le plus récent)
          backupName = backups[backups.length - 1].name;
          console.log(`📌 Aucun restore-info.json, chargement du backup le plus récent: ${backupName}`);
        }
      }
    }
    
    if (!backupName) {
      console.log('ℹ️  Aucun backup à charger');
      return;
    }
    
    const backupPath = path.join(backupDir, backupName, 'data.json');
    
    if (!fs.existsSync(backupPath)) {
      console.warn(`⚠️  Backup introuvable: ${backupPath}`);
      return;
    }
    
    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
    const tables = backupData.tables || {};
    
    // Charger chaque table dans state
    if (tables.members?.data) {
      state.members = tables.members.data;
    }
    if (tables.site_users?.data) {
      state.siteUsers = tables.site_users.data;
    }
    if (tables.Vehicle?.data) {
      state.vehicles = tables.Vehicle.data;
    }
    if (tables.RetroNews?.data) {
      state.retroNews = tables.RetroNews.data;
    }
    if (tables.Event?.data) {
      state.events = normalizeEventCollection(tables.Event.data || []);
    }
    if (tables.Flash?.data) {
      state.flashes = tables.Flash.data;
    }
    if (tables.finance_transactions?.data) {
      state.transactions = tables.finance_transactions.data;
    }
    if (tables.finance_expense_reports?.data) {
      state.expenseReports = tables.finance_expense_reports.data;
    }
    if (tables.DevisLine?.data) {
      state.devisLines = tables.DevisLine.data;
    }
    if (tables.QuoteTemplate?.data) {
      state.quoteTemplates = tables.QuoteTemplate.data;
    }
    if (tables.financial_documents?.data) {
      state.financialDocuments = tables.financial_documents.data;
    }
    if (tables.Document?.data) {
      state.documents = tables.Document.data;
    }
    if (tables.user_permissions?.data) {
      state.userPermissions = tables.user_permissions.data;
    }
    if (tables.finance_categories?.data) {
      // Merge avec les catégories par défaut
      state.categories = [...state.categories, ...tables.finance_categories.data];
    }
    if (tables.finance_balances?.data) {
      if (tables.finance_balances.data[0]) {
        state.bankBalance = tables.finance_balances.data[0].balance || 0;
      }
    }
    if (tables.vehicle_maintenance?.data) {
      state.vehicleMaintenance = tables.vehicle_maintenance.data;
    }
    if (tables.vehicle_service_schedule?.data) {
      state.vehicleServiceSchedule = tables.vehicle_service_schedule.data;
    }
    if (tables.Usage?.data) {
      state.vehicleUsage = tables.Usage.data;
    }
    if (tables.notification_preferences?.data) {
      state.notificationPreferences = tables.notification_preferences.data;
    }
    if (tables.scheduled_operations?.data) {
      state.scheduledOperations = tables.scheduled_operations.data;
      state.scheduled = tables.scheduled_operations.data; // Sync with endpoints
    }
    if (tables.scheduled_operation_payments?.data) {
      state.scheduledOperationPayments = tables.scheduled_operation_payments.data;
    }
    if (tables.Stock?.data) {
      state.stock = tables.Stock.data;
    }
    if (tables.StockMovement?.data) {
      state.stockMovements = tables.StockMovement.data;
    }
    
  } catch (error) {
    console.warn('⚠️  Erreur lors du chargement du backup:', error.message);
  }
}

// Charger le backup au démarrage (optionnel)
if (LOAD_BACKUP_AT_BOOT) {
  loadBackupAtStartup();
  state.events = normalizeEventCollection(state.events || []);
}

// Charger les données depuis Prisma au démarrage pour restaurer l'état
const loadStateFromPrisma = async () => {
  try {
    const [
      expenseReports,
      transactions,
      balances,
      documents,
      scheduledOps,
      financialDocs,
      categories,
      retroNews
    ] = await Promise.all([
      prisma.finance_expense_reports.findMany().catch(() => []),
      prisma.finance_transactions.findMany().catch(() => []),
      prisma.finance_balances.findFirst().catch(() => null),
      prisma.Document.findMany().catch(() => []),
      prisma.scheduled_operations.findMany().catch(() => []),
      prisma.financial_documents.findMany().catch(() => []),
      prisma.finance_categories.findMany().catch(() => []),
      prisma.RetroNews.findMany().catch(() => [])
    ]);
    
    if (expenseReports.length > 0) {
      state.expenseReports = expenseReports;
      console.log(`✅ ${expenseReports.length} notes de frais chargées depuis Prisma`);
    }
    if (transactions.length > 0) {
      state.transactions = transactions.map(t => ({
        ...t,
        date: t.date?.toISOString?.() || t.date,
        createdAt: t.createdAt?.toISOString?.() || t.createdAt
      }));
      console.log(`✅ ${transactions.length} transactions chargées depuis Prisma`);
    }
    if (balances) {
      state.bankBalance = balances.balance;
      console.log(`✅ Solde bancaire chargé depuis Prisma: ${balances.balance}€`);
    }
    if (documents.length > 0) {
      state.documents = documents;
      console.log(`✅ ${documents.length} documents chargés depuis Prisma`);
    }
    if (scheduledOps.length > 0) {
      state.scheduledOperations = scheduledOps;
      state.scheduled = scheduledOps;
      console.log(`✅ ${scheduledOps.length} opérations programmées chargées depuis Prisma`);
    }
    if (financialDocs.length > 0) {
      state.financialDocuments = financialDocs;
      console.log(`✅ ${financialDocs.length} documents financiers chargés depuis Prisma`);
    }
    if (categories.length > 0) {
      // Remplacer complètement les catégories avec celles de la base (source de vérité)
      state.categories = categories.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description || '',
        color: c.color || '#999999',
        type: c.type || 'BASIC'
      }));
      console.log(`✅ ${categories.length} catégories chargées depuis Prisma`);
    }
    if (retroNews.length > 0) {
      state.retroNews = retroNews.map(n => ({
        ...n,
        createdAt: n.createdAt?.toISOString?.() || n.createdAt,
        updatedAt: n.updatedAt?.toISOString?.() || n.updatedAt,
        publishedAt: n.publishedAt?.toISOString?.() || n.publishedAt
      }));
      console.log(`✅ ${retroNews.length} actualités chargées depuis Prisma`);
    }
  } catch (error) {
    console.warn('⚠️  Erreur chargement Prisma au démarrage:', error.message);
  }
};

// Charger l'état runtime (dernière session) au démarrage
// Ceci restaure les données en mémoire depuis le dernier arrêt
if (fs.existsSync(runtimeStatePath)) {
  try {
    const runtimeData = JSON.parse(fs.readFileSync(runtimeStatePath, 'utf-8'));
    if (runtimeData.state) {
      // Merger le runtime state avec l'état initial
      Object.keys(runtimeData.state).forEach(key => {
        if (Array.isArray(runtimeData.state[key])) {
          state[key] = runtimeData.state[key];
        } else if (typeof runtimeData.state[key] === 'object' && runtimeData.state[key] !== null) {
          state[key] = runtimeData.state[key];
        } else {
          state[key] = runtimeData.state[key];
        }
      });
    }
  } catch (error) {
    // Silently fail - runtime state is not critical
  }
} else {
  // Si pas de runtime-state.json, charger depuis Prisma
  console.log('📦 Pas de runtime-state.json trouvé, chargement depuis Prisma...');
  loadStateFromPrisma().catch(err => console.warn('⚠️  Erreur:', err.message));
}

// CORS configuration - Allow frontend(s) and local dev
const allowedOrigins = [
  // Internal frontend
  'https://www.retrobus-interne.fr',
  'https://retrobus-interne.fr',
  // External frontend
  'https://www.association-rbe.fr',
  'https://association-rbe.fr',
  'https://attractive-kindness-rbe-serveurs.up.railway.app', // Frontend on same Railway
  // Railway subdomains and alternatives
  'https://retrobus-interne-frontend.up.railway.app',
  'https://rbe-frontend.up.railway.app',
  // Local dev
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:8080',
  'http://127.0.0.1:8080'
];

console.log('🔐 CORS Origins allowed:', allowedOrigins);
console.log('🛡️  Sécurités activées: Helmet, Rate Limiting, Input Validation, Data Encryption');

// ============================================================
// 🛡️ SÉCURITÉ - Middlewares de protection
// ============================================================

// 1. Helmet - Headers de sécurité (CSP, X-Frame-Options, etc)
app.use(helmetConfig);

// 2. Rate limiting global
app.use(generalLimiter);

// 3. Secure CORS configuration
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const isDev = process.env.NODE_ENV !== 'production';
  
  // Vérifie l'origine
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else if (isDev && ['localhost', '127.0.0.1'].some(h => origin?.includes(h))) {
    // Autoriser localhost en dev seulement
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    // Refuse l'accès pour les origins non autorisées
    console.warn(`🚫 CORS BLOCKED: Unauthorized origin "${origin}" attempted access`);
    // Ne pas ajouter le header Access-Control-Allow-Origin (le navigateur bloquera)
  }
  
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD');
  res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization,x-qr-token,x-user-matricule,X-CSRF-Token,x-csrf-token');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '3600'); // 1 heure
  
  // Security headers supplémentaires
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  
  if (req.method === 'OPTIONS') {
    console.log(`✅ Preflight OK for ${origin}`);
    return res.sendStatus(200);
  }
  
  console.log(`📨 ${req.method} ${req.path} from ${origin}`);
  next();
});

// Middleware JSON - Accept large payloads for BASE64 images (increased for vehicle galleries)
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// 4. Secure logging - masque les données sensibles
app.use(secureLogger);

// Middleware - Inject Prisma into app locals for routes to access
app.use((req, res, next) => {
  app.locals.prisma = prisma;
  next();
});

// CORS middleware for static uploads (must be BEFORE express.static)
app.use('/uploads', (req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else if (process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].some(h => origin?.includes(h))) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  // Override helmet default for media files served to another origin.
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  res.header('Access-Control-Allow-Methods', 'GET, HEAD');
  res.header('Access-Control-Allow-Headers', 'Origin, Accept, Content-Type');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Cache-Control', 'public, max-age=31536000'); // 1 year for static assets
  next();
});

// Static files (serve uploaded content)
app.use('/uploads', express.static(pathRoot + '/uploads'));

// Auth middleware - decode token and extract user info
app.use((req, res, next) => {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.slice(7);
    try {
      // Try new JWT format first
      const decoded = verifyToken(token);
      if (decoded) {
        req.user = {
          id: decoded.userId || decoded.email,
          email: decoded.email,
          role: decoded.role,
          permissions: decoded.permissions || [],
          iat: decoded.iat,
          exp: decoded.exp
        };
        return next();
      }

      // Fallback: legacy stub token format for backward-compatibility
      // Token format: 'stub.' + base64(email)
      if (token.startsWith('stub.')) {
        console.warn('⚠️  Using deprecated stub token format (no expiration). Please login again.');
        const emailB64 = token.slice(5);
        const email = Buffer.from(emailB64, 'base64').toString('utf-8');
        req.user = { 
          email: email, 
          id: email,
          legacyToken: true  // Mark as legacy for potential warnings later
        };
        return next();
      }
    } catch (e) {
      console.warn('❌ Token verification failed:', e.message);
      // Silently fail and continue (no user attached)
    }
  }
  next();
});

const requireAuth = (req, res, next) => {
  if (!req.user) {
    console.warn(`🚫 requireAuth failed for ${req.method} ${req.path} - No user attached to request`);
    console.warn(`   Authorization header:`, req.headers.authorization ? req.headers.authorization.substring(0, 50) + '...' : 'ABSENT');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  console.log(`✅ requireAuth passed for ${req.method} ${req.path} - User: ${req.user.email}`);
  next();
};

const requireMobileVehicleAccess = async (req, res, next) => {
  if (req.user) return next();

  const matricule = String(req.headers['x-user-matricule'] || '').trim();
  const qrToken = String(req.headers['x-qr-token'] || '').trim();
  if (!matricule && !qrToken) return res.status(401).json({ error: 'Mobile vehicle access requires matricule or QR token' });

  if (matricule) {
    try {
      const member = await prisma.members.findFirst({
        where: {
          OR: [
            { matricule: { equals: matricule, mode: 'insensitive' } },
            { email: { equals: matricule, mode: 'insensitive' } },
          ],
        },
        select: { id: true, matricule: true, email: true, firstName: true, lastName: true },
      });
      if (member) {
        req.mobileUser = member;
        return next();
      }
    } catch (error) {
      console.warn('⚠️ Mobile matricule lookup failed:', error.message);
    }

    const stateMember = (state.members || []).find((member) => {
      const memberMatricule = String(member.matricule || member.username || member.id || '').toLowerCase();
      const memberEmail = String(member.email || '').toLowerCase();
      const lookup = matricule.toLowerCase();
      return memberMatricule === lookup || memberEmail === lookup;
    });
    if (stateMember) {
      req.mobileUser = stateMember;
      return next();
    }
  }

  if (qrToken) return next();
  return res.status(401).json({ error: 'Matricule inconnu' });
};

const ADMIN_ACCESS_ROLES = ['ADMIN', 'PRESIDENT', 'VICE_PRESIDENT', 'TRESORIER', 'SECRETAIRE_GENERAL'];

const hasAdminAccessRole = (role) => ADMIN_ACCESS_ROLES.includes(String(role || '').toUpperCase());

const isAdminRequest = async (req) => {
  const email = req.user?.email;
  if (!email) return false;

  try {
    const dbMember = await prisma.members.findFirst({
      where: {
        email: {
          equals: String(email),
          mode: 'insensitive',
        },
      },
      select: { role: true },
    });

    if (dbMember?.role === 'ADMIN') return true;
  } catch (error) {
    console.warn('⚠️ isAdminRequest DB lookup failed:', error.message);
  }

  return !!state.members.find((m) => String(m.email || '').toLowerCase() === String(email).toLowerCase() && m.role === 'ADMIN');
};

const isTrafficContextRequest = async (req) => {
  const email = String(req.user?.email || '').toLowerCase();
  const id = String(req.user?.id || '').toLowerCase();

  if (email === 'clement.marcypro@gmail.com' || id === 'c.marcy') return true;
  if (hasAdminAccessRole(req.user?.role)) return true;

  try {
    const dbMember = await prisma.members.findFirst({
      where: {
        email: {
          equals: String(req.user?.email || req.user?.id || ''),
          mode: 'insensitive',
        },
      },
      select: { role: true },
    });

    if (hasAdminAccessRole(dbMember?.role)) return true;
  } catch (error) {
    console.warn('⚠️ isTrafficContextRequest DB lookup failed:', error.message);
  }

  return !!state.members.find((m) => {
    const memberEmail = String(m.email || '').toLowerCase();
    const memberId = String(m.matricule || m.username || m.id || '').toLowerCase();
    return (memberEmail === email || memberId === id) && hasAdminAccessRole(m.role);
  });
};

const requireAdmin = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const isAdmin = await isAdminRequest(req);
  if (!isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
};

const requireTrafficContextAccess = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const canAccess = await isTrafficContextRequest(req);
  if (!canAccess) {
    return res.status(403).json({ error: 'Traffic context access required' });
  }

  next();
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = 12000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const TRAFFIC_CONTEXT_HISTORY_MAX = 240;
const trafficContextHistory = [];
const externalTrafficDailyStore = new Map();

const recordTrafficSnapshot = (snapshot) => {
  trafficContextHistory.push(snapshot);
  if (trafficContextHistory.length > TRAFFIC_CONTEXT_HISTORY_MAX) {
    trafficContextHistory.splice(0, trafficContextHistory.length - TRAFFIC_CONTEXT_HISTORY_MAX);
  }
};

const getTrafficTimeline = (limit = 72) => {
  const normalizedLimit = Number.isFinite(Number(limit))
    ? Math.max(12, Math.min(240, Number(limit)))
    : 72;

  return trafficContextHistory.slice(-normalizedLimit);
};

const buildDailyKey = (date = new Date()) => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const classifyAccessSource = (referrer = '', sourceHint = '') => {
  const source = String(sourceHint || '').toLowerCase();
  const ref = String(referrer || '').toLowerCase();

  if (source.includes('google') || ref.includes('google.')) return 'google';
  if (source.includes('share') || source.includes('social') || /facebook|instagram|tiktok|discord|x\.com|twitter|linkedin|whatsapp/.test(ref)) return 'share';
  if (!ref || ref === 'direct' || ref === 'none') return 'direct';
  return 'site';
};

const ensureDailyTrafficEntry = (key) => {
  if (!externalTrafficDailyStore.has(key)) {
    externalTrafficDailyStore.set(key, {
      date: key,
      visits: 0,
      pageViews: 0,
      clicks: 0,
      sources: {
        google: 0,
        direct: 0,
        share: 0,
        site: 0,
      },
      search: {
        impressions: 0,
        clicks: 0,
        queries: {},
      },
      adsense: {
        impressions: 0,
        clicks: 0,
        estimatedRevenue: 0,
      },
      pages: {},
    });
  }

  return externalTrafficDailyStore.get(key);
};

const normalizeSearchQuery = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return null;
  return raw.slice(0, 120);
};

const getMonthRange = (monthParam) => {
  const now = new Date();
  const requested = parseMonthParam(monthParam);
  const year = requested?.year ?? now.getUTCFullYear();
  const month = requested?.month ?? (now.getUTCMonth() + 1);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const isCurrentMonth = year === now.getUTCFullYear() && month === (now.getUTCMonth() + 1);
  const currentDay = isCurrentMonth ? now.getUTCDate() : daysInMonth;
  const monthLabel = `${year}-${String(month).padStart(2, '0')}`;
  const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

  return { year, month, daysInMonth, isCurrentMonth, currentDay, monthLabel, startDate, endDate };
};

const applyTrafficEventToEntry = (entry, event) => {
  const eventType = String(event?.eventType || '').toLowerCase();
  const source = String(event?.source || 'direct').toLowerCase();
  const pathValue = String(event?.path || '/').slice(0, 200);
  const query = normalizeSearchQuery(event?.searchQuery);
  const estimatedCpc = 0.18;

  if (eventType === 'visit') entry.visits += 1;
  if (eventType === 'pageview') entry.pageViews += 1;
  if (eventType === 'click') entry.clicks += 1;
  if (eventType === 'search_impression') entry.search.impressions += 1;
  if (eventType === 'search_click') entry.search.clicks += 1;
  if (eventType === 'ad_impression') entry.adsense.impressions += 1;
  if (eventType === 'ad_click') {
    entry.adsense.clicks += 1;
    entry.adsense.estimatedRevenue = Number((entry.adsense.estimatedRevenue + estimatedCpc).toFixed(2));
  }

  if (Object.prototype.hasOwnProperty.call(entry.sources, source)) {
    entry.sources[source] += 1;
  } else {
    entry.sources.site += 1;
  }

  if (source === 'google' && eventType === 'visit') entry.search.clicks += 1;
  if (source === 'google' && eventType === 'pageview') entry.search.impressions += 1;

  if (query) {
    entry.search.queries[query] = (entry.search.queries[query] || 0) + 1;
  }

  if (pathValue) {
    entry.pages[pathValue] = (entry.pages[pathValue] || 0) + 1;
  }
};

const getSearchConsoleSiteUrl = () => {
  return (process.env.SEARCH_CONSOLE_SITE_URL || process.env.EXTERNAL_SITE_URL || '').trim();
};

const getSearchConsoleCredentials = () => {
  // Support OAuth 2.0 (préféré)
  const clientId = process.env.SEARCH_CONSOLE_CLIENT_ID;
  const clientSecret = process.env.SEARCH_CONSOLE_CLIENT_SECRET;
  const refreshToken = process.env.SEARCH_CONSOLE_REFRESH_TOKEN;
  
  if (clientId && clientSecret && refreshToken) {
    return {
      type: 'oauth2',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken
    };
  }

  // Support Service Account (fallback)
  const rawJson = process.env.SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON;
  const rawBase64 = process.env.SEARCH_CONSOLE_SERVICE_ACCOUNT_BASE64;

  if (rawJson) {
    const parsed = JSON.parse(rawJson);
    return { ...parsed, type: 'service_account' };
  }

  if (rawBase64) {
    const decoded = Buffer.from(rawBase64, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);
    return { ...parsed, type: 'service_account' };
  }

  return null;
};

const getSearchConsoleOverview = async ({ monthParam, startDateParam, endDateParam } = {}) => {
  const siteUrl = getSearchConsoleSiteUrl();
  const credentials = getSearchConsoleCredentials();

  // Vérifier les credentials selon le type
  const isOAuth = credentials?.type === 'oauth2';
  const isServiceAccount = credentials?.type === 'service_account';
  
  if (!siteUrl) {
    return {
      enabled: false,
      siteUrl: null,
      error: 'Missing SEARCH_CONSOLE_SITE_URL',
    };
  }

  if (!credentials || (!isOAuth && !isServiceAccount)) {
    return {
      enabled: false,
      siteUrl: siteUrl || null,
      error: 'Missing Search Console credentials',
    };
  }

  // Valider les credentials OAuth
  if (isOAuth && (!credentials.client_id || !credentials.client_secret || !credentials.refresh_token)) {
    return {
      enabled: false,
      siteUrl: siteUrl || null,
      error: 'Incomplete OAuth 2.0 credentials',
    };
  }

  // Valider les credentials Service Account
  if (isServiceAccount && (!credentials.client_email || !credentials.private_key)) {
    return {
      enabled: false,
      siteUrl: siteUrl || null,
      error: 'Incomplete Service Account credentials',
    };
  }

  const monthRange = getMonthRange(monthParam);
  const startDate = String(startDateParam || monthRange.startDate.toISOString().slice(0, 10));
  const endDate = String(endDateParam || new Date(monthRange.endDate.getTime() - 86400000).toISOString().slice(0, 10));

  // Créer le client d'authentification selon le type
  let auth;
  if (isOAuth) {
    // OAuth 2.0 Client
    auth = new google.auth.OAuth2(
      credentials.client_id,
      credentials.client_secret,
      'http://localhost:3000/oauth2callback' // Redirect URI (pas utilisé ici)
    );
    auth.setCredentials({
      refresh_token: credentials.refresh_token
    });
    console.log('🔐 Using OAuth 2.0 for Search Console API');
  } else {
    // Service Account JWT
    auth = new google.auth.JWT({
      email: credentials.client_email,
      key: String(credentials.private_key).replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });
    console.log('🔐 Using Service Account for Search Console API');
  }

  const webmasters = google.webmasters({ version: 'v3', auth });

  const [summaryRes, queriesRes] = await Promise.all([
    webmasters.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['date'],
        rowLimit: 25000,
      },
    }),
    webmasters.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['query'],
        rowLimit: 25,
      },
    }),
  ]);

  const summaryRows = Array.isArray(summaryRes?.data?.rows) ? summaryRes.data.rows : [];
  const queryRows = Array.isArray(queriesRes?.data?.rows) ? queriesRes.data.rows : [];
  const latestDataDate = summaryRows
    .map((row) => String(row?.keys?.[0] || ''))
    .filter((dateValue) => /^\d{4}-\d{2}-\d{2}$/.test(dateValue))
    .sort()
    .at(-1) || null;
  const dataLagDays = latestDataDate
    ? Math.max(0, Math.floor((Date.now() - new Date(`${latestDataDate}T00:00:00.000Z`).getTime()) / 86400000))
    : null;

  const totals = summaryRows.reduce((acc, row) => {
    acc.clicks += Number(row?.clicks || 0);
    acc.impressions += Number(row?.impressions || 0);
    acc.positionSum += Number(row?.position || 0) * Number(row?.impressions || 0);
    return acc;
  }, { clicks: 0, impressions: 0, positionSum: 0 });

  const ctr = totals.impressions > 0 ? Number(((totals.clicks / totals.impressions) * 100).toFixed(2)) : 0;
  const avgPosition = totals.impressions > 0 ? Number((totals.positionSum / totals.impressions).toFixed(2)) : 0;

  const topQueries = queryRows
    .slice(0, 10)
    .map((row) => ({
      query: String(row?.keys?.[0] || ''),
      clicks: Number(row?.clicks || 0),
      impressions: Number(row?.impressions || 0),
      ctr: Number((Number(row?.ctr || 0) * 100).toFixed(2)),
      position: Number(Number(row?.position || 0).toFixed(2)),
    }))
    .filter((row) => row.query);

  return {
    enabled: true,
    siteUrl,
    startDate,
    endDate,
    generatedAt: new Date().toISOString(),
    latestDataDate,
    dataLagDays,
    rowsCount: summaryRows.length,
    clicks: totals.clicks,
    impressions: totals.impressions,
    ctr,
    avgPosition,
    topQueries,
  };
};

const parseMonthParam = (value) => {
  const raw = String(value || '').trim();
  if (!/^\d{4}-\d{2}$/.test(raw)) return null;
  const [yearStr, monthStr] = raw.split('-');
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  return { year, month };
};

const buildMonthlyVisitsSeries = (history, monthParam) => {
  const now = new Date();
  const requested = parseMonthParam(monthParam);
  const year = requested?.year ?? now.getUTCFullYear();
  const month = requested?.month ?? (now.getUTCMonth() + 1);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const buckets = Array.from({ length: daysInMonth }, () => 0);

  for (const point of history) {
    const timestamp = point?.timestamp ? new Date(point.timestamp) : null;
    if (!timestamp || Number.isNaN(timestamp.getTime())) continue;
    const pointYear = timestamp.getUTCFullYear();
    const pointMonth = timestamp.getUTCMonth() + 1;
    if (pointYear !== year || pointMonth !== month) continue;

    const day = timestamp.getUTCDate();
    const idx = day - 1;
    if (idx < 0 || idx >= buckets.length) continue;

    const visitsCandidate = Number(point.visitsCount);
    const fallbackCandidate = Number(point.pageProbeSuccessCount);
    const value = Number.isFinite(visitsCandidate)
      ? visitsCandidate
      : (Number.isFinite(fallbackCandidate) ? fallbackCandidate : 0);
    buckets[idx] += Math.max(0, Math.round(value));
  }

  return {
    month: `${year}-${String(month).padStart(2, '0')}`,
    daysInMonth,
    series: buckets.map((visits, index) => ({ day: index + 1, visits })),
  };
};

const buildMonthlyTrafficAnalytics = async (monthParam) => {
  const range = getMonthRange(monthParam);

  const series = [];
  const totals = {
    visits: 0,
    pageViews: 0,
    clicks: 0,
    sources: {
      google: 0,
      direct: 0,
      share: 0,
      site: 0,
    },
    pageVisits: {},
    search: {
      impressions: 0,
      clicks: 0,
      queries: {},
    },
    adsense: {
      impressions: 0,
      clicks: 0,
      estimatedRevenue: 0,
      estimatedCpc: 0.18,
    },
  };

  const monthEntries = new Map();
  const freshness = {
    eventsCount: 0,
    lastEventAt: null,
    lastPageViewAt: null,
    lastSearchEventAt: null,
    lastAdEventAt: null,
  };
  for (let day = 1; day <= range.daysInMonth; day += 1) {
    monthEntries.set(day, {
      visits: 0,
      pageViews: 0,
      clicks: 0,
      sources: { google: 0, direct: 0, share: 0, site: 0 },
      search: { impressions: 0, clicks: 0, queries: {} },
      adsense: { impressions: 0, clicks: 0, estimatedRevenue: 0 },
      pages: {},
    });
  }

  try {
    const persistedEvents = await prisma.analyticsTrafficEvent.findMany({
      where: {
        createdAt: {
          gte: range.startDate,
          lt: range.endDate,
        },
      },
      select: {
        createdAt: true,
        eventType: true,
        path: true,
        source: true,
        searchQuery: true,
      },
    });

    persistedEvents.forEach((event) => {
      const day = new Date(event.createdAt).getUTCDate();
      const entry = monthEntries.get(day);
      if (!entry) return;
      applyTrafficEventToEntry(entry, event);
      freshness.eventsCount += 1;

      const eventIso = event.createdAt instanceof Date ? event.createdAt.toISOString() : new Date(event.createdAt).toISOString();
      if (!freshness.lastEventAt || eventIso > freshness.lastEventAt) freshness.lastEventAt = eventIso;
      if (event.eventType === 'pageview' && (!freshness.lastPageViewAt || eventIso > freshness.lastPageViewAt)) {
        freshness.lastPageViewAt = eventIso;
      }
      if (['search_impression', 'search_click'].includes(event.eventType) && (!freshness.lastSearchEventAt || eventIso > freshness.lastSearchEventAt)) {
        freshness.lastSearchEventAt = eventIso;
      }
      if (['ad_impression', 'ad_click'].includes(event.eventType) && (!freshness.lastAdEventAt || eventIso > freshness.lastAdEventAt)) {
        freshness.lastAdEventAt = eventIso;
      }
    });
  } catch (error) {
    console.warn('⚠️ buildMonthlyTrafficAnalytics DB fallback to memory:', error.message);

    for (let day = 1; day <= range.daysInMonth; day += 1) {
      const dateKey = `${range.monthLabel}-${String(day).padStart(2, '0')}`;
      const memoryEntry = externalTrafficDailyStore.get(dateKey);
      if (memoryEntry) monthEntries.set(day, memoryEntry);
    }
  }

  for (let day = 1; day <= range.daysInMonth; day += 1) {
    const daily = monthEntries.get(day);
    const dateKey = `${range.monthLabel}-${String(day).padStart(2, '0')}`;
    const hasStarted = !range.isCurrentMonth || day <= range.currentDay;

    const visits = hasStarted ? Number(daily?.visits || 0) : null;
    const pageViews = hasStarted ? Number(daily?.pageViews || 0) : null;
    const clicks = hasStarted ? Number(daily?.clicks || 0) : null;
    const searchImpressions = hasStarted ? Number(daily?.search?.impressions || 0) : null;
    const searchClicks = hasStarted ? Number(daily?.search?.clicks || 0) : null;
    const adImpressions = hasStarted ? Number(daily?.adsense?.impressions || 0) : null;
    const adClicks = hasStarted ? Number(daily?.adsense?.clicks || 0) : null;
    const adRevenue = hasStarted ? Number(daily?.adsense?.estimatedRevenue || 0) : null;

    series.push({
      day,
      date: dateKey,
      visits,
      pageViews,
      clicks,
      searchImpressions,
      searchClicks,
      adImpressions,
      adClicks,
      adRevenue,
    });

    if (hasStarted) {
      totals.visits += Number(daily?.visits || 0);
      totals.pageViews += Number(daily?.pageViews || 0);
      totals.clicks += Number(daily?.clicks || 0);
      totals.sources.google += Number(daily?.sources?.google || 0);
      totals.sources.direct += Number(daily?.sources?.direct || 0);
      totals.sources.share += Number(daily?.sources?.share || 0);
      totals.sources.site += Number(daily?.sources?.site || 0);
      totals.search.impressions += Number(daily?.search?.impressions || 0);
      totals.search.clicks += Number(daily?.search?.clicks || 0);
      totals.adsense.impressions += Number(daily?.adsense?.impressions || 0);
      totals.adsense.clicks += Number(daily?.adsense?.clicks || 0);
      totals.adsense.estimatedRevenue += Number(daily?.adsense?.estimatedRevenue || 0);

      Object.entries(daily?.pages || {}).forEach(([pathKey, count]) => {
        totals.pageVisits[pathKey] = (totals.pageVisits[pathKey] || 0) + Number(count || 0);
      });

      Object.entries(daily?.search?.queries || {}).forEach(([queryKey, count]) => {
        totals.search.queries[queryKey] = (totals.search.queries[queryKey] || 0) + Number(count || 0);
      });
    }
  }

  const topPages = Object.entries(totals.pageVisits)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([path, visits]) => ({ path, visits }));

  const topQueries = Object.entries(totals.search.queries)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([query, clicks]) => ({ query, clicks }));

  const searchCtr = totals.search.impressions > 0
    ? Number(((totals.search.clicks / totals.search.impressions) * 100).toFixed(2))
    : 0;
  const adsCtr = totals.adsense.impressions > 0
    ? Number(((totals.adsense.clicks / totals.adsense.impressions) * 100).toFixed(2))
    : 0;
  const rpm = totals.pageViews > 0
    ? Number(((totals.adsense.estimatedRevenue / totals.pageViews) * 1000).toFixed(2))
    : 0;

  return {
    month: range.monthLabel,
    daysInMonth: range.daysInMonth,
    currentDay: range.currentDay,
    series,
    freshness,
    totals: {
      visits: totals.visits,
      pageViews: totals.pageViews,
      clicks: totals.clicks,
      sources: totals.sources,
      topPages,
      searchConsole: {
        impressions: totals.search.impressions,
        clicks: totals.search.clicks,
        ctr: searchCtr,
        topQueries,
      },
      adsense: {
        impressions: totals.adsense.impressions,
        clicks: totals.adsense.clicks,
        ctr: adsCtr,
        estimatedCpc: totals.adsense.estimatedCpc,
        estimatedRevenue: Number(totals.adsense.estimatedRevenue.toFixed(2)),
        rpm,
      },
    },
  };
};

const probeHttpUrl = async (url) => {
  const startedAt = Date.now();
  try {
    const response = await fetchWithTimeout(url, { method: 'GET' }, 12000);
    const elapsedMs = Date.now() - startedAt;
    const contentType = response.headers.get('content-type') || null;
    const contentLength = response.headers.get('content-length') || null;

    let title = null;
    if (contentType && contentType.includes('text/html')) {
      const body = await response.text();
      const titleMatch = body.match(/<title>([^<]+)<\/title>/i);
      title = titleMatch?.[1]?.trim() || null;
    }

    return {
      url,
      ok: response.ok,
      status: response.status,
      responseTimeMs: elapsedMs,
      contentType,
      contentLength: contentLength ? Number(contentLength) : null,
      title,
    };
  } catch (error) {
    return {
      url,
      ok: false,
      status: null,
      responseTimeMs: Date.now() - startedAt,
      error: error?.name === 'AbortError' ? 'timeout' : (error?.message || 'request_failed'),
    };
  }
};

const getPageSpeedMetrics = async (targetUrl, strategy) => {
  const apiKey = process.env.PAGESPEED_API_KEY;
  if (!apiKey) {
    return {
      enabled: false,
      strategy,
      error: 'PAGESPEED_API_KEY missing',
    };
  }

  const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(targetUrl)}&strategy=${strategy}&category=performance&key=${encodeURIComponent(apiKey)}`;
  const response = await fetchWithTimeout(endpoint, { method: 'GET' }, 25000);

  if (!response.ok) {
    return {
      enabled: true,
      strategy,
      error: `PageSpeed API HTTP ${response.status}`,
    };
  }

  const data = await response.json();
  const lighthouse = data?.lighthouseResult;
  const audits = lighthouse?.audits || {};
  const perfScoreRaw = lighthouse?.categories?.performance?.score;

  return {
    enabled: true,
    strategy,
    score: typeof perfScoreRaw === 'number' ? Math.round(perfScoreRaw * 100) : null,
    lcpMs: Math.round(audits['largest-contentful-paint']?.numericValue || 0),
    fcpMs: Math.round(audits['first-contentful-paint']?.numericValue || 0),
    cls: Number(audits['cumulative-layout-shift']?.numericValue || 0),
    tbtMs: Math.round(audits['total-blocking-time']?.numericValue || 0),
    speedIndexMs: Math.round(audits['speed-index']?.numericValue || 0),
    fetchTime: lighthouse?.fetchTime || null,
  };
};

// ============================================================
// � CSRF PROTECTION MIDDLEWARE
// ============================================================
// Ajouter CSRF protection sur POST, PUT, DELETE
app.use(csrfProtection);

// Ajouter le nouveau token aux réponses
app.use(includeNewCSRFToken);

// Periodic cleanup des tokens CSRF expirés (toutes les heures)
setInterval(() => {
  cleanupExpiredTokens();
}, 60 * 60 * 1000);

console.log('🔐 CSRF Protection enabled with token-based validation');

// ============================================================
// �📦 ROUTES MODULAIRES
// ============================================================
// Routes d'authentification (login, token, etc)
app.use('/api/auth', authRoutes);
// NOTE: /api/login endpoint is now provided by /api/auth/login via modular routes

// Routes système (health, version, status)
app.use('/api', systemRoutes);

// Routes notifications (gestion des notifications système)
app.use('/api/notifications', notificationsRoutes);

// Routes événements (gestion des événements et participants)
app.use('/api/events', eventsRoutes);

// Routes billetterie musée (gestion des tarifs et ventes)
app.use('/api/ticketing', ticketingRoutes);

// Routes musée (gestion des collections et modules)
app.use('/api/museum', museumRoutes);

// Routes RétroMail (gestion des emails Infomaniak)
app.use('/api/mail', mailRoutes);

// Routes Team (gestion de l'équipe RBE)
app.use('/api/team', teamRoutes);

// Routes Templates (gestion des modèles de documents Word)
app.use('/api/templates', templatesRoutes);

// Routes Bulletin Flow (parcours numérique de signature)
app.use('/api/bulletin-flow', bulletinFlowRoutes);

// Routes Bulletin Stats (statistiques et suivi des bulletins)
app.use('/api/bulletin-stats', bulletinStatsRoutes);

// Routes Changelog (historique des modifications et versions)
app.use('/api/changelog', changelogRoutes);

// Routes LumiStudio (lancement distant + healthcheck)
app.use('/api/lumistudio', lumistudioRoutes);

// Routes Process PARC (préservation et intégration véhicules)
app.use('/api/process-parc', processParcRoutes);

// TODO: Ajouter d'autres routes modulaires
// app.use('/api/members', memberRoutes);
// app.use('/api/vehicles', vehicleRoutes);
// app.use('/api/finance', financeRoutes);
// etc.

// ============================================================
// 🚗 ENDPOINT IDENTIFICATION DE VÉHICULES
// ============================================================
// Recherche d'un véhicule par plaque d'immatriculation
app.get('/api/vehicles/search', async (req, res) => {
  try {
    const { plate } = req.query;
    
    if (!plate) {
      return res.status(400).json({
        success: false,
        error: 'Le paramètre "plate" est requis'
      });
    }
    
    // Recherche du véhicule
    const vehicleData = await identifyVehicle(plate);
    
    if (!vehicleData) {
      return res.status(404).json({
        success: false,
        error: 'Véhicule non trouvé',
        plate: plate
      });
    }
    
    res.json({
      success: true,
      data: vehicleData
    });
  } catch (error) {
    console.error('❌ Erreur recherche véhicule:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la recherche du véhicule'
    });
  }
});

// 🖼️ Génération d'images de plaques d'immatriculation

// Route 1: avec query params uniquement: /public/plaque?immat=FG-920-RE&dept=34&region=Occ
app.get('/public/plaque', (req, res) => {
  // Vérifier si c'est bien un appel avec query params (pas de paramètre d'URL)
  if (req.query.immat) {
    try {
      const immat = req.query.immat.toUpperCase();
      const dept = req.query.dept || "91";
      const region = req.query.region || "IDF";
      
      console.log(`🖼️ Génération plaque SVG (query): ${immat} (${dept} - ${region})`);
      
      streamPlateSVG(immat, dept, region, res);
    } catch (error) {
      console.error('❌ Erreur génération plaque:', error);
      res.status(500).json({
        error: 'Erreur lors de la génération de la plaque'
      });
    }
  } else {
    // Plaque par défaut si aucun paramètre
    const immat = "FG-920-RE";
    const dept = "91";
    const region = "IDF";
    streamPlateSVG(immat, dept, region, res);
  }
});

// Route 2: avec paramètre d'URL: /public/plaque/FG-920-RE?dept=34&region=Occ
app.get('/public/plaque/:immat', (req, res) => {
  try {
    const immat = req.params.immat.toUpperCase();
    const dept = req.query.dept || "91";
    const region = req.query.region || "IDF";
    
    console.log(`🖼️ Génération plaque SVG (param): ${immat} (${dept} - ${region})`);
    
    // Validation basique
    if (!immat || immat.length < 2 || immat.length > 15) {
      return res.status(400).json({
        error: 'Format d\'immatriculation invalide'
      });
    }
    
    streamPlateSVG(immat, dept, region, res);
  } catch (error) {
    console.error('❌ Erreur génération plaque:', error);
    res.status(500).json({
      error: 'Erreur lors de la génération de la plaque'
    });
  }
});

// Endpoint public (sans authentification) pour les inscriptions
app.get('/public/vehicles/search', async (req, res) => {
  try {
    const { plate } = req.query;
    
    if (!plate) {
      return res.status(400).json({
        success: false,
        error: 'Le paramètre "plate" est requis'
      });
    }
    
    const vehicleData = await identifyVehicle(plate);
    
    if (!vehicleData) {
      return res.status(404).json({
        success: false,
        error: 'Véhicule non trouvé',
        plate: plate
      });
    }
    
    res.json({
      success: true,
      data: vehicleData
    });
  } catch (error) {
    console.error('❌ Erreur recherche véhicule:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la recherche du véhicule'
    });
  }
});

// ============================================================
// ENDPOINTS LEGACY (à extraire progressivement)
// ============================================================

// Health & version
app.get(['/api/health','/health'], (req, res) => res.json({ ok: true, time: new Date().toISOString(), version: 'rebuild-1' }));

// ============================================================
// 🔐 CSRF Token Endpoint - Get a new CSRF token
// ============================================================
// Accessible à tout le monde (pas besoin d'auth pour obtenir un token)
// Utilisé par le frontend au login et pour les mutations suivantes
app.get(['/api/csrf-token', '/csrf-token'], (req, res) => {
  try {
    const token = generateCSRFToken();
    console.log(`✅ CSRF token generated for request from ${req.headers.origin}`);
    res.json({ 
      csrfToken: token,
      expiresIn: '24h',
      message: 'Store this token and send it in X-CSRF-Token header for all mutations' 
    });
  } catch (error) {
    console.error('❌ Error generating CSRF token:', error.message);
    res.status(500).json({ error: 'Failed to generate CSRF token' });
  }
});

// Export endpoint pour sauvegarde - accessible pour les scripts de backup
app.get(['/api/export/state', '/export/state'], async (req, res) => {
  try {
    // En mode Prisma, récupérer les données depuis la base de données
    const [members, vehicles, events, retroNews, flashes, transactions, expenseReports, documents, maintenances, usages, retroRequests, retroRequestFiles] = await Promise.all([
      prisma.members.findMany(),
      prisma.vehicle.findMany(),
      prisma.event.findMany(),
      prisma.retroNews.findMany(),
      prisma.flash.findMany(),
      prisma.financeTransaction.findMany(),
      prisma.finance_expense_reports.findMany(),
      prisma.document.findMany(),
      prisma.vehicleMaintenance.findMany(),
      prisma.vehicleUsage.findMany(),
      prisma.retro_request.findMany(),
      prisma.retro_request_file.findMany()
    ]);

    const exported = {
      timestamp: new Date().toISOString(),
      description: 'Export complet depuis Prisma (base de données)',
      mode: 'PRISMA_DATABASE',
      tables: {
        members: { count: members.length, data: members },
        site_users: { count: 0, data: [] },
        Vehicle: { count: vehicles.length, data: vehicles },
        Event: { count: events.length, data: events },
        RetroNews: { count: retroNews.length, data: retroNews },
        Flash: { count: flashes.length, data: flashes },
        finance_transactions: { count: transactions.length, data: transactions },
        finance_expense_reports: { count: expenseReports.length, data: expenseReports },
        Document: { count: documents.length, data: documents },
        DevisLine: { count: 0, data: [] },
        QuoteTemplate: { count: 0, data: [] },
        financial_documents: { count: 0, data: [] },
        user_permissions: { count: 0, data: {} },
        vehicle_maintenance: { count: maintenances.length, data: maintenances },
        vehicle_service_schedule: { count: 0, data: [] },
        Usage: { count: usages.length, data: usages },
        retro_request: { count: retroRequests.length, data: retroRequests },
        retro_request_file: { count: retroRequestFiles.length, data: retroRequestFiles },
        notification_preferences: { count: 0, data: [] },
        scheduled_operations: { count: 0, data: [] },
        scheduled_operation_payments: { count: 0, data: [] }
      }
    };
    res.json(exported);
  } catch (e) {
    console.error('❌ Error exporting state:', e.message);
    res.status(500).json({ error: 'Failed to export state', details: e.message });
  }
});

// AUTH
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    // 🔐 Validation et sanitization des entrées
    const email = sanitizeInput(req.body?.email || '').toLowerCase().trim();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    
    if (!email || !password) {
      auditLog('LOGIN_ATTEMPT_MISSING_FIELDS', email, { email: !!email, password: !!password }, 'failed');
      return res.status(400).json({ error: 'email & password requis' });
    }
    
    // Try in-memory first
    let member = state.members.find(m => m.email === email);
    
    // If not found in memory, try Prisma directly
    if (!member) {
      try {
        member = await prisma.members.findUnique({
          where: { email }
        });
        // Also update state.members if found
        if (member) {
          state.members.push({
            id: member.id,
            email: member.email,
            firstName: member.firstName,
            lastName: member.lastName,
            matricule: member.matricule,
            password: member.password,
            role: member.role,
            status: member.status,
            permissions: member.permissions || [],
            createdAt: member.createdAt instanceof Date ? member.createdAt.toISOString() : member.createdAt
          });
        }
      } catch (e) {
        console.error('❌ Error checking Prisma for admin user:', e.message);
        auditLog('LOGIN_DB_ERROR', email, { error: e.message }, 'failed');
      }
    }
    
    if (!member) {
      auditLog('LOGIN_USER_NOT_FOUND', email, { path: '/auth/login' }, 'failed');
      return res.status(401).json({ error: 'Identifiants invalides' });
    }
    
    // Verify password (support both plaintext and hashed)
    let passwordValid = false;
    if (member.password?.includes(':')) {
      // New format: hash:salt:iterations
      passwordValid = verifyPassword(password, member.password);
    } else {
      // Legacy plaintext password
      passwordValid = (password === member.password);
    }
    
    if (!passwordValid) {
      auditLog('LOGIN_INVALID_PASSWORD', email, { path: '/auth/login' }, 'failed');
      return res.status(401).json({ error: 'Identifiants invalides' });
    }
    
    // Update last login in Prisma
    try {
      if (member.id) {
        await prisma.members.update({
          where: { id: member.id },
          data: { lastLoginAt: new Date() }
        });
      }
    } catch (e) {
      console.warn('⚠️ Could not update lastLoginAt:', e.message);
    }
    
    // Find user's role from site_users via linkedMemberId
    let role = member.role || 'MEMBER';
    if (state.siteUsers && member.id) {
      const siteUser = state.siteUsers.find(u => u.linkedMemberId === member.id);
      if (siteUser) {
        role = siteUser.role || 'MEMBER';
      }
    }
    
    // ✅ Créer JWT avec expiration 1h (ancien: token stub sans expiration)
    const { accessToken, refreshToken } = createTokenPair({
      userId: member.id,
      email: email,
      role: role,
      permissions: member.permissions || []
    });
    
    auditLog('LOGIN_SUCCESS', email, { role, hasPermissions: !!member.permissions }, 'success');
    res.json({ 
      token: accessToken,  // Pour backward-compatibility (ancien client)
      accessToken: accessToken,
      refreshToken: refreshToken,
      expiresIn: '1h',  // Nouveau token expire après 1h
      user: { 
        id: member.id, 
        email: member.email, 
        firstName: member.firstName, 
        role: role, 
        permissions: member.permissions || [] 
      } 
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    auditLog('LOGIN_EXCEPTION', req.body?.email, { error: error.message }, 'failed');
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Member login endpoint - accepts identifier (email or username) and password
app.post('/api/auth/member-login', authLimiter, async (req, res) => {
  try {
    // 🔐 Validation et sanitization des entrées
    const identifier = sanitizeInput(req.body?.identifier || '').toLowerCase().trim();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    
    if (!identifier || !password) {
      auditLog('MEMBER_LOGIN_MISSING_FIELDS', identifier, { identifier: !!identifier, password: !!password }, 'failed');
      return res.status(400).json({ error: 'identifier & password requis' });
    }
    
    // Try to find member from Prisma by matricule, email or firstname+lastname
    let member = await prisma.members.findFirst({
      where: {
        OR: [
          { matricule: identifier },
          { email: identifier },
          { email: { startsWith: identifier } }
        ]
      }
    });

    // If not found in Prisma, try state.members (legacy fallback)
    if (!member) {
      const stateM = state.members.find(m => {
        const id = identifier.toLowerCase();
        const matricule = m.matricule?.toLowerCase() || '';
        const email = m.email?.toLowerCase() || '';
        
        if (matricule === id) return true;
        if (email === id) return true;
        if (email.startsWith(id)) return true;
        if (id.includes('@') && email === id) return true;
        
        return false;
      });

      if (!stateM) {
        auditLog('MEMBER_LOGIN_NOT_FOUND', identifier, { path: '/auth/member-login' }, 'failed');
        return res.status(401).json({ error: 'Identifiants invalides' });
      }

      member = stateM;
    }
    
    // Verify password
    if (!member.password) {
      auditLog('MEMBER_LOGIN_NO_PASSWORD', identifier, { memberId: member.id }, 'failed');
      return res.status(401).json({ error: 'No password set for this account' });
    }

    // Try to verify with new hashed format first, then legacy plaintext
    let passwordValid = false;
    if (member.password.includes(':')) {
      // New format: hash:salt:iterations
      passwordValid = verifyPassword(password, member.password);
    } else {
      // Legacy plaintext password
      passwordValid = (password === member.password);
    }

    if (!passwordValid) {
      auditLog('MEMBER_LOGIN_INVALID_PASSWORD', identifier, { memberId: member.id }, 'failed');
      return res.status(401).json({ error: 'Identifiants invalides' });
    }
    
    // ✅ Check if login is enabled (status === "active")
    if (member.status && member.status !== 'active') {
      auditLog('MEMBER_LOGIN_DISABLED_ACCOUNT', identifier, { status: member.status }, 'failed');
      return res.status(403).json({ error: 'Compte désactivé. Veuillez contacter un administrateur.' });
    }
    
    // Update last login timestamp
    try {
      if (member.id && typeof member.id === 'string' && member.id.length > 0) {
        // Prisma member: update in database
        await prisma.members.update({
          where: { id: member.id },
          data: {
            status: 'active',  // Ensure status is active on successful login
            passwordChangedAt: member.isPasswordTemporary ? member.passwordChangedAt : new Date()
          }
        });
        member.status = 'active';
      } else {
        // Legacy state.members: update in state
        member.status = 'active';
      }
    } catch (err) {
      console.warn('⚠️ Could not update login status:', err.message);
      // Non-blocking: still allow login even if we can't update status
    }
    
    // Get role
    let role = member.role || 'MEMBER';
    
    const email = member.email || '';
    
    // ✅ Créer JWT avec expiration 1h (ancien: token stub sans expiration)
    const { accessToken, refreshToken } = createTokenPair({
      userId: member.id,
      email: email,
      role: role,
      permissions: member.permissions || []
    });

    // Check if password must be changed
    const mustChangePassword = member.mustChangePassword === true || member.isPasswordTemporary === true;
    
    auditLog('MEMBER_LOGIN_SUCCESS', identifier, { role, hasPermissions: !!member.permissions }, 'success');
    res.json({ 
      token: accessToken,  // Pour backward-compatibility (ancien client)
      accessToken: accessToken,
      refreshToken: refreshToken,
      expiresIn: '1h',  // Nouveau token expire après 1h
      user: { 
        id: member.id, 
        email: member.email, 
        firstName: member.firstName, 
        lastName: member.lastName, 
        role: role, 
        permissions: member.permissions || [],
        mustChangePassword: mustChangePassword,
        isPasswordTemporary: member.isPasswordTemporary === true,
        accountStatus: member.status || 'active'
      } 
    });
  } catch (e) {
    console.error('❌ POST /api/auth/member-login error:', e.message);
    auditLog('MEMBER_LOGIN_EXCEPTION', req.body?.identifier, { error: e.message }, 'failed');
    res.status(500).json({ error: 'Login failed', details: e.message });
  }
});

// ============================================================
// 🔄 REFRESH TOKEN ENDPOINT - Obtenir un nouveau accessToken
// ============================================================
// Endpoint pour renouveler les tokens expirés sans se reconnecter
// Body: { refreshToken: "..." }
app.post(['/api/auth/refresh-token', '/auth/refresh-token'], async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'refreshToken requis' });
    }

    // Vérifier le refresh token
    const decoded = verifyToken(refreshToken);
    if (!decoded) {
      auditLog('REFRESH_TOKEN_INVALID', decoded?.email || 'unknown', { reason: 'token expired or invalid' }, 'failed');
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    // Créer une nouvelle paire de tokens
    const { accessToken, refreshToken: newRefreshToken } = createTokenPair({
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      permissions: decoded.permissions || []
    });

    auditLog('REFRESH_TOKEN_SUCCESS', decoded.email, { userId: decoded.userId }, 'success');
    res.json({
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: '1h'
    });
  } catch (error) {
    console.error('❌ Refresh token error:', error.message);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

app.get(['/auth/me','/api/auth/me'], requireAuth, (req, res) => {
  const member = state.members.find(m => m.email === req.user.email) || null;
  if (!member) {
    return res.json({ user: null });
  }
  
  // Get role from member.role first, fall back to site_users if needed
  let role = member.role || 'MEMBER';
  
  res.json({ user: { id: member.id, email: member.email, role: role, permissions: member.permissions || [] } });
});

// Session validation - /api/me endpoint
app.get('/api/me', requireAuth, async (req, res) => {
  try {
    const userEmail = String(req.user?.email || '').trim().toLowerCase();
    const username = String(req.user?.username || '').trim();

    // Chercher dans Prisma d'abord
    let member = await prisma.members.findFirst({
      where: {
        OR: [
          ...(userEmail ? [{ email: userEmail }] : []),
          ...(username ? [{ matricule: username }] : [])
        ]
      }
    });

    // Fallback: state.members
    if (!member) {
      member = state.members.find(m => m.email === userEmail) || null;
    }

    if (!member) {
      return res.json({ user: null });
    }

    // Get role from member.role first, fall back to site_users if needed
    let role = member.role || 'MEMBER';

    res.json({ 
      user: { 
        id: member.id, 
        email: member.email, 
        prenom: member.firstName || member.prenom,
        nom: member.lastName || member.nom,
        firstName: member.firstName,
        lastName: member.lastName,
        role: role,
        permissions: member.permissions || [],
        status: member.status || 'active'
      }
    });
  } catch (e) {
    console.error('❌ /api/me error:', e.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUBLIC ENDPOINTS (no authentication required)
app.get('/health', async (req, res) => {
  try {
    // Test Prisma connection
    await prisma.$queryRaw`SELECT 1`;
    res.json({ 
      status: 'OK',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.error('❌ Health check failed:', e.message);
    res.status(503).json({ 
      status: 'ERROR',
      database: 'disconnected',
      error: e.message
    });
  }
});

// DEBUG ENDPOINT - Force save and check state
app.post('/api/debug/force-save', (req, res) => {
  try {
    console.log('🔧 DEBUG: Force saving state to disk...');
    persistStateToDisk();
    
    const stats = {
      runtimeStateExists: fs.existsSync(runtimeStatePath),
      runtimeStateSize: fs.existsSync(runtimeStatePath) ? fs.statSync(runtimeStatePath).size : 0,
      memoryState: {
        retroNews: state.retroNews?.length || 0,
        scheduled: state.scheduled?.length || 0,
        transactions: state.transactions?.length || 0,
        members: state.members?.length || 0,
        events: state.events?.length || 0,
        flashes: state.flashes?.length || 0,
        bankBalance: state.bankBalance
      },
      savedAt: new Date().toISOString()
    };
    
    console.log('✅ DEBUG: State saved', stats);
    res.json({ ok: true, ...stats });
  } catch (e) {
    console.error('❌ DEBUG: Force save failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// DEBUG ENDPOINT - Check persistence
app.get('/api/debug/check-persistence', async (req, res) => {
  try {
    const prismaNews = await prisma.retroNews.findMany({ take: 5 });
    const prismaOps = await prisma.scheduled_operations.findMany({ take: 5 });
    
    const stats = {
      prisma: {
        retroNews: prismaNews.length,
        scheduledOperations: prismaOps.length
      },
      memory: {
        retroNews: state.retroNews?.length || 0,
        scheduled: state.scheduled?.length || 0
      },
      runtimeState: {
        exists: fs.existsSync(runtimeStatePath),
        size: fs.existsSync(runtimeStatePath) ? fs.statSync(runtimeStatePath).size : 0
      },
      enableRuntimeSave: ENABLE_RUNTIME_STATE_SAVE,
      timestamp: new Date().toISOString()
    };
    
    res.json(stats);
  } catch (e) {
    console.error('❌ DEBUG: Check persistence failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/site-config', (req, res) => {
  res.json({
    siteName: 'RétroBus Essonne',
    siteURL: 'https://association-rbe.fr',
    apiURL: 'https://attractive-kindness-rbe-serveurs.up.railway.app',
    logo: '/assets/logo.png',
    description: 'Association RétroBus Essonne - Patrimoine automobile et mobilité douce'
  });
});

// Public events endpoint
app.get('/public/events', async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { date: 'desc' }
    });
    res.json(events);
  } catch (e) {
    console.error('❌ GET /public/events error:', e.message);
    res.status(500).json({ error: 'Failed to fetch events', details: e.message });
  }
});

app.get('/public/events/:id', async (req, res) => {
  try {
    const event = await prisma.event.findFirst({
      where: { id: req.params.id, status: 'PUBLISHED' }
    });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (e) {
    console.error('❌ GET /public/events/:id error:', e.message);
    res.status(500).json({ error: 'Failed to fetch event', details: e.message });
  }
});

// GET /public/events/active/jep - Vérifier si un événement JEP est actif
app.get('/public/events/active/jep', async (req, res) => {
  try {
    const now = new Date();
    const event = await prisma.event.findFirst({
      where: {
        status: 'PUBLISHED',
        title: {
          contains: 'JEP',
          mode: 'insensitive'
        },
        date: {
          gte: now
        }
      },
      orderBy: { date: 'asc' }
    });
    
    if (!event) {
      return res.json({ active: false });
    }
    
    // Retourner la configuration du mode événement
    res.json({
      active: true,
      eventConfig: {
        enabled: true,
        startDate: event.date,
        endDate: event.date,
        event: {
          id: event.id,
          name: event.title,
          subtitle: event.description || 'Découvrez nos véhicules historiques',
          type: 'EXPO',
          location: event.location || 'Parking Crété, Corbeil-Essonnes',
          color: '#d30c4c',
          actualStartDate: event.date,
          actualEndDate: event.date
        },
        registration: {
          enabled: !!event.helloAssoUrl,
          eventId: event.id
        },
        customContent: {
          showCountdown: true,
          highlights: [
            { icon: '🚌', text: 'Exposition de véhicules' },
            { icon: '📸', text: 'Séances photo' },
            { icon: '🤝', text: 'Rencontre entre passionnés' },
            { icon: '🎪', text: 'Bon moment à partager' }
          ]
        }
      }
    });
  } catch (e) {
    console.error('❌ GET /public/events/active/jep error:', e.message);
    res.status(500).json({ error: 'Failed to check JEP event', details: e.message });
  }
});

// ============================================
// PUBLIC REGISTRATION ENDPOINTS
// ============================================

const CONFIRM_EVENT_TEMPLATE_NAME = 'Confirm Event';
const CONFIRM_EVENT_TEMPLATE_HTML = `<!DOCTYPE html>
<html lang="fr-FR">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmation inscription evenement</title>
</head>
<body style="margin: 0; padding: 0; background-color: transparent; font-family: Montserrat, Arial, sans-serif; color: #101112;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" role="presentation" style="background:#ffffff;">
    <tr>
      <td>
        <table width="900" align="center" border="0" cellspacing="0" cellpadding="0" role="presentation" style="max-width:900px;width:100%;">
          <tr>
            <td style="background:#000000;padding:18px 20px;text-align:center;">
              <img src="https://media.beefree.cloud/pub/bfra/a8fimmr0/jcy/o0f/dn2/RBE%20RACCOURCI%20BLANC.png" alt="RBE" width="90" style="display:block;margin:0 auto 10px auto;border:0;">
              <h2 style="margin:0;color:#ffffff;font-size:34px;line-height:1.4;">Votre inscription est bien arrivee !</h2>
            </td>
          </tr>
          <tr>
            <td style="padding:30px 20px 10px 20px;text-align:center;">
              <p style="margin:0;font-size:34px;font-weight:700;line-height:1.2;">Cher(e) {{participant.name}}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px;">
              <p style="margin:0 0 14px 0;font-size:22px;font-weight:700;line-height:1.35;">Vous venez de vous inscrire a {{event.title}} et nous serons super heureux de vous accueillir !</p>
              <p style="margin:0 0 12px 0;font-size:18px;line-height:1.5;">Ce mail fait office de confirmation d'inscription :</p>
              <table width="100%" border="0" cellspacing="0" cellpadding="0" role="presentation" style="border:1px solid #ededed;border-radius:8px;">
                <tr><td style="padding:14px 16px;font-size:16px;line-height:1.65;">
                  <strong>Evenement :</strong> {{event.title}}<br>
                  <strong>Date :</strong> {{event.date}}<br>
                  <strong>Heure :</strong> {{event.time}}<br>
                  <strong>Lieu :</strong> {{event.location}}<br>
                  <strong>Email inscrit :</strong> {{participant.email}}<br>
                  <strong>Code validation :</strong> {{registration.code}}<br>
                  <strong>Billets adultes :</strong> {{registration.adultTickets}}<br>
                  <strong>Billets enfants :</strong> {{registration.childTickets}}<br>
                  <strong>Total billets :</strong> {{registration.totalTickets}}<br>
                  <strong>Paiement :</strong> {{registration.paymentMethod}}<br>
                  <strong>Statut :</strong> {{registration.status}}
                </td></tr>
              </table>
              <p style="margin:14px 0 0 0;font-size:18px;line-height:1.5;">Nous vous rappelons les elementaires de notre evenement, afin que nous puissions tous passer un tres bon moment.<br><br>A tres vite !<br><br>La Team RBE</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 20px 10px 20px;text-align:center;">
              <h3 style="margin:0;color:#d30c4c;font-size:27px;">Des questions ?</h3>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 20px 30px 20px;text-align:left;">
              <p style="margin:0 0 10px 0;font-size:18px;font-weight:700;line-height:1.4;">Si vous avez renseigne un SMS, vous serez informe petit a petit des informations, mais vous pouvez nous joindre directement !</p>
              <p style="margin:0;text-align:center;font-size:27px;font-weight:700;color:#d30c4c;">association-rbe.fr</p>
              <p style="margin:28px 0 0 0;text-align:center;font-size:14px;line-height:1.6;">Ce mail provient d'une adresse automatique, y repondre ne servira a rien.</p>
            </td>
          </tr>
          <tr>
            <td style="background:#ededed;padding:24px 20px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" role="presentation">
                <tr>
                  <td style="width:30%;vertical-align:top;padding-right:12px;">
                    <img src="https://media.beefree.cloud/pub/bfra/a8fimmr0/1ar/3kw/aej/RBE%20CLASSIQUE.png" alt="RBE Classique" width="190" style="display:block;max-width:100%;height:auto;border:0;">
                  </td>
                  <td style="width:70%;vertical-align:top;font-size:15px;line-height:1.5;font-weight:700;">
                    RNA : W912016571<br>
                    SIRET : 942 506 607 00010<br>
                    SIREN : 942 506 607<br>
                    Siege social : Corbeil-Essonnes, Essonne, France.<br>
                    Collection, preservation et restauration du patrimoine roulant.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

async function ensureConfirmEventTemplateExists() {
  try {
    return await prisma.emailTemplate.upsert({
      where: { name: CONFIRM_EVENT_TEMPLATE_NAME },
      update: {
        category: 'EVENTS',
        active: true,
        description: 'Confirmation automatique d inscription a un evenement (participant + copie association).',
        subject: 'Confirmation inscription - {{event.title}}',
        body: CONFIRM_EVENT_TEMPLATE_HTML,
        variables: JSON.stringify([
          'participant.name',
          'participant.email',
          'event.title',
          'event.date',
          'event.time',
          'event.location',
          'registration.code',
          'registration.adultTickets',
          'registration.childTickets',
          'registration.totalTickets',
          'registration.paymentMethod',
          'registration.status'
        ])
      },
      data: {
        name: CONFIRM_EVENT_TEMPLATE_NAME,
        category: 'EVENTS',
        active: true,
        description: 'Confirmation automatique d inscription a un evenement (participant + copie association).',
        subject: 'Confirmation inscription - {{event.title}}',
        body: CONFIRM_EVENT_TEMPLATE_HTML,
        variables: JSON.stringify([
          'participant.name',
          'participant.email',
          'event.title',
          'event.date',
          'event.time',
          'event.location',
          'registration.code',
          'registration.adultTickets',
          'registration.childTickets',
          'registration.totalTickets',
          'registration.paymentMethod',
          'registration.status'
        ])
      }
    });
  } catch (e) {
    console.error('❌ Error ensuring Confirm Event template:', e.message);
    return null;
  }
}

// POST /registrations - Créer une inscription publique
app.post('/registrations', async (req, res) => {
  try {
    const {
      eventId,
      participantName,
      participantEmail,
      adultTickets = 1,
      childTickets = 0,
      paymentMethod = 'internal',
      vehicleModel,
      vehicleYear,
      vehicleName,
      isClubMember = false,
      clubName,
      // Nouveaux champs pour multi-véhicules et données custom
      vehicles,
      customAnswers
    } = req.body;

    // Validation
    if (!eventId || !participantName || !participantEmail) {
      return res.status(400).json({ error: 'Missing required fields: eventId, participantName, participantEmail' });
    }

    if (adultTickets + childTickets === 0) {
      return res.status(400).json({ error: 'At least one ticket must be selected' });
    }

    // Vérifier que l'événement existe et est publié
    const event = await prisma.event.findFirst({
      where: { id: eventId, status: 'PUBLISHED' }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found or not available for registration' });
    }

    // Vérifier les places disponibles
    const totalTickets = adultTickets + childTickets;
    if (event.maxParticipants && event.currentParticipants + totalTickets > event.maxParticipants) {
      return res.status(409).json({ 
        error: 'Not enough places available',
        details: {
          requested: totalTickets,
          available: Math.max(0, event.maxParticipants - event.currentParticipants),
          total: event.maxParticipants,
          current: event.currentParticipants
        }
      });
    }

    // Parser extras pour vérifier la méthode d'inscription
    let eventExtras = {};
    try {
      eventExtras = event.extras ? JSON.parse(event.extras) : {};
    } catch (e) {
      console.warn('⚠️ Failed to parse event extras:', e.message);
    }

    const allowedMethod = eventExtras.registrationMethod || 'internal';
    
    // Si la méthode demandée n'est pas celle configurée, on ajuste
    const actualPaymentMethod = paymentMethod === 'helloasso' && allowedMethod === 'helloasso'
      ? 'helloasso'
      : (paymentMethod === 'free' || eventExtras.isFree)
        ? 'free'
        : 'internal';

    // Générer un code de validation unique
    const validationCode = `RBE-${Date.now()}-${Math.random().toString(36).slice(2, 9).toUpperCase()}`;

    // Préparer les notes avec toutes les données additionnelles
    const notesData = {};
    
    // Stocker les véhicules multiples si fournis
    if (Array.isArray(vehicles) && vehicles.length > 0) {
      notesData.vehicles = vehicles;
    }
    
    // Stocker les réponses personnalisées
    if (customAnswers) {
      notesData.customAnswers = customAnswers;
    }
    
    const notesString = Object.keys(notesData).length > 0 ? JSON.stringify(notesData) : null;

    // Créer l'enregistrement d'inscription
    const registration = await prisma.registration.create({
      data: {
        eventId,
        participantName,
        participantEmail,
        adultTickets: Math.max(0, adultTickets),
        childTickets: Math.max(0, childTickets),
        paymentMethod: actualPaymentMethod,
        registrationStatus: 'pending',
        validationCode,
        vehicleModel: vehicleModel || (Array.isArray(vehicles) && vehicles[0]?.vehicleModel) || null,
        vehicleYear: vehicleYear || (Array.isArray(vehicles) && vehicles[0]?.vehicleYear) || null,
        vehicleName: vehicleName || (Array.isArray(vehicles) && vehicles[0]?.vehicleName) || null,
        isClubMember,
        clubName,
        notes: notesString
      }
    });

    // Incrémenter le compteur de participants
    await prisma.event.update({
      where: { id: eventId },
      data: { currentParticipants: { increment: totalTickets } }
    });

    console.log('✅ Registration created:', registration.id);

    // Envoi des confirmations email (inscrit + copie association)
    try {
      await ensureConfirmEventTemplateExists();

      const templateData = {
        participant: {
          name: participantName,
          email: String(participantEmail || '').trim().toLowerCase()
        },
        event: {
          title: event.title || 'Evenement RBE',
          date: event.date ? new Date(event.date).toLocaleDateString('fr-FR') : 'A definir',
          time: event.time || 'A definir',
          location: event.location || 'A definir'
        },
        registration: {
          code: validationCode,
          adultTickets: Math.max(0, adultTickets),
          childTickets: Math.max(0, childTickets),
          totalTickets,
          paymentMethod: actualPaymentMethod,
          status: 'pending'
        }
      };

      const recipientEmail = String(participantEmail || '').trim().toLowerCase();

      if (recipientEmail) {
        await sendTemplatedEmail(
          CONFIRM_EVENT_TEMPLATE_NAME,
          recipientEmail,
          templateData,
          'RétroBus Essonne - Evenements'
        );
      }

      await sendTemplatedEmail(
        CONFIRM_EVENT_TEMPLATE_NAME,
        'association.rbe@gmail.com',
        templateData,
        'RétroBus Essonne - Evenements'
      );
    } catch (mailError) {
      console.error('❌ Event registration email error:', mailError.message);
      // Ne pas bloquer l'inscription si l'email échoue
    }

    // Réponse basée sur la méthode de paiement
    const response = {
      registrationId: registration.id,
      validationCode: registration.validationCode,
      status: 'pending',
      paymentMethod: actualPaymentMethod
    };

    // Si HelloAsso, ajouter l'URL HelloAsso depuis les données d'événement
    if (actualPaymentMethod === 'helloasso' && eventExtras.helloAssoUrl) {
      response.helloAssoUrl = eventExtras.helloAssoUrl;
    }

    res.status(201).json(response);
  } catch (e) {
    console.error('❌ POST /registrations error:', e.message);
    res.status(500).json({ error: 'Failed to create registration', details: e.message });
  }
});

// GET /registrations/:id/status - Vérifier le statut d'une inscription
app.get('/registrations/:id/status', async (req, res) => {
  try {
    const registration = await prisma.registration.findUnique({
      where: { id: req.params.id }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    res.json({
      id: registration.id,
      status: registration.registrationStatus,
      ticketSent: registration.ticketSent,
      validationCode: registration.validationCode,
      participantEmail: registration.participantEmail
    });
  } catch (e) {
    console.error('❌ GET /registrations/:id/status error:', e.message);
    res.status(500).json({ error: 'Failed to fetch registration status', details: e.message });
  }
});

// GET /public/events/:id/availability - Vérifier la disponibilité de places
app.get('/public/events/:id/availability', async (req, res) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      select: { maxParticipants: true, currentParticipants: true }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const available = event.maxParticipants 
      ? Math.max(0, event.maxParticipants - event.currentParticipants)
      : null; // null = illimité

    res.json({
      maxParticipants: event.maxParticipants,
      currentParticipants: event.currentParticipants,
      availablePlaces: available,
      isFull: available === 0
    });
  } catch (e) {
    console.error('❌ GET /public/events/:id/availability error:', e.message);
    res.status(500).json({ error: 'Failed to fetch event availability', details: e.message });
  }
});

// Public vehicles endpoint - avec fallback en mémoire

// Normalize vehicle data by extracting caracteristiques from JSON
const normalizeVehicleWithCaracteristiques = (vehicle) => {
  if (!vehicle) return vehicle;
  
  const normalized = { ...vehicle };
  
  // Parse gallery JSON if it exists
  if (vehicle.gallery && typeof vehicle.gallery === 'string') {
    try {
      const gallery = JSON.parse(vehicle.gallery);
      if (Array.isArray(gallery)) {
        normalized.gallery = gallery;
      }
    } catch (e) {
      console.warn('⚠️ Failed to parse gallery for vehicle', vehicle.parc);
      normalized.gallery = [];
    }
  }
  
  // Parse caracteristiques JSON if it exists
  if (vehicle.caracteristiques && typeof vehicle.caracteristiques === 'string') {
    try {
      const caract = JSON.parse(vehicle.caracteristiques);
      if (Array.isArray(caract)) {
        // Create a direct map for frontend compatibility
        const caracMap = {};
        
        // Create mappings for various key formats
        caract.forEach(item => {
          if (item.label && item.value) {
            // Keep original label as key for direct access
            caracMap[item.label] = item.value;
            
            // Also create normalized key for programmatic access
            const key = item.label
              .toLowerCase()
              .replace(/é/g, 'e')
              .replace(/è/g, 'e')
              .replace(/ç/g, 'c')
              .replace(/\s+/g, '_')
              .replace(/[^a-z0-9_]/g, '');
            caracMap[key] = item.value;
            
            // Add to normalized object for direct access
            normalized[key] = item.value;
          }
        });
        
        // Keep as both object and array for compatibility
        normalized.caracteristiques = caract;
        normalized.caracteristiquesMap = caracMap;
      }
    } catch (e) {
      console.warn('⚠️ Failed to parse caracteristiques for vehicle', vehicle.parc);
    }
  }
  
  return normalized;
};

app.get('/public/vehicles', async (req, res) => {
  try {
    const vehicles = await prisma.vehicle.findMany({
      where: { isPublic: true }
    });
    const normalized = vehicles.map(v => normalizeVehicleWithCaracteristiques(v));
    res.json(normalized);
  } catch (e) {
    console.error('❌ GET /public/vehicles error:', e.message);
    res.status(500).json({ error: 'Failed to fetch vehicles', details: e.message });
  }
});

app.get('/public/vehicles/:id', async (req, res) => {
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { 
        isPublic: true,
        OR: [{ id: parseInt(req.params.id) || 0 }, { parc: req.params.id }] 
      }
    });
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    const normalized = normalizeVehicleWithCaracteristiques(vehicle);
    res.json(normalized);
  } catch (e) {
    console.error('❌ GET /public/vehicles/:id error:', e.message);
    res.status(500).json({ error: 'Failed to fetch vehicle', details: e.message });
  }
});

app.get('/public/vehicles/:id/events', async (req, res) => {
  try {
    // Vérifier que le véhicule est public
    const vehicle = await prisma.vehicle.findFirst({
      where: { 
        isPublic: true,
        OR: [{ parc: req.params.id }] 
      }
    });
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found or not public' });

    const events = await prisma.event.findMany({
      where: {
        vehicleId: req.params.id,
        status: 'PUBLISHED'
      },
      orderBy: { date: 'desc' }
    });
    res.json(events);
  } catch (e) {
    console.error('❌ GET /public/vehicles/:id/events error:', e.message);
    res.json([]);
  }
});

// ✅ Endpoint public pour enregistrer un participant après paiement HelloAsso
app.post(['/public/events/:id/join-helloasso', '/api/public/events/:id/join-helloasso'], async (req, res) => {
  try {
    const { email, name, phone } = req.body;
    const eventId = req.params.id;

    // Validation des données minimales
    if (!email || !name) {
      return res.status(400).json({ 
        error: 'Email et nom requis',
        details: 'name and email are required'
      });
    }

    // Vérifier que l'événement existe
    const event = await prisma.event.findUnique({
      where: { id: eventId }
    });

    if (!event) {
      return res.status(404).json({ 
        error: 'Événement non trouvé'
      });
    }

    // Vérifier si le participant existe déjà (éviter les doublons)
    const existingParticipant = await prisma.participant.findFirst({
      where: {
        eventId: eventId,
        email: email.toLowerCase()
      }
    });

    if (existingParticipant) {
      console.log(`ℹ️ Participant déjà inscrit: ${email}`);
      return res.status(200).json({ 
        participant: existingParticipant,
        message: 'Participant déjà inscrit'
      });
    }

    // Créer le participant
    const participant = await prisma.participant.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone ? phone.trim() : null,
        eventId: eventId,
        status: 'REGISTERED',
        paidAmount: 0,
        registrationDate: new Date()
      }
    });

    console.log(`✅ Participant inscrit via HelloAsso: ${participant.email} pour l'événement ${eventId}`);

    // Envoi des confirmations email (inscrit + copie association)
    try {
      await ensureConfirmEventTemplateExists();

      const templateData = {
        participant: {
          name: participant.name,
          email: participant.email || ''
        },
        event: {
          title: event.title || 'Evenement RBE',
          date: event.date ? new Date(event.date).toLocaleDateString('fr-FR') : 'A definir',
          time: event.time || 'A definir',
          location: event.location || 'A definir'
        },
        registration: {
          code: `HELLOASSO-${participant.id}`,
          adultTickets: 1,
          childTickets: 0,
          totalTickets: 1,
          paymentMethod: 'helloasso',
          status: 'confirmed'
        }
      };

      if (participant.email) {
        await sendTemplatedEmail(
          CONFIRM_EVENT_TEMPLATE_NAME,
          participant.email,
          templateData,
          'RétroBus Essonne - Evenements'
        );
      }

      await sendTemplatedEmail(
        CONFIRM_EVENT_TEMPLATE_NAME,
        'association.rbe@gmail.com',
        templateData,
        'RétroBus Essonne - Evenements'
      );
    } catch (mailError) {
      console.error('❌ HelloAsso confirmation email error:', mailError.message);
      // Ne pas bloquer l'inscription si l'email échoue
    }

    res.status(201).json({ 
      participant,
      message: 'Inscription confirmée'
    });
  } catch (e) {
    console.error('❌ POST /public/events/:id/join-helloasso error:', e.message);
    res.status(500).json({ 
      error: 'Erreur lors de l\'inscription',
      details: e.message 
    });
  }
});

// POST /public/contact - Formulaire de contact externe
app.post('/public/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Validation
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ 
        error: 'Tous les champs sont requis (name, email, subject, message)' 
      });
    }

    if (!email.includes('@')) {
      return res.status(400).json({ 
        error: 'Email invalide' 
      });
    }

    console.log('📧 Message de contact reçu:', { name, email, subject });

    // Sauvegarder en base de données pour archivage
    try {
      await prisma.contactMessage.create({
        data: {
          name,
          email,
          subject,
          message,
          ip: req.ip || req.connection.remoteAddress,
          userAgent: req.get('user-agent') || ''
        }
      });
    } catch (dbError) {
      // Table doesn't exist yet, log to memory
      if (!state.contactMessages) {
        state.contactMessages = [];
      }
      state.contactMessages.push({
        id: uid(),
        name,
        email,
        subject,
        message,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent') || '',
        createdAt: new Date().toISOString()
      });
    }

    // Envoyer les emails depuis le compte noreply via les templates
    // Préparer les données pour les templates
    const messageDate = new Date().toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const templateData = {
      sender: {
        name: name,
        email: email,
        ip: req.ip || req.connection.remoteAddress || 'N/A',
        userAgent: req.get('user-agent') || 'N/A'
      },
      subject: subject,
      message: {
        content: message,
        date: messageDate
      }
    };

    // 1. Envoyer notification à l'association (depuis noreply)
    try {
      await sendTemplatedEmail(
        'contact_form_notification',
        'association.rbe@gmail.com',
        templateData,
        'RétroBus Essonne - Contact'
      );
      console.log('✅ Email de notification envoyé à l\'association');
    } catch (emailError) {
      console.error('❌ Erreur envoi email notification:', emailError.message);
      // Continue even if notification fails
    }

    // 2. Envoyer confirmation à l'expéditeur (depuis noreply)
    try {
      await sendTemplatedEmail(
        'mailback_formulaire',
        email,
        templateData,
        'RétroBus Essonne'
      );
      console.log('✅ Email de confirmation envoyé à', email);
    } catch (emailError) {
      console.error('❌ Erreur envoi email confirmation:', emailError.message);
      // Continue even if confirmation fails
    }

    console.log('✅ Message de contact traité avec succès');

    res.status(200).json({ 
      success: true,
      message: 'Message envoyé avec succès. Nous vous répondrons bientôt !',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ POST /public/contact error:', error.message);
    res.status(500).json({ 
      error: 'Erreur lors de l\'envoi du message',
      details: error.message 
    });
  }
});

// ⛔ ENDPOINT DÉPLACÉ - Voir ligne ~1443 pour version avec fallback mémoire
// app.get(['/events','/api/events'], requireAuth, async (req, res) => {
//   try {
//     const events = await prisma.event.findMany({
//       orderBy: { createdAt: 'desc' }
//     });
//     res.json({ events });
//   } catch (e) {
//     console.error('Erreur GET /events (Prisma):', e.message);
//     res.json({ events: [] });
//   }
// });

// ⛔ ENDPOINT DÉPLACÉ - Voir ligne ~1446 pour version avec fallback mémoire
// app.get(['/events/:id','/api/events/:id'], requireAuth, async (req, res) => {
//   try {
//     const event = await prisma.event.findUnique({
//       where: { id: req.params.id }
//     });
//     if (!event) return res.status(404).json({ error: 'Event not found' });
//     res.json({ event });
//   } catch (e) {
//     console.error('Erreur GET /events/:id (Prisma):', e.message);
//     res.status(500).json({ error: 'Database error' });
//   }
// });
// ⛔ FIN ENDPOINT DÉPLACÉ

// FLASHES - PRISMA avec fallback
app.get(['/flashes','/api/flashes'], async (req, res) => {
  try {
    const flashes = await prisma.flash.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(flashes);
  } catch (e) {
    console.error('Erreur GET /flashes (Prisma):', e.message);
    res.json([]);
  }
});

app.get(['/flashes/all','/api/flashes/all'], async (req, res) => {
  try {
    const flashes = await prisma.flash.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(flashes);
  } catch (e) {
    console.error('Erreur GET /flashes/all (Prisma):', e.message);
    res.json([]);
  }
});

app.post(['/flashes','/api/flashes'], requireAuth, async (req, res) => {
  try {
    const { title, message, content, active = false } = req.body || {};
    const flash = await prisma.flash.create({
      data: { 
        id: uid(),
        content: content || message || title || '',  // Support content, message, ou title
        active: !!active,
        type: 'info',
        createdBy: req.user?.name || req.user?.email || 'Anonymous',
        updatedAt: new Date()
      }
    });
    console.log('✅ Flash créé:', flash.id);
    res.status(201).json(flash);
  } catch (e) {
    console.error('❌ Erreur POST /flashes (Prisma):', e.message);
    // Fallback en mémoire
    const flash = {
      id: 'f' + Date.now(),
      title: req.body?.title || 'Flash',
      message: req.body?.message || '',
      content: req.body?.content || req.body?.message || req.body?.title || '',
      active: req.body?.active || false,
      createdBy: req.user?.name || req.user?.email || 'Anonymous',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    state.flashes = state.flashes || [];
    state.flashes.push(flash);
    debouncedSave();
    res.status(201).json(flash);
  }
});

app.put(['/flashes/:id','/api/flashes/:id'], requireAuth, async (req, res) => {
  try {
    const { title, message, content, active } = req.body;
    const flash = await prisma.flash.update({
      where: { id: req.params.id },
      data: { 
        content: content || message || title,
        active: active !== undefined ? !!active : undefined,
        updatedAt: new Date()
      }
    });
    console.log('✅ Flash modifié:', flash.id);
    res.json(flash);
  } catch (e) {
    console.error('❌ Erreur PUT /flashes/:id (Prisma):', e.message);
    // Fallback en mémoire
    const idx = (state.flashes || []).findIndex(f => f.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Flash not found' });
    }
    state.flashes[idx] = {
      ...state.flashes[idx],
      title: req.body?.title || state.flashes[idx].title,
      message: req.body?.message || state.flashes[idx].message,
      content: req.body?.content || req.body?.message || state.flashes[idx].content,
      active: req.body?.active !== undefined ? req.body.active : state.flashes[idx].active,
      updatedAt: new Date().toISOString()
    };
    debouncedSave();
    res.json(state.flashes[idx]);
  }
});

app.delete(['/flashes/:id','/api/flashes/:id'], requireAuth, async (req, res) => {
  try {
    await prisma.flash.delete({
      where: { id: req.params.id }
    });
    console.log('✅ Flash supprimé:', req.params.id);
    res.json({ ok: true });
  } catch (e) {
    console.error('Erreur DELETE /flashes/:id (Prisma):', e.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// RETRO NEWS - PRISMA avec fallback
// ⛔ ENDPOINT DÉPLACÉ avec fallback mémoire (voir ligne ~1410)
// app.get(['/api/retro-news','/retro-news'], async (req, res) => {
//   try {
//     const news = await prisma.retroNews.findMany({
//       orderBy: { createdAt: 'desc' }
//     });
//     res.json({ news });
//   } catch (e) {
//     console.error('Erreur GET /retro-news (Prisma):', e.message);
//     res.json({ news: state.retroNews || [] });
//   }
// });

// ⛔ ENDPOINT DÉPLACÉ avec fallback mémoire
// app.post(['/api/retro-news','/retro-news'], requireAuth, async (req, res) => {
//   try {
//     const news = await prisma.retroNews.create({
//       data: {
//         title: req.body?.title || 'News',
//         body: req.body?.body || '',
//         status: 'published',
//         publishedAt: new Date()
//       }
//     });
//     console.log('✅ RetroNews créé:', news.id);
//     res.status(201).json({ news });
//   } catch (e) {
//     console.error('Erreur POST /retro-news (Prisma):', e.message);
//     // Fallback: créer en mémoire
//     const item = { id: 'rn' + Date.now(), title: req.body?.title || 'News', body: req.body?.body || '', publishedAt: new Date().toISOString() };
//     state.retroNews.unshift(item);
//     res.status(201).json({ news: item });
//   }
// });
// ⛔ FIN ENDPOINT DÉPLACÉ

// NOTIFICATIONS - Maintenant gérées via routes modulaires avec Prisma
// Les endpoints sont enregistrés ci-dessus: app.use('/api/notifications', notificationsRoutes)

// ===== HOME ANNOUNCEMENTS - Annonces d'accueil persistées =====

// GET /api/home-announcements - Récupérer les annonces actives
app.get('/api/home-announcements', async (req, res) => {
  try {
    const now = new Date();
    const announcements = await prisma.homeAnnouncement.findMany({
      where: {
        active: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(announcements);
  } catch (error) {
    console.error('❌ Erreur GET /api/home-announcements:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération des annonces' });
  }
});

// POST /api/home-announcements - Créer une nouvelle annonce (admin seulement)
app.post('/api/home-announcements', requireAuth, async (req, res) => {
  try {
    const { severity, title, message, dismissible, expiresAt, actions } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Le message est requis' });
    }

    const announcement = await prisma.homeAnnouncement.create({
      data: {
        severity: severity || 'INFO',
        title,
        message,
        dismissible: dismissible !== false,
        expiresAt: expiresAt ? new Date(expiresAt) : new Date(Date.now() + 24 * 60 * 60 * 1000),
        actions: actions || null,
        active: true,
        createdBy: req.user?.urbex_id || null
      }
    });

    console.log('✅ Annonce créée:', announcement.id);
    res.status(201).json(announcement);
  } catch (error) {
    console.error('❌ Erreur POST /api/home-announcements:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la création de l\'annonce' });
  }
});

// DELETE /api/home-announcements/:id - Supprimer une annonce (admin seulement)
app.delete('/api/home-announcements/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier si l'annonce existe
    const existing = await prisma.homeAnnouncement.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Annonce non trouvée' });
    }

    await prisma.homeAnnouncement.delete({
      where: { id }
    });

    console.log('✅ Annonce supprimée:', id);
    res.json({ success: true, message: 'Annonce supprimée avec succès' });
  } catch (error) {
    console.error('❌ Erreur DELETE /api/home-announcements/:id:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la suppression de l\'annonce' });
  }
});

// PATCH /api/home-announcements/:id - Mettre à jour une annonce (admin seulement)
app.patch('/api/home-announcements/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { severity, title, message, dismissible, expiresAt, actions, active } = req.body;

    const updated = await prisma.homeAnnouncement.update({
      where: { id },
      data: {
        ...(severity !== undefined && { severity }),
        ...(title !== undefined && { title }),
        ...(message !== undefined && { message }),
        ...(dismissible !== undefined && { dismissible }),
        ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
        ...(actions !== undefined && { actions }),
        ...(active !== undefined && { active })
      }
    });

    console.log('✅ Annonce mise à jour:', id);
    res.json(updated);
  } catch (error) {
    console.error('❌ Erreur PATCH /api/home-announcements/:id:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la mise à jour de l\'annonce' });
  }
});

// ===== RETROMAIL (stub endpoints) =====
app.get(['/retromail/list'], requireAuth, (req, res) => {
  // Retourne une liste vide de fiches retromail
  res.json([]);
});

app.get(['/retromail/:filename'], requireAuth, (req, res) => {
  // Retourne une fiche retromail vide
  res.json({
    id: req.params.filename,
    parc: 'N/A',
    description: 'Fiche non trouvée',
    createdAt: new Date().toISOString()
  });
});

app.get(['/retromail/:filename.pdf'], requireAuth, (req, res) => {
  // Retourne un PDF vide
  res.setHeader('Content-Type', 'application/pdf');
  res.send(Buffer.from('%PDF-1.4\n', 'utf8'));
});

// VEHICLES - PRISMA avec fallback// ⛔ ENDPOINT DÉPLACÉ avec fallback mémoire (voir ligne ~1390)
// app.get(['/vehicles','/api/vehicles'], requireAuth, async (req, res) => {
//   try {
//     const vehicles = await prisma.vehicle.findMany();
//     res.json({ vehicles });
//   } catch (e) {
//     console.error('Erreur GET /vehicles (Prisma):', e.message);
//     res.json({ vehicles: [] });
//   }
// });

// ⛔ ENDPOINT DÉPLACÉ avec fallback mémoire
// app.get(['/vehicles/:parc','/api/vehicles/:parc'], requireAuth, async (req, res) => {
//   try {
//     const vehicle = await prisma.vehicle.findUnique({
//       where: { parc: req.params.parc }
//     });
//     if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
//     res.json({ vehicle });
//   } catch (e) {
//     console.error('Erreur GET /vehicles/:parc (Prisma):', e.message);
//     res.status(500).json({ error: 'Database error' });
//   }
// });
// ⛔ FIN ENDPOINTS DÉPLACÉS

app.put(['/vehicles/:parc','/api/vehicles/:parc'], requireAuth, async (req, res) => {
  try {
    const prismaData = buildPrismaVehicleUpdateData(req.body || {});
    
    if (Object.keys(prismaData).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const vehicle = await prisma.vehicle.update({
      where: { parc: req.params.parc },
      data: prismaData
    });
    
    console.log('✅ Vehicle updated via Prisma:', vehicle.parc);
    res.json({ vehicle, source: 'prisma' });
  } catch (e) {
    console.error('❌ PUT /vehicles/:parc error:', e.message);
    if (e?.code === 'P2025') {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    res.status(500).json({ error: 'Failed to update vehicle', details: e.message });
  }
});

app.get(['/vehicles/:parc/lifecycle-events','/api/vehicles/:parc/lifecycle-events'], requireAuth, async (req, res) => {
  try {
    await ensureVehicleLifecycleTable();
    const events = await prisma.$queryRaw`
      SELECT * FROM "VehicleLifecycleEvent"
      WHERE "vehicleParc" = ${req.params.parc}
      ORDER BY "createdAt" DESC
    `;
    res.json({ events });
  } catch (e) {
    console.error('❌ GET /vehicles/:parc/lifecycle-events error:', e.message);
    res.status(500).json({ error: 'Failed to fetch lifecycle events', details: e.message });
  }
});

app.post(['/vehicles/:parc/lifecycle-events','/api/vehicles/:parc/lifecycle-events'], requireAuth, async (req, res) => {
  try {
    await ensureVehicleLifecycleTable();
    const vehicle = await prisma.vehicle.findUnique({ where: { parc: req.params.parc } });
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

    const eventType = ['incident', 'reforme'].includes(req.body?.eventType) ? req.body.eventType : 'incident';
    const severity = ['mineure', 'majeure', 'critique'].includes(req.body?.severity) ? req.body.severity : null;
    const title = String(req.body?.title || '').trim();
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const description = req.body?.description ? String(req.body.description).trim() : null;
    const decision = req.body?.decision ? String(req.body.decision).trim() : null;
    const immobilizing = Boolean(req.body?.immobilizing || eventType === 'reforme');
    const reformReason = eventType === 'reforme' && req.body?.reformReason ? String(req.body.reformReason).trim() : null;
    const reformDate = eventType === 'reforme' && req.body?.reformDate ? new Date(req.body.reformDate) : null;
    const decidedBy = req.body?.decidedBy ? String(req.body.decidedBy).trim() : null;
    const createdBy = req.user?.email || req.user?.username || req.user?.id || null;

    const rows = await prisma.$queryRaw`
      INSERT INTO "VehicleLifecycleEvent" (
        "vehicleParc", "eventType", "severity", "title", "description", "decision",
        "immobilizing", "reformReason", "reformDate", "decidedBy", "createdBy", "updatedAt"
      ) VALUES (
        ${req.params.parc}, ${eventType}, ${severity}, ${title}, ${description}, ${decision},
        ${immobilizing}, ${reformReason}, ${reformDate}, ${decidedBy}, ${createdBy}, CURRENT_TIMESTAMP
      )
      RETURNING *
    `;

    const vehicleUpdate = nextLifecycleVehicleState(eventType, severity, immobilizing);
    const updatedVehicle = Object.keys(vehicleUpdate).length > 0
      ? await prisma.vehicle.update({ where: { parc: req.params.parc }, data: vehicleUpdate })
      : vehicle;

    res.status(201).json({ event: rows[0], vehicle: updatedVehicle });
  } catch (e) {
    console.error('❌ POST /vehicles/:parc/lifecycle-events error:', e.message);
    res.status(500).json({ error: 'Failed to create lifecycle event', details: e.message });
  }
});

// Usages (historique pointages) - PRISMA avec fallback
app.get(['/vehicles/:parc/usages','/api/vehicles/:parc/usages'], requireAuth, async (req, res) => {
  try {
    const usages = await prisma.Usage.findMany({
      where: { parc: req.params.parc },
      orderBy: { startedAt: 'desc' }
    });
    res.json(usages);
  } catch (e) {
    console.error('Erreur GET usages (Prisma):', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post(['/vehicles/:parc/usages','/api/vehicles/:parc/usages'], requireAuth, async (req, res) => {
  try {
    const { startedAt, initiateur, participants, note, ...extra } = req.body;
    
    // Construire les métadonnées
    const metadata = {
      initiateur: initiateur || null,
      participants: participants || null,
      rawNote: note || '',
      extra
    };
    
    const usage = await prisma.Usage.create({
      data: {
        parc: req.params.parc,
        startedAt: startedAt ? new Date(startedAt) : new Date(),
        conducteur: initiateur ? `${initiateur.prenom || ''} ${initiateur.nom || ''}`.trim() : 'Conducteur',
        participants: participants || null,
        note: JSON.stringify(metadata)
      }
    });
    console.log('✅ Usage créé:', usage.id);
    res.status(201).json(usage);
  } catch (e) {
    console.error('Erreur POST usages (Prisma):', e.message);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post(['/vehicles/:parc/usages/:id/end','/api/vehicles/:parc/usages/:id/end'], requireAuth, async (req, res) => {
  try {
    const { endedAt, participants, note, ...extra } = req.body;
    
    // Construire les métadonnées
    const metadata = {
      participants: participants || null,
      rawNote: note || '',
      extra
    };
    
    const usage = await prisma.Usage.update({
      where: { id: parseInt(req.params.id) },
      data: { 
        endedAt: endedAt ? new Date(endedAt) : new Date(),
        participants: participants || undefined,
        note: note ? JSON.stringify(metadata) : undefined
      }
    });
    res.json(usage);
  } catch (e) {
    console.error('Erreur end usage (Prisma):', e.message);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get(['/mobile/vehicles/:parc','/api/mobile/vehicles/:parc'], requireMobileVehicleAccess, async (req, res) => {
  try {
    const idCandidate = Number(req.params.parc);
    const filters = [{ parc: req.params.parc }];
    if (!Number.isNaN(idCandidate)) filters.push({ id: idCandidate });
    const vehicle = await prisma.vehicle.findFirst({ where: { OR: filters } });
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    res.json(normalizeVehicleWithCaracteristiques(vehicle));
  } catch (e) {
    console.error('❌ GET /mobile/vehicles/:parc error:', e.message);
    res.status(500).json({ error: 'Failed to fetch mobile vehicle', details: e.message });
  }
});

app.get(['/mobile/vehicles/:parc/usages','/api/mobile/vehicles/:parc/usages'], requireMobileVehicleAccess, async (req, res) => {
  try {
    const usages = await prisma.Usage.findMany({
      where: { parc: req.params.parc },
      orderBy: { startedAt: 'desc' }
    });
    res.json(usages);
  } catch (e) {
    console.error('❌ GET /mobile/vehicles/:parc/usages error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post(['/mobile/vehicles/:parc/usages','/api/mobile/vehicles/:parc/usages'], requireMobileVehicleAccess, async (req, res) => {
  try {
    const { startedAt, initiateur, participants, note, ...extra } = req.body;
    const mobileUserName = req.mobileUser ? `${req.mobileUser.firstName || ''} ${req.mobileUser.lastName || ''}`.trim() : '';
    const metadata = {
      initiateur: initiateur || null,
      participants: participants || null,
      rawNote: note || '',
      extra
    };

    const usage = await prisma.Usage.create({
      data: {
        parc: req.params.parc,
        startedAt: startedAt ? new Date(startedAt) : new Date(),
        conducteur: initiateur ? `${initiateur.prenom || ''} ${initiateur.nom || ''}`.trim() : (mobileUserName || 'Conducteur'),
        participants: participants || null,
        note: JSON.stringify(metadata)
      }
    });
    res.status(201).json(usage);
  } catch (e) {
    console.error('❌ POST /mobile/vehicles/:parc/usages error:', e.message);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post(['/mobile/vehicles/:parc/usages/:id/end','/api/mobile/vehicles/:parc/usages/:id/end'], requireMobileVehicleAccess, async (req, res) => {
  try {
    const { endedAt, participants, note, ...extra } = req.body;
    const metadata = {
      participants: participants || null,
      rawNote: note || '',
      extra
    };

    const usage = await prisma.Usage.update({
      where: { id: parseInt(req.params.id) },
      data: {
        endedAt: endedAt ? new Date(endedAt) : new Date(),
        participants: participants || undefined,
        note: note ? JSON.stringify(metadata) : undefined
      }
    });
    res.json(usage);
  } catch (e) {
    console.error('❌ POST /mobile/vehicles/:parc/usages/:id/end error:', e.message);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get(['/mobile/vehicles/:parc/reports','/api/mobile/vehicles/:parc/reports'], requireMobileVehicleAccess, async (req, res) => {
  try {
    const reports = await prisma.Report.findMany({
      where: { parc: req.params.parc },
      orderBy: { createdAt: 'desc' }
    });
    res.json(reports);
  } catch (e) {
    console.error('❌ GET /mobile/vehicles/:parc/reports error:', e.message);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

app.post(['/mobile/vehicles/:parc/reports','/api/mobile/vehicles/:parc/reports'], requireMobileVehicleAccess, async (req, res) => {
  try {
    const { description, usageId, filesMeta } = req.body || {};
    const report = await prisma.Report.create({
      data: {
        parc: req.params.parc,
        usageId: usageId ? Number(usageId) : null,
        description: description || null,
        filesMeta: filesMeta ? JSON.stringify(filesMeta) : null,
        updatedAt: new Date()
      }
    });
    res.status(201).json(report);
  } catch (e) {
    console.error('❌ POST /mobile/vehicles/:parc/reports error:', e.message);
    res.status(500).json({ error: 'Failed to create report' });
  }
});

// Maintenance - PRISMA avec fallback
app.get(['/vehicles/:parc/maintenance','/api/vehicles/:parc/maintenance'], requireAuth, async (req, res) => {
  try {
    const maintenance = await prisma.vehicle_maintenance.findMany({
      where: { Vehicle: { parc: req.params.parc } },
      orderBy: { date: 'desc' }
    });
    res.json(maintenance);
  } catch (e) {
    console.error('Erreur GET maintenance (Prisma):', e.message);
    res.json([]);
  }
});

app.post(['/vehicles/:parc/maintenance','/api/vehicles/:parc/maintenance'], requireAuth, async (req, res) => {
  try {
    console.log('📝 POST /vehicles/:parc/maintenance - Body:', JSON.stringify(req.body, null, 2));
    
    // Get vehicle by parc code
    const vehicle = await prisma.vehicle.findUnique({ where: { parc: req.params.parc } });
    if (!vehicle) {
      console.error('❌ Vehicle not found for parc:', req.params.parc);
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    
    console.log('✅ Vehicle found:', vehicle.id, vehicle.parc);
    
    const item = await prisma.vehicle_maintenance.create({
      data: {
        id: Math.random().toString(36).substr(2, 9),
        vehicleId: vehicle.id,
        type: req.body?.type || 'other',
        description: req.body?.description || '',
        cost: req.body?.cost ? parseFloat(req.body.cost) : 0,
        status: req.body?.status || 'completed',
        date: req.body?.date ? new Date(req.body.date) : new Date(),
        updatedAt: new Date()
      }
    });
    console.log('✅ Maintenance créée:', item.id);
    res.status(201).json(item);
  } catch (e) {
    console.error('❌ Erreur POST maintenance (Prisma):', e.message);
    console.error('Stack:', e.stack);
    res.status(500).json({ error: 'Database error', details: e.message });
  }
});

// Service schedule - PRISMA avec fallback
app.get(['/vehicles/:parc/service-schedule','/api/vehicles/:parc/service-schedule'], requireAuth, async (req, res) => {
  try {
    // Get vehicle by parc code
    const vehicle = await prisma.vehicle.findUnique({ where: { parc: req.params.parc } });
    if (!vehicle) return res.json([]);
    
    const schedule = await prisma.vehicle_service_schedule.findMany({
      where: { vehicleId: vehicle.id },
      orderBy: { plannedDate: 'asc' }
    });
    res.json(schedule);
  } catch (e) {
    console.error('Erreur GET service-schedule (Prisma):', e.message);
    res.json([]);
  }
});

app.post(['/vehicles/:parc/service-schedule','/api/vehicles/:parc/service-schedule'], requireAuth, async (req, res) => {
  try {
    // Get vehicle by parc code
    const vehicle = await prisma.vehicle.findUnique({ where: { parc: req.params.parc } });
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    
    const item = await prisma.vehicle_service_schedule.create({
      data: {
        id: Math.random().toString(36).substr(2, 9),
        vehicleId: vehicle.id,
        serviceType: req.body?.serviceType || 'other',
        description: req.body?.description || '',
        frequency: req.body?.frequency || 'yearly',
        priority: req.body?.priority || 'medium',
        status: req.body?.status || 'pending',
        plannedDate: req.body?.plannedDate ? new Date(req.body.plannedDate) : new Date()
      }
    });
    console.log('✅ Service schedule créé:', item.id);
    res.status(201).json(item);
  } catch (e) {
    console.error('Erreur POST service-schedule (Prisma):', e.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// Maintenance summary - PRISMA avec fallback
app.get(['/vehicles/:parc/maintenance-summary','/api/vehicles/:parc/maintenance-summary'], requireAuth, async (req, res) => {
  try {
    const parc = req.params.parc;
    // Get vehicle by parc code
    const vehicle = await prisma.vehicle.findUnique({ where: { parc } });
    if (!vehicle) return res.json({ totalCost: 0, maintenanceCount: 0, overdueTasks: 0, pendingTasks: 0 });
    
    const maintenance = await prisma.vehicle_maintenance.findMany({ where: { vehicleId: vehicle.id } });
    const schedule = await prisma.vehicle_service_schedule.findMany({ where: { vehicleId: vehicle.id } });
    
    const totalCost = maintenance.reduce((s, m) => s + (m.cost || 0), 0);
    const maintenanceCount = maintenance.length;
    const overdueTasks = schedule.filter(s => s.status === 'overdue').length;
    const pendingTasks = schedule.filter(s => s.status === 'pending').length;
    
    res.json({ totalCost, maintenanceCount, overdueTasks, pendingTasks });
  } catch (e) {
    console.error('Erreur maintenance-summary (Prisma):', e.message);
    res.json({ totalCost: 0, maintenanceCount: 0, overdueTasks: 0, pendingTasks: 0 });
  }
});

// Gallery (upload + delete)
const galleryStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const parc = String(req.params.parc || 'unknown');
      const dirPath = path.join(pathRoot, 'uploads', 'vehicles', parc, 'gallery');
      ensureDirectoryExists(dirPath);
      cb(null, dirPath);
    } catch (e) {
      cb(e);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${uid()}${ext}`);
  }
});

const galleryUpload = multer({
  storage: galleryStorage,
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 12
  }
});

const parseGalleryValue = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

app.get(['/vehicles/:parc/gallery','/api/vehicles/:parc/gallery'], requireAuth, async (req, res) => {
  try {
    const parc = String(req.params.parc);
    const idCandidate = Number(parc);
    const filters = [{ parc }];
    if (!Number.isNaN(idCandidate)) filters.push({ id: idCandidate });
    const vehicle = await prisma.vehicle.findFirst({ where: { OR: filters } });
    if (!vehicle) {
      console.warn(`⚠️  Vehicle not found for gallery GET: ${parc}`);
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    const gallery = parseGalleryValue(vehicle.gallery);
    console.log(`📸 GET gallery for ${parc}: ${gallery.length} images`);
    res.json({ gallery });
  } catch (e) {
    console.error('❌ GET /vehicles/:parc/gallery error:', e.message);
    res.status(500).json({ error: 'Failed to fetch gallery', details: e.message });
  }
});

app.post(['/vehicles/:parc/gallery','/api/vehicles/:parc/gallery'], requireAuth, async (req, res) => {
  try {
    const parc = String(req.params.parc);
    console.log(`\n📸 [DEBUG] POST /vehicles/:parc/gallery started for parc: ${parc}`);
    
    // Accept BASE64 images from body (not Multer files anymore)
    const { images } = req.body || {};
    console.log(`📸 [DEBUG] Images received: ${Array.isArray(images) ? images.length : 0}`);
    
    if (!Array.isArray(images) || images.length === 0) {
      console.log(`❌ [DEBUG] No images in request body (expected: { images: [...BASE64] })`);
      return res.status(400).json({ error: 'No images provided (expected: { images: [...BASE64] })' });
    }
    
    console.log(`📸 [DEBUG] Images details:`, images.map((img, i) => ({ 
      index: i,
      type: typeof img,
      length: img?.length || 0,
      preview: String(img).substring(0, 50) 
    })));
    
    const idCandidate = Number(parc);
    const filters = [{ parc }];
    if (!Number.isNaN(idCandidate)) filters.push({ id: idCandidate });
    
    console.log(`📸 [DEBUG] Searching for vehicle with filters:`, filters);
    
    const existing = await prisma.vehicle.findFirst({ where: { OR: filters } });
    if (!existing) {
      console.error(`❌ [DEBUG] Vehicle not found: ${parc}`);
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    console.log(`✅ [DEBUG] Vehicle found: id=${existing.id}, parc=${existing.parc}`);

    const baseGallery = parseGalleryValue(existing.gallery);
    console.log(`📸 [DEBUG] Existing gallery items: ${baseGallery.length}`);
    
    // Add BASE64 images directly (no file storage)
    const newItems = images.map((img, i) => {
      console.log(`  📸 [DEBUG] Adding image ${i+1}/${images.length}: ${img.substring(0, 50)}...`);
      return img; // Store BASE64 directly
    });
    const nextGallery = [...baseGallery, ...newItems];

    console.log(`📸 [DEBUG] Total gallery after update: ${nextGallery.length} items`);

    // Stringify and check size
    let galleryJson;
    try {
      galleryJson = JSON.stringify(nextGallery);
      console.log(`📸 [DEBUG] Gallery JSON size: ${(galleryJson.length / 1024 / 1024).toFixed(2)} MB`);
      
      // Warning if too large (PostgreSQL TEXT limit is ~1GB but performance degrades)
      if (galleryJson.length > 10 * 1024 * 1024) { // 10MB
        console.warn(`⚠️ [DEBUG] Gallery JSON is very large: ${(galleryJson.length / 1024 / 1024).toFixed(2)} MB`);
      }
    } catch (stringifyError) {
      console.error(`❌ [DEBUG] Failed to stringify gallery:`, stringifyError);
      return res.status(500).json({ 
        error: 'Failed to serialize gallery data', 
        details: stringifyError.message 
      });
    }

    // Update in database
    let updated;
    try {
      updated = await prisma.vehicle.update({
        where: { id: existing.id },
        data: {
          gallery: galleryJson,
          updatedAt: new Date()
        }
      });
      console.log(`✅ [DEBUG] Prisma update successful for vehicle ${existing.id}`);
    } catch (prismaError) {
      console.error(`❌ [DEBUG] Prisma update failed:`, prismaError);
      return res.status(500).json({ 
        error: 'Database update failed', 
        details: prismaError.message 
      });
    }

    // Keep in-memory mirror in sync
    try {
      const stateIdx = state.vehicles.findIndex(v => v.id === existing.id);
      if (stateIdx !== -1) {
        state.vehicles[stateIdx] = { ...state.vehicles[stateIdx], gallery: galleryJson, updatedAt: new Date() };
        debouncedSave();
      }
      console.log(`✅ [DEBUG] In-memory state updated`);
    } catch (stateError) {
      console.warn(`⚠️ [DEBUG] Failed to update in-memory state:`, stateError);
      // Non-critical, continue
    }

    console.log(`✅ Gallery images added for ${parc}. Total: ${nextGallery.length}`);
    res.json({ gallery: nextGallery });
  } catch (e) {
    console.error('❌ POST /vehicles/:parc/gallery error:', e);
    console.error('❌ Error stack:', e.stack);
    res.status(500).json({ error: 'Failed to upload images', details: e.message });
  }
});

app.delete(['/vehicles/:parc/gallery','/api/vehicles/:parc/gallery'], requireAuth, async (req, res) => {
  try {
    const parc = String(req.params.parc);
    const { image } = req.body || {};
    if (!image) return res.status(400).json({ error: 'Missing image' });

    console.log(`🗑️  Deleting gallery image for ${parc}: ${image}`);

    const idCandidate = Number(parc);
    const filters = [{ parc }];
    if (!Number.isNaN(idCandidate)) filters.push({ id: idCandidate });
    const existing = await prisma.vehicle.findFirst({ where: { OR: filters } });
    if (!existing) return res.status(404).json({ error: 'Vehicle not found' });

    const baseGallery = parseGalleryValue(existing.gallery);
    const nextGallery = baseGallery.filter((p) => p !== image);

    await prisma.vehicle.update({
      where: { id: existing.id },
      data: {
        gallery: JSON.stringify(nextGallery),
        updatedAt: new Date()
      }
    });

    // Best-effort delete local file if under /uploads
    try {
      if (typeof image === 'string' && image.startsWith('/uploads/')) {
        const rel = image.replace(/^\/uploads\//, '');
        const diskPath = path.join(pathRoot, 'uploads', rel);
        if (fs.existsSync(diskPath)) fs.unlinkSync(diskPath);
      }
    } catch {}

    const stateIdx = state.vehicles.findIndex(v => v.id === existing.id);
    if (stateIdx !== -1) {
      state.vehicles[stateIdx] = { ...state.vehicles[stateIdx], gallery: JSON.stringify(nextGallery), updatedAt: new Date() };
      debouncedSave();
    }

    console.log(`✅ Gallery image deleted for ${parc}. Remaining: ${nextGallery.length}`);
    res.json({ gallery: nextGallery });
  } catch (e) {
    console.error('❌ DELETE /vehicles/:parc/gallery error:', e.message);
    res.status(500).json({ error: 'Failed to delete image', details: e.message });
  }
});

app.get(['/vehicles/:parc/background','/api/vehicles/:parc/background'], requireAuth, (req, res) => {
  console.log(`🔍 GET /vehicles/:parc/background for ${req.params.parc}`);
  res.json({ background: null });
});

// POST endpoint for background image (accepts BASE64 or FormData)
app.post(['/vehicles/:parc/background','/api/vehicles/:parc/background'], requireAuth, async (req, res) => {
  try {
    const parc = String(req.params.parc);
    console.log(`\n📸 [DEBUG] POST /vehicles/:parc/background started for parc: ${parc}`);
    console.log(`📸 [DEBUG] Content-Type: ${req.headers['content-type']}`);
    console.log(`📸 [DEBUG] Body type: ${typeof req.body}, keys: ${Object.keys(req.body || {}).join(',')}`);
    
    // Try to get image from body (BASE64) or files
    let imageData = null;
    
    // Check if multipart with file
    if (req.file) {
      console.log(`📸 [DEBUG] Found file: ${req.file.filename}, size: ${req.file.size}`);
      imageData = `/uploads/vehicles/${parc}/background/${req.file.filename}`;
    } else if (req.body?.image) {
      // Expecting data URI or base64
      console.log(`📸 [DEBUG] Found image in body, length: ${String(req.body.image).length}`);
      imageData = req.body.image;
    } else if (req.body?.backgroundImage) {
      console.log(`📸 [DEBUG] Found backgroundImage in body, type: ${typeof req.body.backgroundImage}, length: ${String(req.body.backgroundImage).length}`);
      imageData = req.body.backgroundImage;
    }
    
    if (!imageData) {
      console.log(`❌ [DEBUG] No image data found in request`);
      return res.status(400).json({ 
        error: 'No image provided',
        debug: { body_type: typeof req.body, body_keys: Object.keys(req.body || {}), has_file: !!req.file }
      });
    }
    
    console.log(`✅ [DEBUG] Image data received, starting update for parc: ${parc}`);
    
    // Find vehicle
    const idCandidate = Number(parc);
    const filters = [{ parc }];
    if (!Number.isNaN(idCandidate)) filters.push({ id: idCandidate });
    
    const existing = await prisma.vehicle.findFirst({ where: { OR: filters } });
    if (!existing) {
      console.log(`❌ [DEBUG] Vehicle not found for parc: ${parc}`);
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    
    console.log(`✅ [DEBUG] Vehicle found: ${existing.parc}, updating backgroundImage`);
    
    // Update vehicle with background image
    const updated = await prisma.vehicle.update({
      where: { id: existing.id },
      data: {
        backgroundImage: imageData,
        updatedAt: new Date()
      }
    });
    
    console.log(`✅ [DEBUG] Vehicle updated successfully for ${parc}`);
    console.log(`✅ [DEBUG] backgroundImage: ${String(imageData).substring(0, 100)}...`);
    
    res.status(200).json({ 
      backgroundImage: imageData,
      success: true,
      debug: { vehicle_parc: existing.parc, image_length: String(imageData).length }
    });
  } catch (e) {
    console.error(`❌ [DEBUG] POST /vehicles/:parc/background error:`, e);
    console.error(`❌ [DEBUG] Stack:`, e.stack);
    res.status(500).json({ 
      error: 'Failed to upload background image', 
      details: e.message,
      debug: { error_type: e.constructor.name }
    });
  }
});

app.get(['/vehicles/:parc/reports','/api/vehicles/:parc/reports'], requireAuth, (req, res) => {
  res.json({ reports: [] });
});

// ============ ADMINISTRATION VÉHICULES ============

// CARTES GRISES
app.get(['/vehicles/:parc/cg','/api/vehicles/:parc/cg'], requireAuth, (req, res) => {
  const parc = req.params.parc;
  const cg = state.vehicleCarteGrise.find(c => c.parc === parc);
  res.json(cg || { parc, oldCGPath: null, newCGPath: null, oldCGBarred: false, dateImport: null, notes: '' });
});

app.post(['/vehicles/:parc/cg','/api/vehicles/:parc/cg'], requireAuth, (req, res) => {
  const parc = req.params.parc;
  const { type, documentPath, notes } = req.body; // type: 'old' | 'new'
  let cg = state.vehicleCarteGrise.find(c => c.parc === parc);
  
  if (!cg) {
    cg = { id: uid(), parc, oldCGPath: null, newCGPath: null, oldCGBarred: false, dateImport: new Date().toISOString(), notes: notes || '' };
    state.vehicleCarteGrise.push(cg);
  }
  
  if (type === 'old') {
    cg.oldCGPath = documentPath;
  } else if (type === 'new') {
    cg.newCGPath = documentPath;
    cg.dateImport = new Date().toISOString();
  }
  
  cg.notes = notes || cg.notes;
  debouncedSave();
  res.json(cg);
});

app.put(['/vehicles/:parc/cg/mark-old-barred','/api/vehicles/:parc/cg/mark-old-barred'], requireAuth, (req, res) => {
  const parc = req.params.parc;
  const cg = state.vehicleCarteGrise.find(c => c.parc === parc);
  if (!cg) return res.status(404).json({ error: 'CG not found' });
  cg.oldCGBarred = true;
  debouncedSave();
  res.json(cg);
});

// ASSURANCE - Prisma-backed
app.get(['/vehicles/:parc/assurance','/api/vehicles/:parc/assurance'], requireAuth, async (req, res) => {
  try {
    const parc = req.params.parc;
    const assurance = await prisma.vehicleAssurance.findUnique({
      where: { parc }
    });
    if (!assurance) return res.json({ parc, attestationPath: null, dateValidityStart: null, dateValidityEnd: null, timeValidityStart: null, timeValidityEnd: null, isActive: false, notes: '' });
    
    const now = new Date();
    const endDate = assurance.dateValidityEnd ? new Date(assurance.dateValidityEnd) : null;
    assurance.isActive = endDate ? endDate > now : false;
    
    res.json(assurance);
  } catch (e) {
    console.error('❌ GET /assurance error:', e.message);
    res.status(500).json({ error: 'Failed to fetch assurance', details: e.message });
  }
});

app.post(['/vehicles/:parc/assurance','/api/vehicles/:parc/assurance'], requireAuth, async (req, res) => {
  try {
    const parc = req.params.parc;
    const { attestationPath, dateValidityStart, dateValidityEnd, timeValidityStart, timeValidityEnd, notes } = req.body;
    
    const assurance = await prisma.vehicleAssurance.upsert({
      where: { parc },
      update: {
        attestationPath,
        dateValidityStart: dateValidityStart ? new Date(dateValidityStart) : undefined,
        dateValidityEnd: dateValidityEnd ? new Date(dateValidityEnd) : undefined,
        timeValidityStart,
        timeValidityEnd,
        notes: notes || ''
      },
      create: {
        id: uid(),
        parc,
        attestationPath,
        dateValidityStart: dateValidityStart ? new Date(dateValidityStart) : null,
        dateValidityEnd: dateValidityEnd ? new Date(dateValidityEnd) : null,
        timeValidityStart,
        timeValidityEnd,
        notes: notes || ''
      }
    });
    
    const now = new Date();
    const endDate = assurance.dateValidityEnd ? new Date(assurance.dateValidityEnd) : null;
    assurance.isActive = endDate ? endDate > now : false;
    
    res.json(assurance);
  } catch (e) {
    console.error('❌ POST /assurance error:', e.message);
    res.status(500).json({ error: 'Failed to save assurance', details: e.message });
  }
});

// CERTIFICAT TEMPORAIRE (CG en cours de changement)
app.get(['/vehicles/:parc/certificat-temporaire','/api/vehicles/:parc/certificat-temporaire'], requireAuth, (req, res) => {
  const parc = req.params.parc;
  const certTemp = state.vehicleCarteGrise.find(c => c.parc === parc)?.certificatTemporaire;
  
  if (!certTemp) {
    return res.json({ parc, dateDebut: null, dateFin: null, isActive: false });
  }
  
  const now = new Date();
  const debut = certTemp.dateDebut ? new Date(certTemp.dateDebut) : null;
  const fin = certTemp.dateFin ? new Date(certTemp.dateFin) : null;
  
  certTemp.isActive = (debut && fin) ? (debut <= now && now <= fin) : false;
  res.json(certTemp);
});

app.post(['/vehicles/:parc/certificat-temporaire','/api/vehicles/:parc/certificat-temporaire'], requireAuth, (req, res) => {
  const parc = req.params.parc;
  const { dateDebut, dateFin } = req.body;
  
  let cg = state.vehicleCarteGrise.find(c => c.parc === parc);
  if (!cg) {
    cg = { id: uid(), parc, oldCGPath: null, newCGPath: null, oldCGBarred: false, dateImport: new Date().toISOString(), notes: '', certificatTemporaire: null };
    state.vehicleCarteGrise.push(cg);
  }
  
  cg.certificatTemporaire = {
    dateDebut: dateDebut || null,
    dateFin: dateFin || null,
    isActive: false // Sera calculé au GET
  };
  
  const now = new Date();
  const debut = dateDebut ? new Date(dateDebut) : null;
  const fin = dateFin ? new Date(dateFin) : null;
  cg.certificatTemporaire.isActive = (debut && fin) ? (debut <= now && now <= fin) : false;
  
  debouncedSave();
  res.json(cg.certificatTemporaire);
});

// CONTRÔLE TECHNIQUE
app.get(['/vehicles/:parc/ct','/api/vehicles/:parc/ct'], requireAuth, async (req, res) => {
  try {
    const parc = req.params.parc;
    const cts = await prisma.vehicleControlTechnique.findMany({
      where: { parc },
      orderBy: { ctDate: 'desc' }
    });
    
    const latest = cts[0] || null;
    res.json({ parc, ctHistory: cts, latestCT: latest });
  } catch (e) {
    console.error('❌ Error fetching CT:', e.message);
    res.status(500).json({ error: 'Failed to fetch contrôle technique', details: e.message });
  }
});

app.post(['/vehicles/:parc/ct','/api/vehicles/:parc/ct'], requireAuth, async (req, res) => {
  try {
    const parc = req.params.parc;
    const { attestationPath, ctDate, ctStatus, nextCtDate, mileage, notes } = req.body;
    
    // Create in Prisma
    const ct = await prisma.vehicleControlTechnique.create({
      data: {
        id: uid(),
        parc,
        attestationPath: attestationPath || null,
        ctDate: ctDate ? new Date(ctDate) : new Date(),
        ctStatus: ctStatus || 'passed',
        nextCtDate: nextCtDate ? new Date(nextCtDate) : null,
        mileage: mileage ? parseInt(mileage) : null,
        notes: notes || null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    
    // Also save to state for in-memory access
    state.vehicleControleTechnique.push({
      id: ct.id,
      parc: ct.parc,
      attestationPath: ct.attestationPath,
      ctDate: ct.ctDate.toISOString(),
      ctStatus: ct.ctStatus,
      nextCtDate: ct.nextCtDate?.toISOString() || null,
      mileage: ct.mileage,
      notes: ct.notes
    });
    
    debouncedSave();
    console.log('✅ Contrôle technique créé:', ct.id, parc);
    res.status(201).json(ct);
  } catch (e) {
    console.error('❌ Error creating CT:', e.message);
    res.status(500).json({ error: 'Failed to create contrôle technique', details: e.message });
  }
});

// CERTIFICAT DE CESSION (une seule fois)
app.get(['/vehicles/:parc/certificat-cession','/api/vehicles/:parc/certificat-cession'], requireAuth, async (req, res) => {
  try {
    const parc = req.params.parc;
    const cert = await prisma.vehicleCessionCertificate.findUnique({
      where: { parc }
    });
    res.json(cert || { parc, certificatePath: null, dateImport: null, notes: '', imported: false });
  } catch (e) {
    console.error('Erreur lecture cession:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post(['/vehicles/:parc/certificat-cession','/api/vehicles/:parc/certificat-cession'], requireAuth, async (req, res) => {
  try {
    const parc = req.params.parc;
    
    // Vérifier si déjà importé
    const existing = await prisma.vehicleCessionCertificate.findUnique({
      where: { parc }
    });
    
    if (existing && existing.imported) {
      return res.status(400).json({ error: 'Certificate already imported for this vehicle' });
    }
    
    const { certificatePath, notes } = req.body;
    
    const cert = await prisma.vehicleCessionCertificate.upsert({
      where: { parc },
      update: {
        certificatePath,
        notes: notes || '',
        dateImport: new Date(),
        imported: true
      },
      create: {
        id: uid(),
        parc,
        certificatePath,
        notes: notes || '',
        dateImport: new Date(),
        imported: true
      }
    });
    
    res.json(cert);
  } catch (e) {
    console.error('Erreur sauvegarde cession:', e);
    res.status(500).json({ error: e.message });
  }
});

// ÉCHÉANCIER
app.get(['/vehicles/:parc/echancier','/api/vehicles/:parc/echancier'], requireAuth, (req, res) => {
  const parc = req.params.parc;
  const items = state.vehicleEchancier.filter(e => e.parc === parc).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  res.json(items);
});

app.get(['/api/echancier','/echancier'], requireAuth, (req, res) => {
  const allItems = state.vehicleEchancier.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  res.json({ echancier: allItems });
});

app.post(['/vehicles/:parc/echancier','/api/vehicles/:parc/echancier'], requireAuth, (req, res) => {
  const parc = req.params.parc;
  const { type, description, dueDate, notes } = req.body;
  
  const item = {
    id: uid(),
    parc,
    type: type || 'assurance', // 'assurance' | 'ct' | 'cg'
    description: description || '',
    dueDate,
    status: 'pending', // 'pending' | 'done' | 'expired'
    notes: notes || ''
  };
  
  state.vehicleEchancier.push(item);
  debouncedSave();
  res.status(201).json(item);
});

app.put(['/vehicles/:parc/echancier/:id','/api/vehicles/:parc/echancier/:id'], requireAuth, (req, res) => {
  const { parc, id } = req.params;
  const { status, notes } = req.body;
  
  const item = state.vehicleEchancier.find(e => e.id === id && e.parc === parc);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  
  if (status) item.status = status;
  if (notes !== undefined) item.notes = notes;
  
  debouncedSave();
  res.json(item);
});

app.delete(['/vehicles/:parc/echancier/:id','/api/vehicles/:parc/echancier/:id'], requireAuth, (req, res) => {
  const { parc, id } = req.params;
  const idx = state.vehicleEchancier.findIndex(e => e.id === id && e.parc === parc);
  if (idx === -1) return res.status(404).json({ error: 'Item not found' });
  
  const deleted = state.vehicleEchancier.splice(idx, 1)[0];
  debouncedSave();
  res.json(deleted);
});

// RETRO REQUESTS & NEWS (RetroAssistant, RétroDemandes)
app.get(['/api/retro-requests'], requireAuth, async (req, res) => {
  try {
    // Get member by email to get real ID
    const member = await prisma.members.findUnique({ where: { email: req.user.email } });
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }
    
    // Get user's retro requests from Prisma
    const requests = await prisma.retro_request.findMany({
      where: { userId: member.id },
      orderBy: { createdAt: 'desc' },
      include: {
        retro_request_file: true,
        retro_request_status_log: true
      }
    });
    res.json({ requests });
  } catch (e) {
    console.error('Erreur GET retro-requests:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get(['/api/retro-requests/admin/all'], requireAuth, async (req, res) => {
  try {
    // Check if user has ADMIN role - lookup by email
    const member = await prisma.members.findUnique({ where: { email: req.user.email } });
    const userRole = String(member?.role || req.user?.role || '').toUpperCase();
    const isAdmin = ['ADMIN', 'PRESIDENT', 'VICE_PRESIDENT', 'TRESORIER', 'SECRETAIRE_GENERAL'].includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    // Return all retro requests
    const requests = await prisma.retro_request.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        retro_request_file: true,
        retro_request_status_log: true
      }
    });
    res.json({ requests });
  } catch (e) {
    console.error('Erreur GET retro-requests/admin/all:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post(['/api/retro-requests'], requireAuth, async (req, res) => {
  try {
    const { title, description, category, priority, details } = req.body;
    
    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }
    
    // Get user info by email
    const member = await prisma.members.findUnique({ where: { email: req.user.email } });
    if (!member) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const request = await prisma.retro_request.create({
      data: {
        id: Math.random().toString(36).substr(2, 9),
        userId: member.id,
        userName: `${member.firstName} ${member.lastName}`,
        userEmail: member.email,
        title,
        description,
        category: category || 'GENERAL',
        priority: priority || 'NORMAL',
        status: 'PENDING',
        details: details || {},
        updatedAt: new Date()
      }
    });
    
    console.log('✅ RétroDemande créée:', request.id);
    res.status(201).json({ request });
  } catch (e) {
    console.error('Erreur POST retro-requests:', e.message);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put(['/api/retro-requests/:id'], requireAuth, async (req, res) => {
  try {
    const { title, description, category, priority, status, notes } = req.body;
    
    // Check if request exists and user owns it
    const request = await prisma.retro_request.findUnique({ where: { id: req.params.id } });
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    // Only allow user to edit their own requests or admins to edit all - lookup by email
    const member = await prisma.members.findUnique({ where: { email: req.user.email } });
    const userRole = String(member?.role || req.user?.role || '').toUpperCase();
    const isAdmin = ['ADMIN', 'PRESIDENT', 'VICE_PRESIDENT', 'TRESORIER', 'SECRETAIRE_GENERAL'].includes(userRole);
    if (request.userId !== member.id && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const updated = await prisma.retro_request.update({
      where: { id: req.params.id },
      data: {
        title: title || request.title,
        description: description || request.description,
        category: category || request.category,
        priority: priority || request.priority,
        status: status || request.status,
        notes: notes || request.notes,
        updatedAt: new Date()
      }
    });

    // Notify ticket creator when admins update status/comments
    try {
      const actorName = `${member?.firstName || ''} ${member?.lastName || ''}`.trim() || member?.email || req.user?.email || 'Support';
      const creatorEmail = String(request.userEmail || '').trim().toLowerCase();
      const actorEmail = String(member?.email || req.user?.email || '').trim().toLowerCase();
      const statusChanged = (status && status !== request.status);
      const notesChanged = (notes && notes !== request.notes);

      if (creatorEmail && creatorEmail !== actorEmail && (statusChanged || notesChanged)) {
        const updates = [];
        if (statusChanged) updates.push(`Statut mis à jour : ${request.status} → ${status}`);
        if (notesChanged) updates.push('Nouveau commentaire ajouté sur votre ticket.');

        await prisma.notification.create({
          data: {
            title: `🎫 Suivi ticket: ${request.title}`,
            message: `${updates.join('\n')}\nPar: ${actorName}`,
            type: 'info',
            priority: 'normal',
            active: true,
            targetedTo: `user:${creatorEmail}`,
            createdBy: actorEmail || actorName
          }
        });
      }
    } catch (notifError) {
      console.warn('⚠️ Notification ticket non envoyée (PUT retro-requests):', notifError.message);
    }
    
    res.json({ request: updated });
  } catch (e) {
    console.error('Erreur PUT retro-requests:', e.message);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete(['/api/retro-requests/:id'], requireAuth, async (req, res) => {
  try {
    // Check if request exists and user owns it
    const request = await prisma.retro_request.findUnique({ where: { id: req.params.id } });
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    // Only allow user to delete their own requests or admins to delete all - lookup by email
    const member = await prisma.members.findUnique({ where: { email: req.user.email } });
    const userRole = String(member?.role || req.user?.role || '').toUpperCase();
    const isAdmin = ['ADMIN', 'PRESIDENT', 'VICE_PRESIDENT', 'TRESORIER', 'SECRETAIRE_GENERAL'].includes(userRole);
    if (request.userId !== member.id && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    await prisma.retro_request.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    console.error('Erreur DELETE retro-requests:', e.message);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post(['/api/retro-requests/:id/status'], requireAuth, async (req, res) => {
  try {
    // Get member by email
    const member = await prisma.members.findUnique({ where: { email: req.user.email } });
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Find the request
    const request = await prisma.retro_request.findUnique({ where: { id: req.params.id } });
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Check authorization - ONLY ADMIN can change status
    const userRole = String(member?.role || req.user?.role || '').toUpperCase();
    const isAdmin = ['ADMIN', 'PRESIDENT', 'VICE_PRESIDENT', 'TRESORIER', 'SECRETAIRE_GENERAL'].includes(userRole);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Only admins can change request status' });
    }

    // Update status
    const updatedRequest = await prisma.retro_request.update({
      where: { id: req.params.id },
      data: {
        status: req.body.status,
        updatedAt: new Date()
      }
    });

    // Notify ticket creator on status update
    try {
      const actorName = `${member?.firstName || ''} ${member?.lastName || ''}`.trim() || member?.email || req.user?.email || 'Support';
      const creatorEmail = String(request.userEmail || '').trim().toLowerCase();
      const actorEmail = String(member?.email || req.user?.email || '').trim().toLowerCase();

      if (creatorEmail && creatorEmail !== actorEmail && req.body.status !== request.status) {
        await prisma.notification.create({
          data: {
            title: `🎫 Statut ticket mis à jour`,
            message: `Ticket: ${request.title}\n${request.status} → ${req.body.status}\nPar: ${actorName}`,
            type: 'info',
            priority: 'normal',
            active: true,
            targetedTo: `user:${creatorEmail}`,
            createdBy: actorEmail || actorName
          }
        });
      }
    } catch (notifError) {
      console.warn('⚠️ Notification ticket non envoyée (POST status):', notifError.message);
    }

    res.json({ ok: true, request: updatedRequest });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Upload file to retro request
app.post(['/api/retro-requests/:id/upload'], requireAuth, uploadLimiter, multer({ storage: multer.memoryStorage() }).single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Check if request exists
    const request = await prisma.retro_request.findUnique({ where: { id: req.params.id } });
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Get member by email
    const member = await prisma.members.findUnique({ where: { email: req.user.email } });
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Only owner or admin can upload
    const isAdmin = member?.role === 'ADMIN';
    if (request.userId !== member.id && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Save file to disk
    const uploadsDir = pathRoot + '/uploads/retro-requests';
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const fileName = `${Date.now()}-${req.file.originalname}`;
    const filePath = uploadsDir + '/' + fileName;
    fs.writeFileSync(filePath, req.file.buffer);

    // Save file record to database
    const fileRecord = await prisma.retro_request_file.create({
      data: {
        id: Math.random().toString(36).substr(2, 9),
        requestId: req.params.id,
        fileName: req.file.originalname,
        filePath: filePath,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        uploadedBy: member.id
      }
    });

    console.log('✅ File uploaded:', fileRecord.id, req.file.originalname);
    res.status(201).json({ file: fileRecord });
  } catch (e) {
    console.error('Erreur POST retro-requests/:id/upload:', e.message);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Delete file from retro request
app.delete(['/api/retro-requests/:id/files/:fileId'], requireAuth, async (req, res) => {
  try {
    // Get file record
    const fileRecord = await prisma.retro_request_file.findUnique({ where: { id: req.params.fileId } });
    if (!fileRecord) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Check request exists
    const request = await prisma.retro_request.findUnique({ where: { id: req.params.id } });
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Get member by email
    const member = await prisma.members.findUnique({ where: { email: req.user.email } });
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Only owner or admin can delete
    const isAdmin = member?.role === 'ADMIN';
    if (request.userId !== member.id && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Delete file from disk
    if (fs.existsSync(fileRecord.filePath)) {
      fs.unlinkSync(fileRecord.filePath);
    }

    // Delete file record
    await prisma.retro_request_file.delete({ where: { id: req.params.fileId } });

    console.log('✅ File deleted:', req.params.fileId);
    res.json({ ok: true });
  } catch (e) {
    console.error('Erreur DELETE retro-requests/:id/files/:fileId:', e.message);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// Lier un devis à une demande
app.post(['/api/retro-requests/:id/link-devis'], requireAuth, async (req, res) => {
  try {
    const { devisId } = req.body;
    if (!devisId) {
      return res.status(400).json({ error: 'devisId is required' });
    }

    // Get request and verify ownership/admin
    const request = await prisma.retro_request.findUnique({ where: { id: req.params.id } });
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const member = await prisma.members.findUnique({ where: { email: req.user.email } });
    const isAdmin = member?.role === 'ADMIN';
    if (request.userId !== member.id && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Update request with devis link
    const updated = await prisma.retro_request.update({
      where: { id: req.params.id },
      data: {
        details: {
          ...request.details,
          linkedDevisId: devisId
        }
      }
    });

    console.log('✅ Devis lié à la demande:', devisId);
    res.json({ ok: true, request: updated });
  } catch (e) {
    console.error('Erreur POST retro-requests/:id/link-devis:', e.message);
    res.status(500).json({ error: 'Link failed' });
  }
});

// Lier une facture à une demande
app.post(['/api/retro-requests/:id/link-facture'], requireAuth, async (req, res) => {
  try {
    const { factureId } = req.body;
    if (!factureId) {
      return res.status(400).json({ error: 'factureId is required' });
    }

    // Get request and verify ownership/admin
    const request = await prisma.retro_request.findUnique({ where: { id: req.params.id } });
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const member = await prisma.members.findUnique({ where: { email: req.user.email } });
    const isAdmin = member?.role === 'ADMIN';
    if (request.userId !== member.id && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Update request with facture link
    const updated = await prisma.retro_request.update({
      where: { id: req.params.id },
      data: {
        details: {
          ...request.details,
          linkedFactureId: factureId
        }
      }
    });

    console.log('✅ Facture liée à la demande:', factureId);
    res.json({ ok: true, request: updated });
  } catch (e) {
    console.error('Erreur POST retro-requests/:id/link-facture:', e.message);
    res.status(500).json({ error: 'Link failed' });
  }
});

// RETRO NEWS (content management) - PERSISTED IN PRISMA
// 🎯 HELPER: Normalize RetroNews field mapping (frontend → Prisma)
const normalizeRetroNewsForPrisma = (data, userId) => {
  return {
    id: data.id || randomUUID(), // Generate UUID if not provided
    title: String(data.title || 'Sans titre').trim(),
    content: String(data.content || data.body || '').trim(), // Prisma schema uses 'content'
    excerpt: data.excerpt ? String(data.excerpt).trim() : undefined,
    imageUrl: data.imageUrl ? String(data.imageUrl).trim() : undefined,
    media: data.media || null, // JSON string of media array
    polls: data.polls || null, // JSON string of polls array
    author: String(data.author || userId || 'anonyme').trim(),
    published: Boolean(data.published !== undefined ? data.published : data.status === 'published'), // Convert status → published boolean
    featured: Boolean(data.featured || data.isFeatured || false),
    showOnExternal: Boolean(data.showOnExternal || false),
    createdBy: data.createdBy || userId,
    publishedAt: data.publishedAt || (Boolean(data.published) ? new Date() : null),
    updatedAt: new Date()
  };
};

// 🎯 HELPER: Response format (Prisma → frontend)
const formatRetroNewsForFrontend = (prismaNews) => {
  // Build absolute URL prefix for media - force HTTPS for Railway
  let apiBaseUrl = process.env.VITE_API_URL || process.env.PUBLIC_API_BASE || 'https://attractive-kindness-rbe-serveurs.up.railway.app';
  
  // Ensure HTTPS for Railway domains
  if (apiBaseUrl.startsWith('http://') && apiBaseUrl.includes('railway.app')) {
    apiBaseUrl = apiBaseUrl.replace('http://', 'https://');
  }
  
  // Transform media URLs from relative to absolute
  let media = prismaNews.media;
  if (Array.isArray(media)) {
    media = media.map(item => {
      if (item && item.url && item.url.startsWith('/uploads')) {
        return { ...item, url: apiBaseUrl + item.url };
      }
      return item;
    });
  }

  return {
    id: prismaNews.id,
    title: prismaNews.title,
    body: prismaNews.content, // Map content to body for frontend
    content: prismaNews.content,
    excerpt: prismaNews.excerpt,
    imageUrl: prismaNews.imageUrl,
    media: media, // Include media JSON with absolute URLs
    polls: prismaNews.polls, // Include polls JSON
    author: prismaNews.author,
    status: prismaNews.published ? 'published' : 'draft', // Map published boolean to status string
    published: prismaNews.published,
    isFeatured: prismaNews.featured, // Map featured to isFeatured for frontend
    featured: prismaNews.featured,
    showOnExternal: prismaNews.showOnExternal,
    createdBy: prismaNews.createdBy,
    publishedAt: prismaNews.publishedAt,
    createdAt: prismaNews.createdAt,
    updatedAt: prismaNews.updatedAt
  };
};

// ============================================
// RETRO NEWS ENDPOINTS
// ============================================

// ✅ GET /api/retro-news - Fetch all news
app.get('/api/retro-news', async (req, res) => {
  try {
    const news = await prisma.retroNews.findMany({
      orderBy: [
        { featured: 'desc' },      // Featured first (true > false)
        { publishedAt: 'desc' },   // Then by publication date
        { createdAt: 'desc' }      // Fallback to creation date
      ],
      take: 100 // Limit results
    });
    console.log(`✅ Loaded ${news.length} retro news from Prisma`);
    res.json(news.map(formatRetroNewsForFrontend));
  } catch (e) {
    console.error('❌ GET /api/retro-news error:', e.message);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});

// ✅ POST /api/retro-news - Create new news
app.post(['/api/retro-news'], requireAuth, async (req, res) => {
  try {
    const newsData = normalizeRetroNewsForPrisma(req.body, req.user?.id || req.user?.email);
    
    console.log('📝 Creating RetroNews:', { 
      title: newsData.title, 
      author: newsData.author, 
      published: newsData.published 
    });
    
    const created = await prisma.retroNews.create({
      data: newsData
    });
    
    console.log(`✅ RetroNews created: ${created.id}`);
    res.status(201).json(formatRetroNewsForFrontend(created));
  } catch (e) {
    console.error('❌ POST /api/retro-news error:', e.message);
    res.status(500).json({ error: 'Failed to create news: ' + e.message });
  }
});

// ✅ PUT /api/retro-news/:id - Update news
app.put(['/api/retro-news/:id'], requireAuth, async (req, res) => {
  try {
    const newsId = req.params.id;
    const newsData = normalizeRetroNewsForPrisma(req.body, req.user?.id || req.user?.email);
    
    // Remove fields that shouldn't be updated
    const updateData = { ...newsData };
    delete updateData.id; // Cannot update primary key
    delete updateData.createdAt; // Cannot update creation date
    delete updateData.createdBy; // Cannot change original creator
    
    console.log('🔄 Updating RetroNews:', { id: newsId, title: updateData.title });
    
    const updated = await prisma.retroNews.update({
      where: { id: newsId },
      data: updateData
    });
    
    console.log(`✅ RetroNews updated: ${newsId}`);
    res.json(formatRetroNewsForFrontend(updated));
  } catch (e) {
    if (e.code === 'P2025') {
      // Not found
      console.warn(`⚠️ RetroNews not found: ${req.params.id}`);
      return res.status(404).json({ error: 'News not found' });
    }
    console.error('❌ PUT /api/retro-news error:', e.message);
    res.status(500).json({ error: 'Failed to update news: ' + e.message });
  }
});

// ✅ DELETE /api/retro-news/:id - Delete news
app.delete(['/api/retro-news/:id'], requireAuth, async (req, res) => {
  try {
    const newsId = req.params.id;
    
    console.log('🗑️ Deleting RetroNews:', newsId);
    
    const deleted = await prisma.retroNews.delete({
      where: { id: newsId }
    });
    
    console.log(`✅ RetroNews deleted: ${newsId}`);
    res.json({ ok: true, id: newsId });
  } catch (e) {
    if (e.code === 'P2025') {
      // Not found
      console.warn(`⚠️ RetroNews not found: ${req.params.id}`);
      return res.status(404).json({ error: 'News not found' });
    }
    console.error('❌ DELETE /api/retro-news error:', e.message);
    res.status(500).json({ error: 'Failed to delete news: ' + e.message });
  }
});

// ============================================
// RETRO NEWS - MEDIA UPLOAD
// ============================================

const retroNewsMediaStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(pathRoot, 'uploads', 'retroactus');
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const retroNewsMediaUpload = multer({
  storage: retroNewsMediaStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/webm',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'application/zip',
      'application/x-zip-compressed'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non supporté. Utilisez image, vidéo ou document (PDF/Office/TXT/ZIP).'));
    }
  }
});

// POST /api/retro-news/media/upload - Upload media (photos/videos)
app.post('/api/retro-news/media/upload', requireAuth, uploadLimiter, retroNewsMediaUpload.single('media'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier uploadé' });
    }

    // Build absolute URL for production (Vercel frontend needs Railway API URL)
    const relativePath = `/uploads/retroactus/${req.file.filename}`;
    
    // Detect protocol - force HTTPS if behind Railway proxy
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const isHttps = protocol === 'https' || req.get('host')?.includes('railway.app');
    const finalProtocol = isHttps ? 'https' : protocol;
    
    const apiBaseUrl = process.env.VITE_API_URL || process.env.PUBLIC_API_BASE || `${finalProtocol}://${req.get('host')}`;
    const mediaUrl = apiBaseUrl + relativePath;
    
    const mediaType = req.file.mimetype.startsWith('video/')
      ? 'video'
      : req.file.mimetype.startsWith('image/')
        ? 'image'
        : 'file';
    const caption = req.body.caption || '';

    console.log(`✅ Media uploaded: ${mediaUrl} (${mediaType})`);
    
    res.json({
      success: true,
      media: {
        type: mediaType,
        url: mediaUrl,
        caption: caption,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size
      }
    });
  } catch (e) {
    console.error('❌ Upload error:', e.message);
    res.status(500).json({ error: 'Échec de l\'upload: ' + e.message });
  }
});

// ============================================
// RETRO NEWS - POLLS & VOTING
// ============================================

// POST /api/retro-news/:id/poll/vote - Vote on a poll
app.post('/api/retro-news/:id/poll/vote', async (req, res) => {
  try {
    const { id: newsId } = req.params;
    const { pollId, optionId } = req.body;
    const userId = req.user?.email || req.user?.id || null;
    const userIp = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    if (!pollId || !optionId) {
      return res.status(400).json({ error: 'pollId et optionId sont requis' });
    }

    // Check if user already voted (if userId exists)
    if (userId) {
      const existingVote = await prisma.retroNewsPollVotes.findUnique({
        where: {
          newsId_pollId_userId: {
            newsId,
            pollId,
            userId
          }
        }
      });

      if (existingVote) {
        return res.status(400).json({ error: 'Vous avez déjà voté sur ce sondage' });
      }
    }

    // Check IP-based vote limit (for anonymous users)
    if (!userId) {
      const recentVotes = await prisma.retroNewsPollVotes.count({
        where: {
          newsId,
          pollId,
          userIp,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      });

      if (recentVotes > 0) {
        return res.status(400).json({ error: 'Vous avez déjà voté sur ce sondage (IP)' });
      }
    }

    // Record the vote
    const vote = await prisma.retroNewsPollVotes.create({
      data: {
        newsId,
        pollId,
        optionId,
        userId: userId || userIp, // Use IP as fallback
        userIp
      }
    });

    // Get updated vote counts
    const votes = await prisma.retroNewsPollVotes.groupBy({
      by: ['optionId'],
      where: {
        newsId,
        pollId
      },
      _count: {
        optionId: true
      }
    });

    const voteCounts = {};
    votes.forEach(v => {
      voteCounts[v.optionId] = v._count.optionId;
    });

    console.log(`✅ Vote recorded: ${newsId} / ${pollId} / ${optionId}`);
    
    res.json({
      success: true,
      vote,
      voteCounts
    });
  } catch (e) {
    console.error('❌ Vote error:', e.message);
    res.status(500).json({ error: 'Échec du vote: ' + e.message });
  }
});

// GET /api/retro-news/:id/polls/:pollId/results - Get poll results
app.get('/api/retro-news/:id/polls/:pollId/results', async (req, res) => {
  try {
    const { id: newsId, pollId } = req.params;

    const votes = await prisma.retroNewsPollVotes.groupBy({
      by: ['optionId'],
      where: {
        newsId,
        pollId
      },
      _count: {
        optionId: true
      }
    });

    const voteCounts = {};
    let totalVotes = 0;
    
    votes.forEach(v => {
      voteCounts[v.optionId] = v._count.optionId;
      totalVotes += v._count.optionId;
    });

    console.log(`✅ Poll results: ${newsId} / ${pollId} - ${totalVotes} votes`);
    
    res.json({
      pollId,
      voteCounts,
      totalVotes
    });
  } catch (e) {
    console.error('❌ Poll results error:', e.message);
    res.status(500).json({ error: 'Échec de récupération des résultats: ' + e.message });
  }
});

// ============================================================
// 👥 MEMBERS ENDPOINTS - Helper functions
// ============================================================

/**
 * Convertit une date YYYY-MM-DD en DateTime ISO-8601
 * @param {string} dateStr - Date au format YYYY-MM-DD ou ISO
 * @returns {Date|null} DateTime ou null si invalide
 */
const toDateTime = (dateStr) => {
  if (!dateStr || dateStr === '') return null;
  try {
    // Si déjà un DateTime ISO, retourner tel quel
    if (dateStr.includes('T')) return new Date(dateStr);
    // Sinon convertir YYYY-MM-DD en DateTime à minuit UTC
    return new Date(`${dateStr}T00:00:00.000Z`);
  } catch {
    return null;
  }
};

/**
 * Prépare les données d'un membre en convertissant les dates pour Prisma
 * @param {object} body - Corps de la requête
 * @param {boolean} isUpdate - True si c'est une mise à jour (ne pas générer id)
 * @returns {object} Données formatées pour Prisma
 */
const prepareMemberData = (body, isUpdate = false) => {
  const data = {};
  
  // Champs texte
  if (body.firstName !== undefined) data.firstName = body.firstName || '';
  if (body.lastName !== undefined) data.lastName = body.lastName || '';
  if (body.email !== undefined) data.email = body.email;
  if (body.phone !== undefined) data.phone = body.phone || null;
  if (body.address !== undefined) data.address = body.address || null;
  if (body.city !== undefined) data.city = body.city || null;
  if (body.postalCode !== undefined) data.postalCode = body.postalCode || null;
  if (body.matricule !== undefined) data.matricule = body.matricule || null;
  if (body.memberNumber !== undefined) data.memberNumber = body.memberNumber || null;
  if (body.role !== undefined) data.role = body.role || 'MEMBER';
  
  // Membership
  if (body.membershipType !== undefined) data.membershipType = body.membershipType || 'STANDARD';
  if (body.membershipStatus !== undefined) data.membershipStatus = body.membershipStatus || 'ACTIVE';
  
  // Paiement
  if (body.paymentAmount !== undefined) {
    if (body.paymentAmount === '' || body.paymentAmount === null) {
      data.paymentAmount = null;
    } else {
      const amount = Number.parseFloat(body.paymentAmount);
      data.paymentAmount = Number.isNaN(amount) ? null : amount;
    }
  }
  if (body.paymentMethod !== undefined) data.paymentMethod = body.paymentMethod || null;
  
  // Divers
  if (body.notes !== undefined) data.notes = body.notes || null;
  if (body.newsletter !== undefined) data.newsletter = body.newsletter ?? true;
  if (body.status !== undefined) data.status = body.status || 'active';
  
  // Dates - conversion YYYY-MM-DD → DateTime ISO-8601
  if (body.birthDate !== undefined) data.birthDate = toDateTime(body.birthDate);
  if (body.membershipStartDate !== undefined) data.membershipStartDate = toDateTime(body.membershipStartDate);
  if (body.membershipEndDate !== undefined) data.membershipEndDate = toDateTime(body.membershipEndDate);
  
  // Timestamps
  if (!isUpdate) {
    data.createdAt = new Date();
  }
  data.updatedAt = new Date();
  
  return data;
};

const ADHESION_REQUEST_STATUSES = new Set(['PENDING', 'APPROVED', 'REJECTED']);

const ensureCandidateMailbackTemplate = async () => {
  try {
    await prisma.emailTemplate.upsert({
      where: { name: 'mailback_candidat' },
      create: {
        name: 'mailback_candidat',
        subject: 'Suivi de votre candidature d\'adhésion - RétroBus Essonne',
        body: [
          'Bonjour {{candidate.firstName}} {{candidate.lastName}},',
          '',
          'Votre demande d\'adhésion est désormais traitée.',
          '',
          'Décision : {{decisionLabel}}',
          'Motif : {{reasonText}}',
          '',
          'Si vous avez des questions, vous pouvez répondre à ce message en contactant l\'association.',
          '',
          'RétroBus Essonne'
        ].join('\n'),
        description: 'Retour automatique envoyé au candidat après décision RH',
        variables: JSON.stringify(['candidate.firstName', 'candidate.lastName', 'decisionLabel', 'reasonText']),
        category: 'ADHESION',
        active: true
      },
      update: {
        active: true,
        category: 'ADHESION'
      }
    });
  } catch (error) {
    console.warn('⚠️ Unable to ensure mailback_candidat template:', error.message);
  }
};

const getAdhesionAlertRecipients = async () => {
  try {
    const rows = await prisma.members.findMany({
      where: {
        OR: [
          { role: { in: ['ADMIN', 'PRESIDENT', 'VICE_PRESIDENT'] } },
          { matricule: { equals: 'n.bayoudh', mode: 'insensitive' } },
          { email: { contains: 'n.bayoudh', mode: 'insensitive' } }
        ]
      },
      select: { email: true }
    });

    const emails = [...new Set(rows.map((r) => String(r.email || '').trim().toLowerCase()).filter(Boolean))];
    return emails;
  } catch (error) {
    console.warn('⚠️ getAdhesionAlertRecipients failed:', error.message);
    return [];
  }
};

// ============================================================
// 👥 MEMBERS ENDPOINTS
// ============================================================

const resolveSignatureChannel = (memberData = {}) => {
  return (
    memberData.signatureChannel ||
    memberData.signature_channel ||
    memberData.signatureMethod ||
    memberData.signatureSource ||
    'bulletin_dematerialise_web'
  );
};

const buildMemberSignaturePayload = async (member) => {
  if (!member) {
    return {
      signatureHistory: [],
      latestSignature: null
    };
  }

  const memberId = String(member.id || '').trim();
  const memberEmail = String(member.email || '').trim().toLowerCase();
  const memberNumber = String(member.memberNumber || '').trim();

  const signedFlows = await prisma.bulletinFlowToken.findMany({
    where: { status: 'signed' },
    orderBy: { signedAt: 'desc' },
    take: 300,
    select: {
      token: true,
      signedAt: true,
      createdAt: true,
      signatureData: true,
      memberData: true,
      ipAddress: true,
      userAgent: true
    }
  });

  const filtered = signedFlows.filter((flow) => {
    const md = flow.memberData || {};
    const flowMemberId = String(md.id || '').trim();
    const flowEmail = String(md.email || '').trim().toLowerCase();
    const flowMemberNumber = String(md.memberNumber || '').trim();

    return (
      (memberId && flowMemberId && flowMemberId === memberId) ||
      (memberEmail && flowEmail && flowEmail === memberEmail) ||
      (memberNumber && flowMemberNumber && flowMemberNumber === memberNumber)
    );
  });

  const signatureHistory = filtered.map((flow, idx) => {
    const md = flow.memberData || {};
    const memberSnapshot = {
      firstName: md.firstName || null,
      lastName: md.lastName || null,
      email: md.email || null,
      phone: md.phone || null,
      address: md.address || null,
      city: md.city || null,
      postalCode: md.postalCode || null,
      membershipType: md.membershipType || null,
      occupiedPosition: md.occupiedPosition || null,
      role: md.role || member.role || null,
      paymentAmount: md.paymentAmount ?? null,
      paymentMethod: md.paymentMethod || null,
      isExempted: md.isExempted ?? null,
      exemptionReason: md.exemptionReason || null,
      hasDrivingLicenses: md.hasDrivingLicenses ?? null,
      drivingLicenses: Array.isArray(md.drivingLicenses) ? md.drivingLicenses : [],
      drivingLicenseNumber: md.drivingLicenseNumber || null,
      drivingLicenseNumbers: md.drivingLicenseNumbers || {},
      acceptedStatuts: !!md.acceptedStatuts,
      acceptedReglementInterieur: !!md.acceptedReglementInterieur,
      acceptedCsar: !!md.acceptedCsar
    };

    return {
      token: flow.token,
      signedAt: flow.signedAt,
      createdAt: flow.createdAt,
      channel: resolveSignatureChannel(md),
      ipAddress: flow.ipAddress || null,
      userAgent: flow.userAgent || null,
      source: 'bulletin_flow',
      hasSignature: !!flow.signatureData,
      signatureDataUrl: idx === 0 ? (flow.signatureData || null) : null,
      memberSnapshot
    };
  });

  return {
    signatureHistory,
    latestSignature: signatureHistory.length > 0 ? signatureHistory[0] : null
  };
};

// MEMBERS
app.post('/api/public/adhesion-request', async (req, res) => {
  try {
    const firstName = String(req.body?.firstName || '').trim();
    const lastName = String(req.body?.lastName || '').trim();
    const phone = String(req.body?.phone || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const candidature = String(req.body?.candidature || '').trim();

    if (!firstName || !lastName || !email || !candidature) {
      return res.status(400).json({
        success: false,
        error: 'firstName, lastName, email et candidature sont requis'
      });
    }

    const created = await prisma.adhesionRequest.create({
      data: {
        firstName,
        lastName,
        phone: phone || null,
        email,
        candidature,
        status: 'PENDING'
      }
    });

    await prisma.notification.create({
      data: {
        title: 'Nouvelle adhésion demandée',
        message: `${firstName} ${lastName} (${email}) a transmis une candidature d'adhésion.`,
        type: 'info',
        priority: 'high',
        targetedTo: 'admins',
        active: true,
        createdBy: 'PUBLIC_ADHESION'
      }
    }).catch((e) => {
      console.warn('⚠️ Notification creation failed for adhesion request:', e.message);
    });

    const recipients = await getAdhesionAlertRecipients();
    if (transporter && recipients.length > 0) {
      const subject = `Nouvelle demande d'adhésion - ${firstName} ${lastName}`;
      const text = [
        `Une nouvelle candidature d'adhésion vient d'arriver.`,
        '',
        `Nom: ${firstName} ${lastName}`,
        `Email: ${email}`,
        `Téléphone: ${phone || 'Non renseigné'}`,
        '',
        'Candidature:',
        candidature
      ].join('\n');

      await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@association-rbe.fr',
        to: recipients.join(','),
        subject,
        text
      }).catch((e) => {
        console.warn('⚠️ Adhesion alert email failed:', e.message);
      });
    }

    return res.status(201).json({ success: true, request: created });
  } catch (error) {
    console.error('❌ /api/public/adhesion-request error:', error.message);
    return res.status(500).json({ success: false, error: 'Impossible d\'enregistrer la demande d\'adhésion' });
  }
});

app.get('/api/adhesion-requests', requireAuth, async (req, res) => {
  try {
    const status = String(req.query?.status || '').trim().toUpperCase();
    const search = String(req.query?.search || '').trim().toLowerCase();

    const where = {};
    if (status && ADHESION_REQUEST_STATUSES.has(status)) {
      where.status = status;
    }

    let requests = await prisma.adhesionRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    if (search) {
      requests = requests.filter((item) => {
        const haystack = `${item.firstName || ''} ${item.lastName || ''} ${item.email || ''} ${item.phone || ''} ${item.candidature || ''}`.toLowerCase();
        return haystack.includes(search);
      });
    }

    return res.json({ success: true, requests });
  } catch (error) {
    console.error('❌ /api/adhesion-requests error:', error.message);
    return res.status(500).json({ success: false, error: 'Impossible de charger les demandes d\'adhésion' });
  }
});

app.get('/api/adhesion-requests/stats', requireAuth, async (req, res) => {
  try {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let total = 0;

    const adhesionRequestModel = prisma?.adhesionRequest;

    if (adhesionRequestModel && typeof adhesionRequestModel.count === 'function') {
      [pending, approved, rejected, total] = await Promise.all([
        adhesionRequestModel.count({ where: { status: 'PENDING' } }),
        adhesionRequestModel.count({ where: { status: 'APPROVED' } }),
        adhesionRequestModel.count({ where: { status: 'REJECTED' } }),
        adhesionRequestModel.count()
      ]);
    } else if (prisma && typeof prisma.$queryRawUnsafe === 'function') {
      // Fallback: client Prisma desynchronise (delegate absent), on passe par SQL brut.
      const tableCandidates = ['"AdhesionRequest"', 'adhesion_requests'];
      let rows = [];

      for (const tableName of tableCandidates) {
        try {
          rows = await prisma.$queryRawUnsafe(
            `SELECT status, COUNT(*)::int AS count FROM ${tableName} GROUP BY status`
          );
          if (Array.isArray(rows)) {
            break;
          }
        } catch (sqlError) {
          rows = [];
        }
      }

      if (Array.isArray(rows) && rows.length > 0) {
        for (const row of rows) {
          const status = String(row.status || '').toUpperCase();
          const value = Number(row.count || 0);
          if (status === 'PENDING') pending = value;
          if (status === 'APPROVED') approved = value;
          if (status === 'REJECTED') rejected = value;
          total += value;
        }
      }
    }

    if (pending === 0 && approved === 0 && rejected === 0 && total === 0 && Array.isArray(state?.adhesionRequests)) {
      // Dernier fallback: runtime state en memoire
      for (const request of state.adhesionRequests) {
        const status = String(request?.status || '').toUpperCase();
        if (status === 'PENDING') pending += 1;
        else if (status === 'APPROVED') approved += 1;
        else if (status === 'REJECTED') rejected += 1;
      }
      total = state.adhesionRequests.length;
    }

    return res.json({
      success: true,
      stats: { pending, approved, rejected, total }
    });
  } catch (error) {
    console.error('❌ /api/adhesion-requests/stats error:', error.message);
    return res.status(500).json({ success: false, error: 'Impossible de charger les statistiques des demandes' });
  }
});

app.post('/api/adhesion-requests/:id/decision', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const decision = String(req.body?.decision || '').trim().toUpperCase();
    const reason = String(req.body?.reason || '').trim();

    if (!['APPROVED', 'REJECTED'].includes(decision)) {
      return res.status(400).json({ success: false, error: 'decision doit être APPROVED ou REJECTED' });
    }

    const existing = await prisma.adhesionRequest.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Demande introuvable' });
    }

    const updated = await prisma.adhesionRequest.update({
      where: { id },
      data: {
        status: decision,
        decisionReason: reason || null,
        processedBy: req.user?.email || req.user?.id || 'SYSTEM',
        processedAt: new Date()
      }
    });

    if (decision === 'APPROVED') {
      const alreadyMember = await prisma.members.findFirst({
        where: {
          email: {
            equals: existing.email,
            mode: 'insensitive'
          }
        }
      });

      if (!alreadyMember) {
        await prisma.members.create({
          data: {
            id: uid(),
            firstName: existing.firstName,
            lastName: existing.lastName,
            email: existing.email,
            phone: existing.phone || null,
            membershipType: 'STANDARD',
            membershipStatus: 'PENDING',
            notes: `Créé depuis demande d'adhésion. Candidature: ${existing.candidature}`,
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        }).catch((e) => {
          console.warn('⚠️ Unable to auto-create member after approval:', e.message);
        });
      }
    }

    await ensureCandidateMailbackTemplate();
    const decisionLabel = decision === 'APPROVED' ? 'Adhésion acceptée' : 'Adhésion non retenue';
    const reasonText = reason || 'Aucun motif communiqué.';
    const mailSent = await sendTemplatedEmail('mailback_candidat', existing.email, {
      candidate: {
        firstName: existing.firstName,
        lastName: existing.lastName,
        email: existing.email
      },
      decisionLabel,
      reasonText
    }, 'RétroBus Essonne - Gestion RH');

    return res.json({ success: true, request: updated, mailSent });
  } catch (error) {
    console.error('❌ /api/adhesion-requests/:id/decision error:', error.message);
    return res.status(500).json({ success: false, error: 'Impossible de traiter la décision d\'adhésion' });
  }
});

app.get(['/api/members','/members'], requireAuth, async (req, res) => {
  try {
    const limit = Number(req.query.limit) || undefined;
    console.log('📍 GET /api/members - fetching with limit:', limit);
    const members = await prisma.members.findMany({ take: limit });
    console.log('✅ Found members:', members.length);
    return res.json({ members });
  } catch (e) {
    console.error('❌ Error fetching members:', e.message);
    console.error('❌ Prisma error details:', e);
    res.status(500).json({ error: 'Failed to fetch members', details: e.message });
  }
});
app.get(['/api/members/me'], requireAuth, async (req, res) => {
  try {
    const userId = String(req.user?.userId || req.user?.id || '').trim();
    const userEmail = String(req.user?.email || '').trim().toLowerCase();
    const username = String(req.user?.username || '').trim();

    let member = await prisma.members.findFirst({
      where: {
        OR: [
          ...(userId ? [{ id: userId }] : []),
          ...(userEmail ? [{ email: { equals: userEmail, mode: 'insensitive' } }] : []),
          ...(username ? [{ matricule: { equals: username, mode: 'insensitive' } }] : [])
        ]
      }
    });

    if (!member) {
      // Fallback historique: données en mémoire locale
      member = state.members.find((mem) => String(mem.email || '').toLowerCase() === userEmail) || null;
    }

    if (!member) {
      return res.json({ member: null });
    }

    const { signatureHistory, latestSignature } = await buildMemberSignaturePayload(member);

    return res.json({
      member: {
        ...member,
        signatureHistory,
        latestSignature
      }
    });
  } catch (e) {
    console.error('❌ Error fetching current member profile:', e.message);
    return res.status(500).json({ error: 'Failed to fetch member profile', details: e.message });
  }
});

app.put(['/api/members/me'], requireAuth, async (req, res) => {
  try {
    // Trouver le membre connecté de façon robuste (id token > email > matricule)
    const userId = String(req.user?.userId || req.user?.id || '').trim();
    const userEmail = String(req.user?.email || '').trim().toLowerCase();
    const username = String(req.user?.username || '').trim();
    const currentMember = await prisma.members.findFirst({
      where: {
        OR: [
          ...(userId ? [{ id: userId }] : []),
          ...(userEmail ? [{ email: { equals: userEmail, mode: 'insensitive' } }] : []),
          ...(username ? [{ matricule: { equals: username, mode: 'insensitive' } }] : [])
        ]
      }
    });

    if (!currentMember) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Préparer les données avec conversion des dates
    const data = prepareMemberData(req.body, true);
    
    // Mettre à jour le membre
    const updatedMember = await prisma.members.update({
      where: { id: currentMember.id },
      data
    });

    // Mise à jour du state
    const stateIdx = state.members.findIndex(m => m.id === currentMember.id);
    if (stateIdx !== -1) state.members[stateIdx] = updatedMember;
    
    debouncedSave();
    console.log(`✅ Profil adhérent ${currentMember.id} mis à jour par lui-même`);
    res.json({ member: updatedMember });
  } catch (e) {
    console.error('❌ Error updating own member profile:', e.message);
    res.status(500).json({ error: 'Failed to update profile', details: e.message });
  }
});

app.post(['/api/members','/members'], requireAuth, async (req, res) => {
  try {
    const data = {
      id: uid(),
      ...prepareMemberData(req.body, false)
    };
    
    const member = await prisma.members.create({ data });
    state.members.push(member);
    debouncedSave();
    console.log(`✅ Adhérent créé: ${member.id} - ${member.firstName} ${member.lastName}`);
    res.status(201).json({ member });
  } catch (e) {
    console.error('❌ Error creating member:', e.message);
    
    // Gestion des erreurs Prisma spécifiques
    if (e.code === 'P2002') {
      const field = e.meta?.target?.[0] || 'champ';
      return res.status(409).json({ 
        error: 'Conflit de données', 
        details: `Un adhérent avec cet ${field} existe déjà.`,
        field 
      });
    }
    
    res.status(500).json({ error: 'Failed to create member', details: e.message });
  }
});
app.put(['/api/members','/members'], requireAuth, async (req, res) => {
  try {
    const { id } = req.body;
    const data = prepareMemberData(req.body, true);
    
    const member = await prisma.members.update({
      where: { id },
      data
    });
    const stateIdx = state.members.findIndex(m => m.id === id);
    if (stateIdx !== -1) state.members[stateIdx] = member;
    debouncedSave();
    console.log(`✅ Adhérent ${id} modifié et sauvegardé`);
    res.json({ member });
  } catch (e) {
    console.error('❌ Error updating member:', e.message);
    res.status(500).json({ error: 'Failed to update member', details: e.message });
  }
});
app.patch(['/api/members','/members'], requireAuth, async (req, res) => {
  try {
    const { id } = req.body;
    const data = prepareMemberData(req.body, true);
    
    const member = await prisma.members.update({
      where: { id },
      data
    });
    const stateIdx = state.members.findIndex(m => m.id === id);
    if (stateIdx !== -1) state.members[stateIdx] = member;
    debouncedSave();
    console.log(`✅ Adhérent ${id} patchié et sauvegardé`);
    res.json({ member });
  } catch (e) {
    console.error('❌ Error patching member:', e.message);
    res.status(500).json({ error: 'Failed to patch member', details: e.message });
  }
});
app.delete(['/api/members','/members'], requireAuth, async (req, res) => {
  try {
    const { id } = req.body;
    
    // Delete from Prisma (single source of truth)
    const deleted = await prisma.members.delete({
      where: { id }
    });
    
    // Also remove from state.members
    state.members = state.members.filter(m => m.id !== id);
    debouncedSave();
    
    console.log(`✅ Adhérent ${id} supprimé de Prisma et mémoire`);
    res.json({ ok: true });
  } catch (e) {
    console.error('❌ Error deleting member:', e.message);
    res.status(500).json({ error: 'Failed to delete member', details: e.message });
  }
});
app.post('/api/members/change-password', requireAuth, (req, res) => {
  res.json({ ok: true });
});
app.post('/api/members/:id/terminate', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.members.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Member not found' });
    }
    
    // Update in Prisma
    const updated = await prisma.members.update({
      where: { id },
      data: { status: 'terminated', updatedAt: new Date() }
    });
    
    // Also update in state.members
    const member = state.members.find(m => m.id === id);
    if (member) {
      member.status = 'terminated';
      member.updatedAt = new Date().toISOString();
    }
    
    debouncedSave();
    console.log(`✅ Adhérent ${id} terminé dans Prisma et mémoire`);
    res.json({ ok: true, member: updated });
  } catch (e) {
    console.error('❌ Error terminating member:', e.message);
    res.status(500).json({ error: 'Failed to terminate member', details: e.message });
  }
});
app.post('/api/members/:id/link-access', requireAuth, (req, res) => {
  const { id } = req.params;
  const { email, membershipType = 'STANDARD', permissions = [] } = req.body || {};
  
  // Find or create user permissions for this member
  if (!state.userPermissions) state.userPermissions = {};
  
  state.userPermissions[id] = {
    id,
    email: email || state.members.find(m => m.id === id)?.email,
    membershipType,
    permissions: Array.isArray(permissions) ? permissions : [],
    linkedAt: new Date().toISOString(),
    lastModified: new Date().toISOString()
  };
  
  debouncedSave();
  res.json({ 
    ok: true, 
    message: 'Accès lié avec succès',
    userPermissions: state.userPermissions[id]
  });
});

// GET member permissions
// MEMBERS endpoints
app.get('/api/members/:id', requireAuth, async (req, res) => {
  try {
    const member = await prisma.members.findUnique({
      where: { id: req.params.id }
    });
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }
    const { signatureHistory, latestSignature } = await buildMemberSignaturePayload(member);
    res.json({
      ...member,
      signatureHistory,
      latestSignature
    });
  } catch (e) {
    console.error('❌ Error fetching member:', e.message);
    res.status(500).json({ error: 'Failed to fetch member', details: e.message });
  }
});

// PUT /api/members/:id - Update member
app.put(['/api/members/:id', '/members/:id'], requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const data = prepareMemberData(req.body, true);
    
    // Update in Prisma
    const updatedMember = await prisma.members.update({
      where: { id },
      data
    });
    
    // Also update in state
    const stateIdx = state.members.findIndex(m => m.id === id);
    if (stateIdx !== -1) state.members[stateIdx] = updatedMember;
    
    debouncedSave();
    console.log(`✅ Adhérent ${id} mis à jour et sauvegardé`);
    res.json({ success: true, member: updatedMember });
  } catch (e) {
    console.error('❌ Error updating member:', e.message);
    res.status(500).json({ error: 'Failed to update member', details: e.message });
  }
});

// ============================================================
// 📦 STOCK ENDPOINTS
// ============================================================
const normalizeStockStatus = (quantity = 0, minQuantity = 0, fallbackStatus = 'AVAILABLE') => {
  if (fallbackStatus === 'DISCONTINUED' || fallbackStatus === 'RESERVED') return fallbackStatus;
  if (Number(quantity) <= 0) return 'OUT_OF_STOCK';
  if (Number(quantity) <= Number(minQuantity || 0)) return 'LOW_STOCK';
  return 'AVAILABLE';
};

const toNumberOrZero = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

app.get('/api/stocks', requireAuth, (req, res) => {
  try {
    const search = String(req.query.search || '').trim().toLowerCase();
    const category = String(req.query.category || 'ALL');
    const status = String(req.query.status || 'ALL');
    const lowStock = String(req.query.lowStock || 'false') === 'true';

    const source = Array.isArray(state.stock) ? state.stock : [];
    const filtered = source.filter((item) => {
      if (!item) return false;

      const haystack = [item.reference, item.name, item.description, item.location, item.supplier]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (search && !haystack.includes(search)) return false;
      if (category !== 'ALL' && item.category !== category) return false;
      if (status !== 'ALL' && (item.status || 'AVAILABLE') !== status) return false;

      if (lowStock) {
        const qty = toNumberOrZero(item.quantity);
        const minQty = toNumberOrZero(item.minQuantity);
        if (!(qty > 0 && qty <= minQty)) return false;
      }

      return true;
    });

    res.json({ stocks: filtered });
  } catch (e) {
    console.error('❌ Error fetching stocks:', e.message);
    res.status(500).json({ error: 'Failed to fetch stocks', details: e.message });
  }
});

app.get('/api/stocks/stats', requireAuth, (req, res) => {
  try {
    const source = Array.isArray(state.stock) ? state.stock : [];
    const totalItems = source.length;
    const totalQuantity = source.reduce((sum, item) => sum + toNumberOrZero(item.quantity), 0);
    const lowStockCount = source.filter((item) => {
      const qty = toNumberOrZero(item.quantity);
      const minQty = toNumberOrZero(item.minQuantity);
      return qty > 0 && qty <= minQty;
    }).length;
    const outOfStockCount = source.filter((item) => toNumberOrZero(item.quantity) <= 0).length;

    res.json({ totalItems, totalQuantity, lowStockCount, outOfStockCount });
  } catch (e) {
    console.error('❌ Error fetching stock stats:', e.message);
    res.status(500).json({ error: 'Failed to fetch stock stats', details: e.message });
  }
});

app.post('/api/stocks', requireAuth, (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.name || !String(payload.name).trim()) {
      return res.status(400).json({ error: 'name is required' });
    }

    const quantity = toNumberOrZero(payload.quantity);
    const minQuantity = toNumberOrZero(payload.minQuantity);
    const stock = {
      id: uid(),
      reference: payload.reference || '',
      name: payload.name,
      description: payload.description || '',
      category: payload.category || 'GENERAL',
      subcategory: payload.subcategory || '',
      quantity,
      minQuantity,
      unit: payload.unit || 'PIECE',
      location: payload.location || '',
      supplier: payload.supplier || '',
      purchasePrice: toNumberOrZero(payload.purchasePrice),
      salePrice: toNumberOrZero(payload.salePrice),
      notes: payload.notes || '',
      status: normalizeStockStatus(quantity, minQuantity, payload.status),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: req.user?.email || 'system'
    };

    if (!Array.isArray(state.stock)) state.stock = [];
    state.stock.unshift(stock);
    debouncedSave();
    res.status(201).json({ stock });
  } catch (e) {
    console.error('❌ Error creating stock:', e.message);
    res.status(500).json({ error: 'Failed to create stock', details: e.message });
  }
});

app.put('/api/stocks/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const idx = Array.isArray(state.stock) ? state.stock.findIndex((s) => s.id === id) : -1;
    if (idx === -1) return res.status(404).json({ error: 'Stock not found' });

    const prev = state.stock[idx];
    const payload = req.body || {};
    const quantity = payload.quantity !== undefined ? toNumberOrZero(payload.quantity) : toNumberOrZero(prev.quantity);
    const minQuantity = payload.minQuantity !== undefined ? toNumberOrZero(payload.minQuantity) : toNumberOrZero(prev.minQuantity);

    const updated = {
      ...prev,
      ...payload,
      quantity,
      minQuantity,
      purchasePrice: payload.purchasePrice !== undefined ? toNumberOrZero(payload.purchasePrice) : prev.purchasePrice,
      salePrice: payload.salePrice !== undefined ? toNumberOrZero(payload.salePrice) : prev.salePrice,
      status: normalizeStockStatus(quantity, minQuantity, payload.status || prev.status),
      updatedAt: new Date().toISOString(),
      updatedBy: req.user?.email || 'system'
    };

    state.stock[idx] = updated;
    debouncedSave();
    res.json({ stock: updated });
  } catch (e) {
    console.error('❌ Error updating stock:', e.message);
    res.status(500).json({ error: 'Failed to update stock', details: e.message });
  }
});

app.delete('/api/stocks/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const before = Array.isArray(state.stock) ? state.stock.length : 0;
    state.stock = (state.stock || []).filter((s) => s.id !== id);
    state.stockMovements = (state.stockMovements || []).filter((m) => m.stockId !== id);
    if (state.stock.length === before) return res.status(404).json({ error: 'Stock not found' });

    debouncedSave();
    res.json({ ok: true });
  } catch (e) {
    console.error('❌ Error deleting stock:', e.message);
    res.status(500).json({ error: 'Failed to delete stock', details: e.message });
  }
});

app.post('/api/stocks/:id/movement', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const stock = (state.stock || []).find((s) => s.id === id);
    if (!stock) return res.status(404).json({ error: 'Stock not found' });

    const payload = req.body || {};
    const movementQty = toNumberOrZero(payload.quantity);
    if (movementQty <= 0) return res.status(400).json({ error: 'quantity must be > 0' });

    const type = payload.type === 'OUT' ? 'OUT' : 'IN';
    const currentQty = toNumberOrZero(stock.quantity);
    let nextQty = type === 'OUT' ? currentQty - movementQty : currentQty + movementQty;
    if (nextQty < 0) {
      return res.status(400).json({ error: 'Stock insuffisant pour ce mouvement' });
    }

    stock.quantity = nextQty;
    stock.status = normalizeStockStatus(nextQty, stock.minQuantity, stock.status);
    stock.updatedAt = new Date().toISOString();
    stock.updatedBy = req.user?.email || 'system';

    const movement = {
      id: uid(),
      stockId: id,
      type,
      quantity: movementQty,
      reason: payload.reason || '',
      notes: payload.notes || '',
      createdAt: new Date().toISOString(),
      createdBy: req.user?.email || 'system'
    };

    if (!Array.isArray(state.stockMovements)) state.stockMovements = [];
    state.stockMovements.unshift(movement);

    debouncedSave();
    res.status(201).json({ movement, stock });
  } catch (e) {
    console.error('❌ Error creating stock movement:', e.message);
    res.status(500).json({ error: 'Failed to create stock movement', details: e.message });
  }
});

app.get('/api/members/:id/permissions', requireAuth, (req, res) => {
  const { id } = req.params;
  const member = state.members.find(m => m.id === id);
  if (!member) return res.status(404).json({ error: 'Member not found' });
  
  const userPerms = state.userPermissions?.[id] || {
    id,
    email: member.email,
    membershipType: member.membershipType || 'STANDARD',
    permissions: member.permissions || [],
    linkedAt: member.createdAt,
    lastModified: new Date().toISOString()
  };
  
  res.json(userPerms);
});

// PUT update member permissions
// ✅ NOW USING PRISMA
app.put('/api/members/:id/permissions', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { permissions = [], membershipType } = req.body || {};
    
    // Update member permissions in Prisma
    const member = await prisma.members.update({
      where: { id },
      data: {
        permissions: Array.isArray(permissions) ? permissions : [],
        membershipType: membershipType || undefined
      }
    });
    
    res.json({ 
      ok: true, 
      message: 'Permissions mises à jour',
      member
    });
  } catch (e) {
    console.error('❌ Error updating member permissions:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST add permission to member
// ✅ NOW USING PRISMA
app.post('/api/members/:id/permissions', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { permission } = req.body || {};
    
    if (!permission) return res.status(400).json({ error: 'Permission required' });
    
    // Get current permissions
    const member = await prisma.members.findUnique({
      where: { id },
      select: { permissions: true }
    });
    
    if (!member) return res.status(404).json({ error: 'Member not found' });
    
    const currentPerms = member.permissions || [];
    const newPerms = Array.isArray(currentPerms) ? [...currentPerms] : [];
    
    // Add new permission if not already exists
    if (!newPerms.includes(permission)) {
      newPerms.push(permission);
    }
    
    // Update member
    const updated = await prisma.members.update({
      where: { id },
      data: { permissions: newPerms }
    });
    
    res.json({ 
      ok: true, 
      message: 'Permission ajoutée',
      member: updated
    });
  } catch (e) {
    console.error('❌ Error adding permission:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// DELETE permission from member
// ✅ NOW USING PRISMA
app.delete('/api/members/:id/permissions/:permission', requireAuth, async (req, res) => {
  try {
    const { id, permission } = req.params;
    
    // Get current permissions
    const member = await prisma.members.findUnique({
      where: { id },
      select: { permissions: true }
    });
    
    if (!member) return res.status(404).json({ error: 'Member not found' });
    
    const currentPerms = member.permissions || [];
    const newPerms = currentPerms.filter(p => p !== permission);
    
    // Update member
    const updated = await prisma.members.update({
      where: { id },
      data: { permissions: newPerms }
    });
    
    res.json({ 
      ok: true, 
      message: 'Permission supprimée',
      member: updated
    });
  } catch (e) {
    console.error('❌ Error deleting permission:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// PERMISSIONS ENDPOINT - Lookup user role and permissions by memberId or userId
// ✅ NOW USING PRISMA - Get permissions from members.permissions + user_permissions table
// Cache en mémoire pour les permissions (1 minute)
const permissionsCache = new Map();
const PERMISSIONS_CACHE_TTL = 60000; // 1 minute

app.get('/api/user-permissions/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Vérifier le cache d'abord
    const cacheKey = `perms_${userId}`;
    const cached = permissionsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < PERMISSIONS_CACHE_TTL) {
      return res.json(cached.data);
    }
    
    // Try to find member first (userId might be memberId)
    const member = await prisma.members.findFirst({
      where: {
        OR: [
          { id: userId },
          { email: userId }
        ]
      },
      select: {
        id: true,
        email: true,
        permissions: true
      }
    });
    
    if (!member) {
      const emptyResponse = { permissions: [], role: 'MEMBER', success: true };
      permissionsCache.set(cacheKey, { data: emptyResponse, timestamp: Date.now() });
      return res.json(emptyResponse);
    }
    
    // Convert member permissions JSON format to standard format
    let convertedPermissions = [];
    
    if (member.permissions && typeof member.permissions === 'object') {
      const blockedList = member.permissions.blockedResources || member.permissions.deniedResources || [];
      
      if (member.permissions.restrictiveMode && Array.isArray(blockedList)) {
        convertedPermissions = blockedList.map(resource => ({
          resource,
          actions: ['DENY'],
          reason: 'Restrictive mode enabled'
        }));
      }
    }
    
    // Load permissions from user_permissions table (lookup via linkedMemberId)
    const siteUser = await prisma.site_users.findFirst({
      where: { linkedMemberId: member.id },
      select: { id: true, role: true }
    });
    const siteUserId = siteUser?.id;
    
    const dbPermissions = siteUserId 
      ? await prisma.user_permissions.findMany({
          where: { userId: siteUserId },
          select: {
            resource: true,
            actions: true,
            reason: true
          }
        })
      : [];
    
    // Merge permissions: converted JSON + database table permissions
    const allPermissions = [
      ...convertedPermissions,
      ...dbPermissions
    ];
    
    const role = 'MEMBER';
    
    const response = { 
      permissions: allPermissions,
      success: true,
      role, 
      memberId: member.id,
      email: member.email
    };
    
    // Mettre en cache
    permissionsCache.set(cacheKey, { data: response, timestamp: Date.now() });
    
    res.json(response);
  } catch (e) {
    console.error('❌ Error in /api/user-permissions:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET all user permissions (admin endpoint)
app.get('/api/user-permissions', requireAuth, async (req, res) => {
  try {
    const allMembers = await prisma.members.findMany({
      select: { id: true, email: true, firstName: true, lastName: true, permissions: true }
    });
    
    res.json(allMembers);
  } catch (e) {
    console.error('❌ Error fetching all user permissions:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// DOCUMENTS
app.get(['/api/documents'], requireAuth, (req, res) => {
  res.json(state.documents || []);
});

app.post(['/api/documents'], requireAuth, (req, res) => {
  const { title, description, category, file } = req.body;
  const doc = {
    id: uid(),
    title: title || 'Document',
    description: description || '',
    category: category || 'Autres',
    file: file || '',
    createdBy: req.user?.name || req.user?.email || 'Anonymous',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'active'
  };
  state.documents = state.documents || [];
  state.documents.push(doc);
  debouncedSave();
  res.status(201).json(doc);
});

app.get('/api/documents/member/:memberId', requireAuth, async (req, res) => {
  try {
    const documents = await prisma.document.findMany({
      where: { memberId: req.params.memberId }
    });
    res.json({ documents });
  } catch (e) {
    console.error('❌ Error fetching documents:', e.message);
    res.status(500).json({ error: e.message });
  }
});
app.delete('/api/documents/:id', requireAuth, (req, res) => {
  state.documents = state.documents.filter(d => d.id !== req.params.id);
  debouncedSave();
  res.json({ ok: true });
});
app.put('/api/documents/:id/status', requireAuth, (req, res) => {
  const { id } = req.params; const { status } = req.body;
  state.documents = state.documents.map(d => d.id === id ? { ...d, status } : d);
  const doc = state.documents.find(d => d.id === id);
  debouncedSave();
  res.json({ document: doc });
});
app.get('/api/documents/expiring', requireAuth, (req, res) => {
  const days = Number(req.query.days || 60);
  const now = Date.now();
  const soon = state.documents.filter(d => d.expiresAt && (new Date(d.expiresAt).getTime() - now) < days*86400000);
  res.json({ documents: soon });
});
app.get('/api/documents/:id/download', requireAuth, (req, res) => {
  res.status(404).json({ error: 'Not implemented file storage' });
});

// MEMBER DOCUMENTS - NEW ENDPOINTS FOR ADHESION BULLETINS
// GET /api/members/:memberId/documents - Fetch all documents for a member
app.get('/api/members/:memberId/documents', requireAuth, async (req, res) => {
  try {
    const { memberId } = req.params;
    console.log(`📄 Fetching documents for member: ${memberId}`);
    
    const documents = await prisma.document.findMany({
      where: { memberId: memberId },
      orderBy: { uploadedAt: 'desc' }
    });
    
    console.log(`✅ Found ${documents.length} documents for member ${memberId}`);
    res.json({ documents });
  } catch (e) {
    console.error(`❌ Error fetching documents for member ${req.params.memberId}:`, e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/members/:memberId/documents - Upload a new document for a member
app.post('/api/members/:memberId/documents', requireAuth, async (req, res) => {
  try {
    const { memberId } = req.params;
    const { fileName, fileType, fileData } = req.body;
    
    console.log(`📤 Uploading document for member ${memberId}: ${fileName}`);
    
    if (!fileName || !fileData) {
      return res.status(400).json({ error: 'fileName and fileData are required' });
    }
    
    // Calculate file size from base64
    const fileSize = Math.ceil((fileData.length * 3) / 4);
    
    const document = await prisma.document.create({
      data: {
        id: uid(),
        memberId: memberId,
        fileName: fileName,
        filePath: fileData, // Store base64 data in filePath
        fileSize: fileSize,
        mimeType: fileType || 'application/pdf',
        type: 'MEMBERSHIP_FORM',
        status: 'PENDING',
        uploadedAt: new Date(),
        reviewedBy: req.user?.email || null
      }
    });
    
    console.log(`✅ Document uploaded successfully: ${document.id}`);
    res.status(201).json({ document });
  } catch (e) {
    console.error(`❌ Error uploading document for member ${req.params.memberId}:`, e.message);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/documents/:documentId - Delete a document
app.delete('/api/documents/:documentId', requireAuth, async (req, res) => {
  try {
    const { documentId } = req.params;
    console.log(`🗑️ Deleting document: ${documentId}`);
    
    const document = await prisma.document.delete({
      where: { id: documentId }
    });
    
    console.log(`✅ Document deleted successfully: ${documentId}`);
    res.json({ ok: true, document });
  } catch (e) {
    if (e.code === 'P2025') {
      return res.status(404).json({ error: 'Document not found' });
    }
    console.error(`❌ Error deleting document ${req.params.documentId}:`, e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/documents/:documentId/download - Download a document
app.get('/api/documents/:documentId/download', requireAuth, async (req, res) => {
  try {
    const { documentId } = req.params;
    console.log(`📥 Downloading document: ${documentId}`);
    
    const document = await prisma.document.findUnique({
      where: { id: documentId }
    });
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Set proper headers for file download
    res.set('Content-Type', document.mimeType || 'application/octet-stream');
    res.set('Content-Disposition', `attachment; filename="${document.fileName}"`);
    
    // Send the file data (base64 decoded)
    if (document.filePath) {
      const buffer = Buffer.from(document.filePath, 'base64');
      res.send(buffer);
    } else {
      res.status(404).json({ error: 'No file data available' });
    }
  } catch (e) {
    console.error(`❌ Error downloading document ${req.params.documentId}:`, e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/helloasso/metadata - Extraction fiable des métadonnées HelloAsso (côté serveur)
app.get(['/helloasso/metadata', '/api/helloasso/metadata'], requireAuth, async (req, res) => {
  try {
    const ticketUrl = (req.query.ticketUrl || '').toString().trim();
    const integrationUrl = (req.query.integrationUrl || '').toString().trim();

    if (!ticketUrl || !integrationUrl) {
      return res.status(400).json({ error: 'ticketUrl and integrationUrl are required' });
    }

    const normalizedTicketUrl = ticketUrl
      .replace('/widget-bouton', '')
      .replace('/widget', '')
      .replace(/\/+$/, '');

    const safeUrl = normalizedTicketUrl.startsWith('http') ? normalizedTicketUrl : `https://${normalizedTicketUrl}`;
    const jinaUrl = `https://r.jina.ai/http://${safeUrl.replace(/^https?:\/\//, '')}`;

    const response = await fetch(jinaUrl, { method: 'GET' });
    if (!response.ok) {
      return res.status(502).json({ error: `Failed to fetch HelloAsso page (${response.status})` });
    }

    const text = await response.text();

    let title = '';
    let date = '';
    let time = '';
    let location = '';
    let adultPrice = null;

    const titleMatch = text.match(/#\s+([^\n]+)\n\s*##\s+par\s+/i);
    if (titleMatch?.[1]) title = titleMatch[1].trim();

    const dateTimeMatch = text.match(/Le\s+(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4}),\s+de\s+(\d{1,2})h(?:\s*(\d{2})?)?/i);
    if (dateTimeMatch) {
      const months = {
        janvier: '01', février: '02', mars: '03', avril: '04', mai: '05', juin: '06',
        juillet: '07', août: '08', septembre: '09', octobre: '10', novembre: '11', décembre: '12'
      };
      const day = dateTimeMatch[1].padStart(2, '0');
      const month = months[dateTimeMatch[2].toLowerCase()];
      const year = dateTimeMatch[3];
      date = `${year}-${month}-${day}`;
      time = `${String(dateTimeMatch[4]).padStart(2, '0')}:${dateTimeMatch[5] ? dateTimeMatch[5] : '00'}`;
    }

    const locationMatch = text.match(/\n\s*([^\n]{3,80})\n\s*France\b/i);
    if (locationMatch?.[1]) {
      const candidate = locationMatch[1].trim();
      const blocked = ['helloasso', 'paiement sécurisé', 'pourquoi soutenir', 'contactez'];
      if (!blocked.some((x) => candidate.toLowerCase().includes(x))) {
        location = candidate;
      }
    }

    const priceMatch = text.match(/(?:\n|\s)(\d+)(?:,\d+)?€(?:\n|\s)/);
    if (priceMatch?.[1]) {
      adultPrice = Number(priceMatch[1]);
    }

    // Fallback sur le slug si le titre n'est pas trouvé
    if (!title) {
      const slugMatch = safeUrl.match(/\/evenements\/([^\/?#]+)/i);
      if (slugMatch?.[1]) {
        title = slugMatch[1]
          .split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }
    }

    return res.json({
      ok: true,
      source: 'server-jina',
      metadata: {
        title,
        date,
        time,
        location,
        adultPrice,
      },
    });
  } catch (e) {
    console.error('❌ GET /api/helloasso/metadata error:', e.message);
    return res.status(500).json({ error: 'Failed to extract HelloAsso metadata', details: e.message });
  }
});

// EVENTS - PRISMA avec fallback optionnel
app.get(['/events', '/api/events'], requireAuth, async (req, res) => {
  try {
    const { month, year } = req.query;
    let where = {};

    if (month !== undefined && year !== undefined) {
      const monthNum = parseInt(month);
      const yearNum = parseInt(year);
      
      const startDate = new Date(yearNum, monthNum, 1);
      const endDate = new Date(yearNum, monthNum + 1, 0);
      
      where = {
        date: {
          gte: startDate,
          lte: endDate
        }
      };
    }

    const events = await prisma.event.findMany({
      where,
      orderBy: { date: 'asc' }
    });

    res.json({
      success: true,
      data: events
    });
  } catch (e) {
    console.error('❌ GET /events error:', e.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch events', 
      details: e.message 
    });
  }
});

app.get(['/events/:id', '/api/events/:id'], requireAuth, async (req, res) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json({ event: normalizeEventExtras(event) });
  } catch (e) {
    console.error('❌ GET /events/:id error:', e.message);
    res.status(500).json({ error: 'Failed to fetch event', details: e.message });
  }
});

// VEHICLES - PRISMA avec fallback optionnel
app.get(['/vehicles', '/api/vehicles'], requireAuth, async (req, res) => {
  if (prisma) {
    try {
      const vehicles = await prisma.vehicle.findMany({
        orderBy: { parc: 'asc' },
        select: {
          id: true,
          parc: true,
          type: true,
          modele: true,
          marque: true,
          immat: true,
          etat: true,
          miseEnCirculation: true,
          thumbnailImage: true,
        },
      });

      return res.json(vehicles);
    } catch (e) {
      console.error('❌ GET /vehicles error:', e.message);
      return res.status(500).json({ error: 'Failed to fetch vehicles', details: e.message });
    }
  }
  res.status(503).json({ error: 'Prisma unavailable' });
});

app.post(['/vehicles', '/api/vehicles'], requireAuth, async (req, res) => {
  try {
    const { parc, type, modele, marque, subtitle, immat, etat, miseEnCirculation, energie, description, history, caracteristiques, gallery, backgroundImage, backgroundPosition, isPublic, fuel, mileage } = req.body;
    
    if (!parc) {
      return res.status(400).json({ error: 'Parc number is required' });
    }
    
    // Check if vehicle already exists
    const existing = await prisma.vehicle.findUnique({
      where: { parc }
    });
    
    if (existing) {
      return res.status(409).json({ error: 'Vehicle with this parc number already exists' });
    }
    
    // Create vehicle in Prisma
    const vehicle = await prisma.vehicle.create({
      data: {
        parc,
        type: type || 'Véhicule',
        modele: modele || '',
        marque: marque || null,
        subtitle: subtitle || null,
        immat: immat || null,
        etat: etat || 'actif',
        miseEnCirculation: miseEnCirculation ? new Date(miseEnCirculation) : null,
        energie: energie || null,
        description: description || null,
        history: history || null,
        caracteristiques: caracteristiques && Array.isArray(caracteristiques) ? JSON.stringify(caracteristiques) : (caracteristiques ? caracteristiques : null),
        gallery: gallery && Array.isArray(gallery) ? JSON.stringify(gallery) : (gallery ? gallery : null),
        backgroundImage: backgroundImage || null,
        backgroundPosition: backgroundPosition || null,
        isPublic: isPublic || false,
        fuel: fuel ? parseFloat(fuel) : null,
        mileage: mileage ? parseFloat(mileage) : null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    
    // Also add to state for in-memory access
    state.vehicles.push(vehicle);
    debouncedSave();
    
    const normalized = normalizeVehicleWithCaracteristiques(vehicle);
    console.log(`✅ Vehicle créé: ${parc}`);
    res.status(201).json({ vehicle: normalized });
  } catch (e) {
    console.error('❌ POST /vehicles error:', e.message);
    res.status(500).json({ error: 'Failed to create vehicle', details: e.message });
  }
});

app.get(['/vehicles/:parc', '/api/vehicles/:parc'], requireAuth, async (req, res) => {
  try {
    const idCandidate = Number(req.params.parc);
    const filters = [{ parc: req.params.parc }];
    if (!Number.isNaN(idCandidate)) {
      filters.push({ id: idCandidate });
    }
    const vehicle = await prisma.vehicle.findFirst({ where: { OR: filters } });
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    const normalized = normalizeVehicleWithCaracteristiques(vehicle);
    res.json({ vehicle: normalized });
  } catch (e) {
    console.error('❌ GET /vehicles/:parc error:', e.message);
    res.status(500).json({ error: 'Failed to fetch vehicle', details: e.message });
  }
});

app.delete(['/vehicles/:parc', '/api/vehicles/:parc'], requireAuth, async (req, res) => {
  try {
    const parc = req.params.parc;
    
    // Find vehicle by parc or id
    const idCandidate = Number(parc);
    const filters = [{ parc }];
    if (!Number.isNaN(idCandidate)) {
      filters.push({ id: idCandidate });
    }
    
    const existing = await prisma.vehicle.findFirst({ where: { OR: filters } });
    if (!existing) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    
    // Delete from Prisma
    await prisma.vehicle.delete({
      where: { id: existing.id }
    });
    
    // Also remove from state
    state.vehicles = state.vehicles.filter(v => v.id !== existing.id);
    debouncedSave();
    
    console.log(`✅ Vehicle ${parc} supprimé`);
    res.json({ ok: true });
  } catch (e) {
    console.error('❌ DELETE /vehicles/:parc error:', e.message);
    res.status(500).json({ error: 'Failed to delete vehicle', details: e.message });
  }
});

// EVENTS CRUD - PRISMA avec fallback
app.post(['/events', '/api/events'], requireAuth, async (req, res) => {
  try {
    const basePayload = {
      id: uid(),
      title: req.body.title || 'Nouvel événement',
      description: req.body.description,
      date: req.body.date ? new Date(req.body.date) : new Date(),
      time: req.body.time || null,
      location: req.body.location || null,
      helloAssoUrl: req.body.helloAssoUrl || null,
      adultPrice: req.body.adultPrice ? parseFloat(req.body.adultPrice) : null,
      childPrice: req.body.childPrice ? parseFloat(req.body.childPrice) : null,
      status: req.body.status || 'DRAFT',
      updatedAt: new Date(),
      vehicleId: req.body.vehicleId || null,
      maxParticipants: req.body.maxParticipants ? parseInt(req.body.maxParticipants) : null,
      currentParticipants: 0
    };

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'extras')) {
      const extrasValue = normalizeExtrasValue(req.body.extras);
      if (extrasValue !== undefined) {
        basePayload.extras = extrasValue;
      }
    }

    const event = await prisma.event.create({ data: basePayload });
    console.log('✅ Event créé:', event.id, event.title);
    res.status(201).json({ event, source: 'prisma' });
  } catch (e) {
    console.error('❌ POST /events error:', e.message);
    res.status(500).json({ error: 'Failed to create event', details: e.message });
  }
});

app.put(['/events/:id', '/api/events/:id'], requireAuth, async (req, res) => {
  try {
    console.log('🔧 PUT /events/:id - req.body:', JSON.stringify(req.body, null, 2));
    const prismaData = buildPrismaEventUpdateData(req.body || {});
    console.log('🔧 prismaData:', JSON.stringify(prismaData, null, 2));
    
    if (Object.keys(prismaData).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const event = await prisma.event.update({
      where: { id: req.params.id },
      data: prismaData
    });
    console.log('✅ Event modifié:', event.id, event.title);
    res.json({ event, source: 'prisma' });
  } catch (e) {
    console.error('❌ PUT /events/:id error:', e.message);
    console.error('❌ Stack:', e.stack);
    if (e?.code === 'P2025') {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.status(500).json({ error: 'Failed to update event', details: e.message });
  }
});

app.delete(['/events/:id', '/api/events/:id'], requireAuth, async (req, res) => {
  try {
    await prisma.event.delete({
      where: { id: req.params.id }
    });
    console.log('✅ Event supprimé:', req.params.id);
    res.json({ ok: true });
  } catch (e) {
    console.error('❌ DELETE /events/:id error:', e.message);
    if (e?.code === 'P2025') {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.status(500).json({ error: 'Failed to delete event', details: e.message });
  }
});

// ============================================
// PARTICIPANTS ENDPOINTS (événement-spécifiques)
// ============================================
app.get(['/events/:id/participants', '/api/events/:id/participants'], requireAuth, async (req, res) => {
  try {
    const participants = await prisma.participant.findMany({
      where: { eventId: req.params.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ participants });
  } catch (e) {
    console.error('❌ GET /events/:id/participants error:', e.message);
    res.status(500).json({ error: 'Failed to fetch participants', details: e.message });
  }
});

app.post(['/events/:id/participants', '/api/events/:id/participants'], requireAuth, async (req, res) => {
  try {
    const participant = await prisma.participant.create({
      data: {
        ...req.body,
        eventId: req.params.id
      }
    });
    console.log('✅ Participant créé:', participant.id);
    res.status(201).json(participant);
  } catch (e) {
    console.error('❌ POST /events/:id/participants error:', e.message);
    res.status(500).json({ error: 'Failed to create participant', details: e.message });
  }
});

app.put(['/events/:id/participants/:participantId', '/api/events/:id/participants/:participantId'], requireAuth, async (req, res) => {
  try {
    const participant = await prisma.participant.update({
      where: { id: req.params.participantId },
      data: req.body
    });
    console.log('✅ Participant modifié:', participant.id);
    res.json(participant);
  } catch (e) {
    console.error('❌ PUT /events/:id/participants/:participantId error:', e.message);
    if (e?.code === 'P2025') {
      return res.status(404).json({ error: 'Participant not found' });
    }
    res.status(500).json({ error: 'Failed to update participant', details: e.message });
  }
});

app.delete(['/events/:id/participants/:participantId', '/api/events/:id/participants/:participantId'], requireAuth, async (req, res) => {
  try {
    await prisma.participant.delete({
      where: { id: req.params.participantId }
    });
    console.log('✅ Participant supprimé:', req.params.participantId);
    res.json({ ok: true });
  } catch (e) {
    console.error('❌ DELETE /events/:id/participants/:participantId error:', e.message);
    if (e?.code === 'P2025') {
      return res.status(404).json({ error: 'Participant not found' });
    }
    res.status(500).json({ error: 'Failed to delete participant', details: e.message });
  }
});

// ============================================
// ROUTES/TRAJETS ENDPOINTS (événement-spécifiques)
// ============================================
app.get(['/events/:id/routes', '/api/events/:id/routes'], requireAuth, async (req, res) => {
  try {
    const routes = await prisma.route.findMany({
      where: { eventId: req.params.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ routes });
  } catch (e) {
    console.error('❌ GET /events/:id/routes error:', e.message);
    res.status(500).json({ error: 'Failed to fetch routes', details: e.message });
  }
});

app.post(['/events/:id/routes', '/api/events/:id/routes'], requireAuth, async (req, res) => {
  try {
    const route = await prisma.route.create({
      data: {
        ...req.body,
        eventId: req.params.id
      }
    });
    console.log('✅ Route créée:', route.id);
    res.status(201).json(route);
  } catch (e) {
    console.error('❌ POST /events/:id/routes error:', e.message);
    res.status(500).json({ error: 'Failed to create route', details: e.message });
  }
});

app.put(['/events/:id/routes/:routeId', '/api/events/:id/routes/:routeId'], requireAuth, async (req, res) => {
  try {
    const route = await prisma.route.update({
      where: { id: req.params.routeId },
      data: req.body
    });
    console.log('✅ Route modifiée:', route.id);
    res.json(route);
  } catch (e) {
    console.error('❌ PUT /events/:id/routes/:routeId error:', e.message);
    if (e?.code === 'P2025') {
      return res.status(404).json({ error: 'Route not found' });
    }
    res.status(500).json({ error: 'Failed to update route', details: e.message });
  }
});

app.delete(['/events/:id/routes/:routeId', '/api/events/:id/routes/:routeId'], requireAuth, async (req, res) => {
  try {
    await prisma.route.delete({
      where: { id: req.params.routeId }
    });
    console.log('✅ Route supprimée:', req.params.routeId);
    res.json({ ok: true });
  } catch (e) {
    console.error('❌ DELETE /events/:id/routes/:routeId error:', e.message);
    if (e?.code === 'P2025') {
      return res.status(404).json({ error: 'Route not found' });
    }
    res.status(500).json({ error: 'Failed to delete route', details: e.message });
  }
});

// ============================================
// TRANSACTIONS LIÉES AUX ÉVÉNEMENTS
// ============================================
app.get(['/events/:id/transactions', '/api/events/:id/transactions'], requireAuth, async (req, res) => {
  try {
    // Récupérer les transactions liées à cet événement depuis Prisma
    const transactions = await prisma.transaction.findMany({
      where: { eventId: req.params.id },
      orderBy: { date: 'desc' }
    });
    res.json({ transactions });
  } catch (e) {
    console.error('❌ GET /events/:id/transactions error:', e.message);
    res.status(500).json({ error: 'Failed to fetch transactions', details: e.message });
  }
});

app.post(['/events/:id/transactions/:transactionId', '/api/events/:id/transactions/:transactionId'], requireAuth, async (req, res) => {
  try {
    // Lier une transaction à un événement
    const tx = await prisma.transaction.update({
      where: { id: req.params.transactionId },
      data: { eventId: req.params.id }
    });
    console.log('✅ Transaction liée à événement:', req.params.transactionId);
    res.json(tx);
  } catch (e) {
    console.error('❌ POST /events/:id/transactions/:transactionId error:', e.message);
    if (e?.code === 'P2025') {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.status(500).json({ error: 'Failed to link transaction', details: e.message });
  }
});

app.delete(['/events/:id/transactions/:transactionId', '/api/events/:id/transactions/:transactionId'], requireAuth, async (req, res) => {
  try {
    // Délier une transaction d'un événement
    const tx = await prisma.transaction.update({
      where: { id: req.params.transactionId },
      data: { eventId: null }
    });
    console.log('✅ Transaction déliée d\'événement:', req.params.transactionId);
    res.json({ ok: true });
  } catch (e) {
    console.error('❌ DELETE /events/:id/transactions/:transactionId error:', e.message);
    if (e?.code === 'P2025') {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.status(500).json({ error: 'Failed to unlink transaction', details: e.message });
  }
});

// ============================================
// DISPONIBILITÉS UTILISATEUR (PLANNING INDIVIDUEL)
// ============================================
app.get(['/planning/availabilities/:userId', '/api/planning/availabilities/:userId'], requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({
        success: false,
        error: 'month and year query parameters are required'
      });
    }

    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    const availabilities = await prisma.userAvailability.findMany({
      where: {
        userId,
        month: monthNum,
        year: yearNum
      }
    });

    // Transformer en objet date => isAvailable
    const data = {};
    availabilities.forEach(av => {
      const key = `${av.year}-${av.month}-${av.day}`;
      data[key] = av.isAvailable;
    });

    res.json({
      success: true,
      data
    });
  } catch (e) {
    console.error('❌ GET /planning/availabilities/:userId error:', e.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch availabilities',
      details: e.message
    });
  }
});

app.post(['/planning/availabilities', '/api/planning/availabilities'], requireAuth, async (req, res) => {
  try {
    const { userId, month, year, availabilities } = req.body;

    if (!userId || month === undefined || year === undefined || !availabilities) {
      return res.status(400).json({
        success: false,
        error: 'userId, month, year, and availabilities are required'
      });
    }

    // Supprimer les disponibilités existantes pour ce mois
    await prisma.userAvailability.deleteMany({
      where: {
        userId,
        month: parseInt(month),
        year: parseInt(year)
      }
    });

    // Créer les nouvelles disponibilités
    const created = [];
    for (const [key, isAvailable] of Object.entries(availabilities)) {
      // key est au format YYYY-MM-DD
      const [y, m, d] = key.split('-').map(Number);
      
      const availability = await prisma.userAvailability.create({
        data: {
          id: `${userId}-${key}`,
          userId,
          year: y,
          month: m,
          day: d,
          isAvailable
        }
      });
      created.push(availability);
    }

    res.json({
      success: true,
      data: created,
      message: `${created.length} availabilities saved`
    });
  } catch (e) {
    console.error('❌ POST /planning/availabilities error:', e.message);
    if (e.code === 'P2002') {
      // Violation de contrainte unique
      return res.status(400).json({
        success: false,
        error: 'Some availabilities already exist for this period'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to save availabilities',
      details: e.message
    });
  }
});

// ============================================
// EVENT INVITATIONS
// ============================================
app.get(['/events/:eventId/invitations', '/api/events/:eventId/invitations'], requireAuth, async (req, res) => {
  try {
    const invitations = await prisma.eventInvitation.findMany({
      where: { eventId: req.params.eventId }
    });
    res.json({
      success: true,
      data: invitations
    });
  } catch (e) {
    console.error('❌ GET /events/:eventId/invitations error:', e.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch invitations',
      details: e.message
    });
  }
});

app.post(['/events/:eventId/invite', '/api/events/:eventId/invite'], requireAuth, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userIds } = req.body;

    if (!userIds || !Array.isArray(userIds)) {
      return res.status(400).json({
        success: false,
        error: 'userIds array is required'
      });
    }

    const invitations = [];
    for (const userId of userIds) {
      const invitation = await prisma.eventInvitation.upsert({
        where: {
          eventId_userId: {
            eventId,
            userId
          }
        },
        update: { status: 'PENDING' },
        create: {
          eventId,
          userId,
          status: 'PENDING'
        }
      });
      invitations.push(invitation);
    }

    res.json({
      success: true,
      data: invitations,
      message: `${invitations.length} users invited`
    });
  } catch (e) {
    console.error('❌ POST /events/:eventId/invite error:', e.message);
    res.status(500).json({
      success: false,
      error: 'Failed to invite users',
      details: e.message
    });
  }
});

app.put(['/invitations/:invitationId/status', '/api/invitations/:invitationId/status'], requireAuth, async (req, res) => {
  try {
    const { status } = req.body;

    if (!['PENDING', 'ACCEPTED', 'DECLINED', 'MAYBE'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    const invitation = await prisma.eventInvitation.update({
      where: { id: req.params.invitationId },
      data: { status }
    });

    res.json({
      success: true,
      data: invitation
    });
  } catch (e) {
    console.error('❌ PUT /invitations/:invitationId/status error:', e.message);
    if (e.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Invitation not found'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to update invitation',
      details: e.message
    });
  }
});

app.get(['/user/:userId/event-invitations', '/api/user/:userId/event-invitations'], requireAuth, async (req, res) => {
  try {
    const invitations = await prisma.eventInvitation.findMany({
      where: { userId: req.params.userId },
      include: {
        // Pas de relation Event ici, on fera un join manuel si nécessaire
      }
    });

    // Récupérer les événements associés
    const eventIds = [...new Set(invitations.map(i => i.eventId))];
    const events = await prisma.event.findMany({
      where: { id: { in: eventIds } }
    });

    const eventMap = {};
    events.forEach(e => {
      eventMap[e.id] = e;
    });

    const data = invitations.map(inv => ({
      ...inv,
      event: eventMap[inv.eventId]
    }));

    res.json({
      success: true,
      data
    });
  } catch (e) {
    console.error('❌ GET /user/:userId/event-invitations error:', e.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch invitations',
      details: e.message
    });
  }
});

app.delete(['/invitations/:invitationId', '/api/invitations/:invitationId'], requireAuth, async (req, res) => {
  try {
    await prisma.eventInvitation.delete({
      where: { id: req.params.invitationId }
    });
    res.json({
      success: true,
      message: 'Invitation deleted'
    });
  } catch (e) {
    console.error('❌ DELETE /invitations/:invitationId error:', e.message);
    if (e.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Invitation not found'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to delete invitation',
      details: e.message
    });
  }
});

// ============================================
// ACTIVE MEMBERS ENDPOINTS (pour les invitations)
// ============================================
app.get(['/members/active', '/api/members/active'], requireAuth, async (req, res) => {
  try {
    const activeMembers = await prisma.site_users.findMany({
      where: { isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        username: true
      },
      orderBy: { firstName: 'asc' }
    });

    res.json({
      success: true,
      data: activeMembers
    });
  } catch (e) {
    console.error('❌ GET /members/active error:', e.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch active members',
      details: e.message
    });
  }
});

// ============================================
// ============================================
// PLANIFICATIONS ENDPOINTS
// ============================================
app.get(['/planifications', '/api/planifications'], requireAuth, async (req, res) => {
  try {
    const planifications = await prisma.planification.findMany({
      orderBy: { date: 'desc' }
    });
    res.json({ planifications });
  } catch (e) {
    console.error('❌ GET /planifications error:', e.message);
    res.status(500).json({ error: 'Failed to fetch planifications', details: e.message });
  }
});

app.post(['/planifications', '/api/planifications'], requireAuth, async (req, res) => {
  try {
    const plan = await prisma.planification.create({
      data: {
        id: uid(),
        ...req.body,
        date: new Date(req.body.date)
      }
    });
    console.log('✅ Planification créée:', plan.id);
    res.status(201).json(plan);
  } catch (e) {
    console.error('❌ POST /planifications error:', e.message);
    res.status(500).json({ error: 'Failed to create planification', details: e.message });
  }
});

app.put(['/planifications/:id', '/api/planifications/:id'], requireAuth, async (req, res) => {
  try {
    const plan = await prisma.planification.update({
      where: { id: req.params.id },
      data: {
        ...req.body,
        date: req.body.date ? new Date(req.body.date) : undefined
      }
    });
    console.log('✅ Planification modifiée:', plan.id);
    res.json(plan);
  } catch (e) {
    console.error('❌ PUT /planifications/:id error:', e.message);
    if (e?.code === 'P2025') {
      return res.status(404).json({ error: 'Planification not found' });
    }
    res.status(500).json({ error: 'Failed to update planification', details: e.message });
  }
});

app.delete(['/planifications/:id', '/api/planifications/:id'], requireAuth, async (req, res) => {
  try {
    await prisma.planification.delete({
      where: { id: req.params.id }
    });
    console.log('✅ Planification supprimée:', req.params.id);
    res.json({ ok: true });
  } catch (e) {
    console.error('❌ DELETE /planifications/:id error:', e.message);
    if (e?.code === 'P2025') {
      return res.status(404).json({ error: 'Planification not found' });
    }
    res.status(500).json({ error: 'Failed to delete planification', details: e.message });
  }
});

// ============================================
// ============================================
// GPS TRACKING ENDPOINTS
// ============================================
app.get(['/gps/tracking', '/api/gps/tracking'], requireAuth, async (req, res) => {
  try {
    const tracking = await prisma.gpsTracking.findMany({
      orderBy: { timestamp: 'desc' }
    });
    res.json({ tracking });
  } catch (e) {
    console.error('❌ GET /gps/tracking error:', e.message);
    res.status(500).json({ error: 'Failed to fetch GPS tracking', details: e.message });
  }
});

app.put(['/gps/tracking/:vehicleId', '/api/gps/tracking/:vehicleId'], requireAuth, async (req, res) => {
  try {
    const { latitude, longitude, speed, timestamp } = req.body;
    
    const track = await prisma.gpsTracking.upsert({
      where: { vehicleId: req.params.vehicleId },
      create: {
        id: uid(),
        vehicleId: req.params.vehicleId,
        latitude: Number(latitude),
        longitude: Number(longitude),
        speed: Number(speed) || 0,
        timestamp: timestamp ? new Date(timestamp) : new Date()
      },
      update: {
        latitude: Number(latitude),
        longitude: Number(longitude),
        speed: Number(speed) || 0,
        timestamp: timestamp ? new Date(timestamp) : new Date()
      }
    });
    
    console.log('✅ GPS tracking mis à jour:', req.params.vehicleId);
    res.json(track);
  } catch (e) {
    console.error('❌ PUT /gps/tracking/:vehicleId error:', e.message);
    res.status(500).json({ error: 'Failed to update GPS tracking', details: e.message });
  }
});

// FINANCE
app.get(['/finance/stats', '/api/finance/stats'], requireAuth, (req, res) => {
  const revenue = state.transactions.filter(t => t.type === 'recette').reduce((s,t)=>s+t.amount,0);
  const expenses = state.transactions.filter(t => t.type === 'depense').reduce((s,t)=>s+t.amount,0);
  res.json({ data: { monthlyRevenue: revenue, monthlyExpenses: expenses, currentBalance: state.bankBalance, membershipRevenue: 0, activeMembers: state.members.length, revenueGrowth: 0 } });
});

// ✅ GET /api/finance/kpi/monthly - KPI d'un mois spécifique
app.get('/api/finance/kpi/monthly', requireAuth, async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;

    if (month < 1 || month > 12) {
      return res.status(400).json({ error: 'Mois invalide (1-12)' });
    }

    const kpis = await calculateMonthlyKPIs(year, month);
    res.json(kpis);
  } catch (error) {
    console.error('❌ Erreur calcul KPI mensuel:', error);
    res.status(500).json({ error: 'Erreur lors du calcul des KPI' });
  }
});

// ✅ GET /api/finance/kpi/yearly - KPI d'une année complète
app.get('/api/finance/kpi/yearly', requireAuth, async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const kpis = await calculateYearlyKPIs(year);
    res.json(kpis);
  } catch (error) {
    console.error('❌ Erreur calcul KPI annuel:', error);
    res.status(500).json({ error: 'Erreur lors du calcul des KPI' });
  }
});

// ✅ GET /api/finance/kpi/recent - KPI des derniers mois
app.get('/api/finance/kpi/recent', requireAuth, async (req, res) => {
  try {
    const monthsCount = parseInt(req.query.months) || 6;
    const kpis = await getRecentMonthsKPIs(monthsCount);
    res.json(kpis);
  } catch (error) {
    console.error('❌ Erreur calcul KPI récents:', error);
    res.status(500).json({ error: 'Erreur lors du calcul des KPI' });
  }
});

// ✅ GET /api/finance/kpi/compare - Comparer deux périodes
app.get('/api/finance/kpi/compare', requireAuth, async (req, res) => {
  try {
    const year1 = parseInt(req.query.year1);
    const month1 = parseInt(req.query.month1);
    const year2 = parseInt(req.query.year2);
    const month2 = parseInt(req.query.month2);

    if (!year1 || !month1 || !year2 || !month2) {
      return res.status(400).json({ error: 'Paramètres manquants: year1, month1, year2, month2' });
    }

    if (month1 < 1 || month1 > 12 || month2 < 1 || month2 > 12) {
      return res.status(400).json({ error: 'Mois invalides (1-12)' });
    }

    const comparison = await comparePeriodsKPIs(year1, month1, year2, month2);
    res.json(comparison);
  } catch (error) {
    console.error('❌ Erreur comparaison KPI:', error);
    res.status(500).json({ error: 'Erreur lors de la comparaison des KPI' });
  }
});

// ✅ GET /api/finance/kpi/range - Obtenir la plage de dates des données
app.get('/api/finance/kpi/range', requireAuth, async (req, res) => {
  try {
    const range = await getDataRange();
    if (!range) {
      return res.json({ hasData: false });
    }
    res.json({ hasData: true, ...range });
  } catch (error) {
    console.error('❌ Erreur récupération plage KPI:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de la plage' });
  }
});

// ✅ GET /api/finance/kpi/all - KPI de tous les mois avec des données
app.get('/api/finance/kpi/all', requireAuth, async (req, res) => {
  try {
    const kpis = await getAllPeriodsKPIs();
    res.json(kpis);
  } catch (error) {
    console.error('❌ Erreur récupération tous les KPI:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des KPI' });
  }
});

app.get(['/finance/bank-balance', '/api/finance/bank-balance'], requireAuth, async (req, res) => {
  try {
    // Load from Prisma
    let balance = await prisma.finance_balances.findFirst();
    if (balance) {
      state.bankBalance = balance.balance;
      console.log('✅ Solde bancaire chargé depuis Prisma:', balance.balance);
      res.json({ balance: balance.balance });
    } else {
      // Create initial balance if not exists
      const newBalance = await prisma.finance_balances.create({
        data: { id: uid(), balance: state.bankBalance }
      });
      console.log('✅ Solde bancaire initial créé dans Prisma:', newBalance.balance);
      res.json({ balance: newBalance.balance });
    }
  } catch (e) {
    console.error('❌ GET /finance/bank-balance error:', e.message);
    // Fallback: return from memory
    console.log('⚠️ Solde bancaire depuis memory (fallback):', state.bankBalance);
    res.json({ balance: state.bankBalance });
  }
});

app.post(['/finance/bank-balance', '/api/finance/bank-balance'], requireAuth, async (req, res) => {
  try {
    const newBalance = Number(req.body.balance || 0);
    
    // Update in Prisma
    const existing = await prisma.finance_balances.findFirst();
    if (existing) {
      const updated = await prisma.finance_balances.update({
        where: { id: existing.id },
        data: { balance: newBalance }
      });
      state.bankBalance = updated.balance;
      console.log('✅ Solde bancaire mis à jour dans Prisma:', newBalance);
      debouncedSave();
      res.json({ balance: updated.balance });
    } else {
      const created = await prisma.finance_balances.create({
        data: { id: uid(), balance: newBalance }
      });
      state.bankBalance = created.balance;
      console.log('✅ Solde bancaire créé dans Prisma:', newBalance);
      debouncedSave();
      res.json({ balance: created.balance });
    }
  } catch (e) {
    console.error('❌ POST /finance/bank-balance error:', e.message);
    // Fallback: update memory only
    state.bankBalance = Number(req.body.balance || 0);
    console.log('⚠️ Solde bancaire mis à jour en memory (fallback):', state.bankBalance);
    debouncedSave();
    res.json({ balance: state.bankBalance });
  }
});

// Scheduled expenses
app.get(['/finance/scheduled-expenses', '/api/finance/scheduled-expenses'], requireAuth, (req, res) => {
  const { eventId } = req.query;
  let list = state.scheduled;
  if (eventId) list = list.filter(x => x.eventId === eventId);
  res.json({ operations: list });
});
app.post(['/finance/scheduled-expenses', '/api/finance/scheduled-expenses'], requireAuth, async (req, res) => {
  try {
    const opId = uid();
    const opData = {
      id: opId,
      type: req.body.type || 'expense',
      description: req.body.description || '',
      amount: req.body.amount || 0,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
      category: req.body.category || '',
      recurring: req.body.recurring || 'MONTHLY',
      frequency: req.body.frequency || 'MONTHLY',
      nextDate: req.body.nextDate ? new Date(req.body.nextDate) : null,
      notes: req.body.notes || '',
      isExecuted: false,
      createdBy: req.user?.name || req.user?.email || 'Anonymous',
      totalAmount: req.body.totalAmount || req.body.amount || 0,
      estimatedEndDate: req.body.estimatedEndDate ? new Date(req.body.estimatedEndDate) : null
    };
    
    // Save to Prisma
    const saved = await prisma.scheduled_operations.create({ data: opData });
    
    // Also update memory
    state.scheduled.push(saved);
    debouncedSave();
    
    console.log('✅ Opération programmée créée dans Prisma:', opId);
    res.status(201).json(saved);
  } catch (e) {
    console.error('❌ POST /api/finance/scheduled-expenses error:', e.message);
    // Fallback
    const op = { 
      id: uid(), 
      userId: req.user?.id || req.user?.email || 'anonymous',
      createdBy: req.user?.name || req.user?.email || 'Anonymous',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...req.body 
    };
    state.scheduled.push(op);
    debouncedSave();
    res.status(201).json(op);
  }
});
app.put(['/finance/scheduled-expenses/:id', '/api/finance/scheduled-expenses/:id'], requireAuth, async (req, res) => {
  try {
    const updateData = {
      ...req.body,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
      nextDate: req.body.nextDate ? new Date(req.body.nextDate) : undefined,
      estimatedEndDate: req.body.estimatedEndDate ? new Date(req.body.estimatedEndDate) : undefined
    };
    
    // Update in Prisma
    const updated = await prisma.scheduled_operations.update({
      where: { id: req.params.id },
      data: updateData
    });
    
    // Update memory
    state.scheduled = state.scheduled.map(o => o.id === req.params.id ? updated : o);
    debouncedSave();
    
    res.json(updated);
  } catch (e) {
    console.error('❌ PUT /api/finance/scheduled-expenses error:', e.message);
    // Fallback
    state.scheduled = state.scheduled.map(o => o.id === req.params.id ? { ...o, ...req.body, updatedAt: new Date().toISOString() } : o);
    const op = state.scheduled.find(o => o.id === req.params.id);
    debouncedSave();
    res.json(op);
  }
});
app.delete(['/finance/scheduled-expenses/:id', '/api/finance/scheduled-expenses/:id'], requireAuth, async (req, res) => {
  try {
    // Delete from Prisma
    await prisma.scheduled_operations.delete({
      where: { id: req.params.id }
    });
    
    // Delete from memory
    state.scheduled = state.scheduled.filter(o => o.id !== req.params.id);
    debouncedSave();
    
    res.json({ ok: true });
  } catch (e) {
    console.error('❌ DELETE /api/finance/scheduled-expenses error:', e.message);
    // Fallback
    state.scheduled = state.scheduled.filter(o => o.id !== req.params.id);
    debouncedSave();
    res.json({ ok: true });
  }
});
app.post('/finance/scheduled-expenses/:id/execute', requireAuth, async (req, res) => {
  try {
    // Get operation from Prisma
    const op = await prisma.scheduled_operations.findUnique({
      where: { id: req.params.id }
    });
    if (!op) return res.status(404).json({ error: 'Not found' });
    
    const tx = { id: uid(), type: op.type, amount: op.amount, description: op.description, category: op.category, date: today(), eventId: op.eventId || null };
    state.transactions.unshift(tx);
    
    // Mark as executed or delete if not recurring
    if (!op.recurring || op.recurring === 'none' || op.recurring === 'ONE_SHOT') {
      await prisma.scheduled_operations.delete({ where: { id: op.id } });
      state.scheduled = state.scheduled.filter(o => o.id !== op.id);
    } else {
      // Update nextDate in Prisma
      const nextDate = calculateNextDate(op.nextDate || op.dueDate || new Date(), op.frequency || op.recurring);
      await prisma.scheduled_operations.update({
        where: { id: op.id },
        data: { nextDate, isExecuted: false }
      });
      state.scheduled = state.scheduled.map(o => o.id === op.id ? { ...o, nextDate, isExecuted: false } : o);
    }
    
    if (tx.type === 'recette') state.bankBalance += tx.amount; else state.bankBalance -= tx.amount;
    debouncedSave();
    
    res.json({ ok: true, transaction: tx });
  } catch (e) {
    console.error('❌ POST /finance/scheduled-expenses/:id/execute error:', e.message);
    // Fallback
    const op = state.scheduled.find(o => o.id === req.params.id);
    if (!op) return res.status(404).json({ error: 'Not found' });
    const tx = { id: uid(), type: op.type, amount: op.amount, description: op.description, category: op.category, date: today(), eventId: op.eventId || null };
    state.transactions.unshift(tx);
    if (!op.recurring || op.recurring === 'none') {
      state.scheduled = state.scheduled.filter(o => o.id !== op.id);
    }
    if (tx.type === 'recette') state.bankBalance += tx.amount; else state.bankBalance -= tx.amount;
    debouncedSave();
    res.json({ ok: true, transaction: tx });
  }
});

// ─── Import relevé bancaire PDF ──────────────────────────────────────────────
import { parseBankStatementPDF } from './lib/bankStatementParser.js';
const bankStatementUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

app.post(
  ['/finance/import-bank-statement', '/api/finance/import-bank-statement'],
  requireAuth,
  bankStatementUpload.single('pdf'),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Aucun fichier PDF reçu' });
      if (!req.file.mimetype.includes('pdf') && !req.file.originalname?.endsWith('.pdf')) {
        return res.status(400).json({ error: 'Le fichier doit être un PDF' });
      }
      const result = await parseBankStatementPDF(req.file.buffer);
      res.json(result);
    } catch (e) {
      console.error('❌ POST /finance/import-bank-statement error:', e.message);
      res.status(500).json({ error: 'Impossible de lire le PDF : ' + e.message });
    }
  }
);

// Transactions - Utilisation de Prisma pour la persistance
app.get(['/finance/transactions', '/api/finance/transactions'], requireAuth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      category,
      dateFrom,
      dateTo,
      amountMin,
      amountMax
    } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where = {};

    if (search) {
      const trimmedSearch = String(search).trim();
      const numericSearch = Number(trimmedSearch.replace(',', '.'));
      where.OR = [
        { description: { contains: trimmedSearch, mode: 'insensitive' } },
        { category: { contains: trimmedSearch, mode: 'insensitive' } },
        { linkedDocumentNumber: { contains: trimmedSearch, mode: 'insensitive' } },
        { linkedDocumentType: { contains: trimmedSearch, mode: 'insensitive' } }
      ];

      if (!Number.isNaN(Date.parse(trimmedSearch))) {
        const parsedDate = new Date(trimmedSearch);
        const nextDate = new Date(parsedDate);
        nextDate.setDate(nextDate.getDate() + 1);
        where.OR.push({
          date: {
            gte: parsedDate,
            lt: nextDate
          }
        });
      }

      if (!Number.isNaN(numericSearch)) {
        where.OR.push({ amount: numericSearch });
      }
    }

    if (category && category !== 'Tous') {
      where.category = category;
    }

    if (dateFrom || dateTo) {
      where.date = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999Z`) } : {})
      };
    }

    if (amountMin || amountMax) {
      where.amount = {
        ...(amountMin !== undefined && amountMin !== '' ? { gte: Number(amountMin) } : {}),
        ...(amountMax !== undefined && amountMax !== '' ? { lte: Number(amountMax) } : {})
      };
    }
    
    // Load from Prisma first
    let transactions = await prisma.finance_transactions.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { date: 'desc' }
    });
    
    const total = await prisma.finance_transactions.count({ where });
    
    // Format dates
    transactions = transactions.map(t => ({
      ...t,
      date: t.date.toISOString(),
      createdAt: t.createdAt.toISOString()
    }));
    
    console.log('✅ Transactions chargées depuis Prisma:', transactions.length);
    res.json({ transactions, total });
  } catch (e) {
    console.error('❌ GET /finance/transactions error:', e.message);
    // Fallback to memory
    const {
      page = 1,
      limit = 20,
      search = '',
      category,
      dateFrom,
      dateTo,
      amountMin,
      amountMax
    } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const filteredTransactions = state.transactions.filter((transaction) => {
      const transactionDate = new Date(transaction.date);
      const lowerSearch = String(search || '').trim().toLowerCase();

      const matchesSearch = !lowerSearch || [
        transaction.description,
        transaction.category,
        transaction.linkedDocumentNumber,
        transaction.linkedDocumentType,
        String(transaction.amount),
        transactionDate.toLocaleDateString('fr-FR')
      ].some((value) => String(value || '').toLowerCase().includes(lowerSearch));

      const matchesCategory = !category || category === 'Tous' || transaction.category === category;
      const matchesDateFrom = !dateFrom || transactionDate >= new Date(dateFrom);
      const matchesDateTo = !dateTo || transactionDate <= new Date(`${dateTo}T23:59:59.999Z`);
      const matchesAmountMin = amountMin === undefined || amountMin === '' || Number(transaction.amount) >= Number(amountMin);
      const matchesAmountMax = amountMax === undefined || amountMax === '' || Number(transaction.amount) <= Number(amountMax);

      return matchesSearch && matchesCategory && matchesDateFrom && matchesDateTo && matchesAmountMin && matchesAmountMax;
    });

    const total = filteredTransactions.length;
    const transactions = filteredTransactions.slice(skip, skip + Number(limit));
    
    console.log('⚠️ Transactions chargées depuis memory (fallback)');
    res.json({ transactions, total });
  }
});

app.post(['/finance/transactions', '/api/finance/transactions'], requireAuth, async (req, res) => {
  try {
    const txId = uid();
    const linkedDebtId = req.body.linkedDebtId || null;
    const txData = {
      id: txId,
      type: req.body.type || 'DEBIT',
      amount: Number(req.body.amount || 0),
      description: req.body.description || '',
      category: req.body.category || '',
      date: req.body.date ? new Date(req.body.date) : new Date()
    };

    // Si lié à une dette, enrichir les champs de liaison
    let linkedDebt = null;
    if (linkedDebtId) {
      linkedDebt = await prisma.debt.findUnique({ where: { id: linkedDebtId } });
      if (linkedDebt) {
        txData.linkedDocumentId = linkedDebt.id;
        txData.linkedDocumentType = linkedDebt.type; // "DETTE" ou "CRÉANCE"
        txData.linkedDocumentNumber = linkedDebt.id.substring(0, 12);
      }
    }
    
    // Save to Prisma
    const saved = await prisma.finance_transactions.create({ data: txData });
    
    // Mettre à jour la dette liée si besoin
    if (linkedDebt) {
      const txAmount = Math.abs(txData.amount || 0);
      const isDebit = txData.type === 'DEBIT'; // Utiliser le champ type
      const isDette = linkedDebt.type === 'DETTE';
      const isTropPercu = linkedDebt.debtNature === 'TROP_PERCU';
      
      // Logique intelligente selon le type de dette et de transaction :
      // DETTE_NORMALE: DETTE + DEBIT → amount++, DETTE + CREDIT → paidAmount++
      // TROP_PERCU: DETTE + CREDIT → amount++ (on a reçu trop), DETTE + DEBIT → paidAmount++ (on rembourse)
      
      const updateData = { updatedAt: new Date() };
      let shouldIncreaseAmount;
      
      if (isTropPercu) {
        // Logique inversée pour trop-perçu
        shouldIncreaseAmount = (isDette && !isDebit) || (!isDette && isDebit);
      } else {
        // Logique normale
        shouldIncreaseAmount = (isDette && isDebit) || (!isDette && !isDebit);
      }
      
      if (shouldIncreaseAmount) {
        // Transaction crée/augmente la dette/créance
        updateData.amount = linkedDebt.amount + txAmount;
      } else {
        // Transaction rembourse la dette/créance
        updateData.paidAmount = linkedDebt.paidAmount + txAmount;
      }
      
      // Recalculer le statut
      const newAmount = updateData.amount !== undefined ? updateData.amount : linkedDebt.amount;
      const newPaid = updateData.paidAmount !== undefined ? updateData.paidAmount : linkedDebt.paidAmount;
      updateData.status = newAmount > 0 && newPaid >= newAmount ? 'PAYÉE' : linkedDebt.status === 'ANNULÉE' ? 'ANNULÉE' : 'EN_COURS';
      
      await prisma.debt.update({
        where: { id: linkedDebt.id },
        data: updateData
      });
      console.log(`💰 Dette ${linkedDebt.id} mise à jour: ${updateData.amount ? `amount=${updateData.amount}` : `paidAmount=${updateData.paidAmount}`} (tx: ${txAmount} ${txData.type}), status=${updateData.status}`);
    }

    // Also update memory
    const tx = {
      id: saved.id,
      date: saved.date.toISOString(),
      updatedAt: new Date().toISOString(),
      ...txData,
      date: saved.date.toISOString()
    };
    state.transactions.unshift(tx);
    
    // Mettre à jour le solde bancaire
    if (tx.type === 'CREDIT') {
      state.bankBalance += Number(tx.amount || 0);
    } else if (tx.type === 'DEBIT') {
      state.bankBalance -= Number(tx.amount || 0);
    }
    debouncedSave();
    
    console.log('✅ Transaction créée dans Prisma:', txId, '| Nouveau solde:', state.bankBalance);
    res.status(201).json({
      ...tx,
      newBalance: state.bankBalance
    });
  } catch (e) {
    console.error('❌ POST /finance/transactions error:', e.message);
    // Fallback: save to memory only
    const tx = {
      id: uid(),
      date: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...req.body
    };
    
    state.transactions.unshift(tx);
    
    if (tx.type === 'CREDIT') {
      state.bankBalance += Number(tx.amount || 0);
    } else if (tx.type === 'DEBIT') {
      state.bankBalance -= Number(tx.amount || 0);
    }
    debouncedSave();
    
    res.status(201).json({
      ...tx,
      newBalance: state.bankBalance
    });
  }
});

app.put(['/finance/transactions/:id', '/api/finance/transactions/:id'], requireAuth, async (req, res) => {
  try {
    const oldTx = state.transactions.find(t => t.id === req.params.id);
    
    if (!oldTx) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    const updateData = {
      type: req.body.type || oldTx.type,
      amount: req.body.amount !== undefined ? Number(req.body.amount) : oldTx.amount,
      description: req.body.description !== undefined ? req.body.description : oldTx.description,
      category: req.body.category !== undefined ? req.body.category : oldTx.category,
      date: req.body.date ? new Date(req.body.date) : oldTx.date
    };
    
    // Update in Prisma
    const updated = await prisma.finance_transactions.update({
      where: { id: req.params.id },
      data: updateData
    });
    
    // Update memory
    const tx = { ...oldTx, ...updateData, date: updated.date.toISOString(), updatedAt: new Date().toISOString() };
    state.transactions = state.transactions.map(t => t.id === req.params.id ? tx : t);
    
    // Mettre à jour le solde bancaire si le montant a changé
    const oldAmount = oldTx.type === 'CREDIT' ? oldTx.amount : (oldTx.type === 'DEBIT' ? -oldTx.amount : 0);
    const newAmount = tx.type === 'CREDIT' ? tx.amount : (tx.type === 'DEBIT' ? -tx.amount : 0);
    state.bankBalance += (newAmount - oldAmount);
    debouncedSave();
    
    console.log('✅ Transaction modifiée dans Prisma:', tx.id);
    res.json(tx);
  } catch (e) {
    console.error('❌ PUT /finance/transactions/:id error:', e.message);
    // Fallback: update in memory only
    const oldTx = state.transactions.find(t => t.id === req.params.id);
    
    if (!oldTx) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    const tx = { ...oldTx, ...req.body, updatedAt: new Date().toISOString() };
    state.transactions = state.transactions.map(t => t.id === req.params.id ? tx : t);
    
    const oldAmount = oldTx.type === 'CREDIT' ? oldTx.amount : (oldTx.type === 'DEBIT' ? -oldTx.amount : 0);
    const newAmount = tx.type === 'CREDIT' ? tx.amount : (tx.type === 'DEBIT' ? -tx.amount : 0);
    state.bankBalance += (newAmount - oldAmount);
    debouncedSave();
    
    res.json(tx);
  }
});

app.delete(['/finance/transactions/:id', '/api/finance/transactions/:id'], requireAuth, async (req, res) => {
  try {
    const tx = state.transactions.find(t => t.id === req.params.id);
    
    if (!tx) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    // Delete from Prisma
    await prisma.finance_transactions.delete({
      where: { id: req.params.id }
    });

    // Reverser l'impact sur la dette liée si applicable
    if (tx.linkedDocumentId && (tx.linkedDocumentType === 'DETTE' || tx.linkedDocumentType === 'CRÉANCE')) {
      try {
        const debt = await prisma.debt.findUnique({ where: { id: tx.linkedDocumentId } });
        if (debt) {
          const txAmount = Math.abs(Number(tx.amount || 0));
          const isDebit = tx.type === 'DEBIT';
          const isDette = debt.type === 'DETTE';
          const isTropPercu = debt.debtNature === 'TROP_PERCU';
          
          const updateData = { updatedAt: new Date() };
          let hadIncreasedAmount;
          
          if (isTropPercu) {
            hadIncreasedAmount = (isDette && !isDebit) || (!isDette && isDebit);
          } else {
            hadIncreasedAmount = (isDette && isDebit) || (!isDette && !isDebit);
          }
          
          if (hadIncreasedAmount) {
            // Transaction avait augmenté amount → on reverse
            updateData.amount = Math.max(0, debt.amount - txAmount);
          } else {
            // Transaction avait augmenté paidAmount → on reverse
            updateData.paidAmount = Math.max(0, debt.paidAmount - txAmount);
          }
          
          const newAmount = updateData.amount !== undefined ? updateData.amount : debt.amount;
          const newPaid = updateData.paidAmount !== undefined ? updateData.paidAmount : debt.paidAmount;
          updateData.status = debt.status === 'ANNULÉE' ? 'ANNULÉE' : (newAmount > 0 && newPaid >= newAmount ? 'PAYÉE' : 'EN_COURS');
          
          await prisma.debt.update({
            where: { id: debt.id },
            data: updateData
          });
          console.log(`↩️ Dette ${debt.id} réajustée après suppression tx: ${updateData.amount !== undefined ? `amount=${updateData.amount}` : `paidAmount=${updateData.paidAmount}`} (reversed ${txAmount})`);
        }
      } catch (debtErr) {
        console.error('⚠️ Impossible de réajuster la dette:', debtErr.message);
      }
    }

    // Delete from memory
    state.transactions = state.transactions.filter(t => t.id !== req.params.id);
    
    // Mettre à jour le solde bancaire
    if (tx.type === 'CREDIT') {
      state.bankBalance -= Number(tx.amount || 0);
    } else if (tx.type === 'DEBIT') {
      state.bankBalance += Number(tx.amount || 0);
    }
    debouncedSave();
    
    console.log('✅ Transaction supprimée de Prisma:', req.params.id);
    res.json({ ok: true });
  } catch (e) {
    console.error('❌ DELETE /finance/transactions/:id error:', e.message);
    // Fallback: delete from memory only
    const tx = state.transactions.find(t => t.id === req.params.id);
    
    if (!tx) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    state.transactions = state.transactions.filter(t => t.id !== req.params.id);
    
    if (tx.type === 'CREDIT') {
      state.bankBalance -= Number(tx.amount || 0);
    } else if (tx.type === 'DEBIT') {
      state.bankBalance += Number(tx.amount || 0);
    }
    debouncedSave();
    
    res.json({ ok: true });
  }
});

app.post('/finance/sync/memberships', requireAuth, (req, res) => {
  res.json({ synchronized: 0, ok: true });
});

// ============================================
// ENDPOINTS LIAISON TRANSACTIONS-DOCUMENTS
// ============================================

// GET /api/finance/available-documents - Liste tous les documents disponibles pour liaison
app.get(['/finance/available-documents', '/api/finance/available-documents'], requireAuth, async (req, res) => {
  try {
    console.log('📥 GET /api/finance/available-documents');
    
    // Récupérer tous les documents financiers (devis + factures)
    const financialDocs = await prisma.financial_documents.findMany({
      orderBy: { date: 'desc' }
    });
    
    // Récupérer toutes les dettes
    const debts = await prisma.debt.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    // Formater les documents financiers pour le frontend
    const formattedFinancialDocs = financialDocs.map(doc => ({
      id: doc.id,
      type: doc.type, // "QUOTE" ou "INVOICE"
      displayType: doc.type === 'QUOTE' ? 'DEVIS' : 'FACTURE',
      number: doc.number,
      title: doc.title,
      description: doc.description,
      amount: doc.amount,
      date: doc.date,
      status: doc.type === 'INVOICE' ? doc.invoiceStatus : doc.quoteStatus
    }));
    
    // Formater les dettes pour le frontend
    const formattedDebts = debts.map(debt => ({
      id: debt.id,
      type: debt.type, // "DETTE" ou "CRÉANCE"
      displayType: debt.type,
      number: debt.id.substring(0, 12), // ID court comme numéro
      title: debt.description,
      description: `${debt.debtorType}: ${debt.debtorName}`,
      amount: debt.amount,
      paidAmount: debt.paidAmount || 0,
      remainingAmount: Math.max(0, debt.amount - (debt.paidAmount || 0)),
      progressPercent: debt.amount > 0 ? Math.min(100, Math.round(((debt.paidAmount || 0) / debt.amount) * 100)) : 0,
      date: debt.createdAt,
      status: debt.status,
      dueDate: debt.dueDate
    }));
    
    // Combiner tous les documents
    const allDocuments = [
      ...formattedFinancialDocs,
      ...formattedDebts
    ];
    
    console.log(`✅ ${allDocuments.length} documents disponibles (${financialDocs.length} factures/devis, ${debts.length} dettes)`);
    res.json({ documents: allDocuments });
  } catch (e) {
    console.error('❌ GET /api/finance/available-documents error:', e.message);
    res.status(500).json({ error: 'Erreur chargement documents disponibles', details: e.message });
  }
});

// POST /api/finance/transactions/:id/link - Lier une transaction à un document
app.post(['/finance/transactions/:id/link', '/api/finance/transactions/:id/link'], requireAuth, async (req, res) => {
  try {
    const { linkedDocumentId, linkedDocumentType, linkedDocumentNumber } = req.body;
    
    if (!linkedDocumentId || !linkedDocumentType) {
      return res.status(400).json({ error: 'linkedDocumentId et linkedDocumentType requis' });
    }
    
    console.log(`🔗 Liaison transaction ${req.params.id} -> ${linkedDocumentType} ${linkedDocumentNumber}`);

    // Récupérer la transaction actuelle pour savoir si elle était déjà liée à une dette
    const currentTx = await prisma.finance_transactions.findUnique({ where: { id: req.params.id } });
    if (currentTx && currentTx.linkedDocumentId && (currentTx.linkedDocumentType === 'DETTE' || currentTx.linkedDocumentType === 'CRÉANCE')) {
      // Annuler l'impact de l'ancienne liaison sur la dette précédente
      try {
        const oldDebt = await prisma.debt.findUnique({ where: { id: currentTx.linkedDocumentId } });
        if (oldDebt) {
          const txAmount = Math.abs(Number(currentTx.amount || 0));
          const isDebit = currentTx.type === 'DEBIT';
          const isDette = oldDebt.type === 'DETTE';
          const isTropPercu = oldDebt.debtNature === 'TROP_PERCU';
          
          const updateData = { updatedAt: new Date() };
          let hadIncreasedAmount;
          
          if (isTropPercu) {
            hadIncreasedAmount = (isDette && !isDebit) || (!isDette && isDebit);
          } else {
            hadIncreasedAmount = (isDette && isDebit) || (!isDette && !isDebit);
          }
          
          if (hadIncreasedAmount) {
            // Transaction avait augmenté amount → on reverse
            updateData.amount = Math.max(0, oldDebt.amount - txAmount);
          } else {
            // Transaction avait augmenté paidAmount → on reverse
            updateData.paidAmount = Math.max(0, oldDebt.paidAmount - txAmount);
          }
          
          const newAmount = updateData.amount !== undefined ? updateData.amount : oldDebt.amount;
          const newPaid = updateData.paidAmount !== undefined ? updateData.paidAmount : oldDebt.paidAmount;
          updateData.status = oldDebt.status === 'ANNULÉE' ? 'ANNULÉE' : (newAmount > 0 && newPaid >= newAmount ? 'PAYÉE' : 'EN_COURS');
          
          await prisma.debt.update({
            where: { id: oldDebt.id },
            data: updateData
          });
        }
      } catch (_) {}
    }
    
    // Mettre à jour la transaction dans Prisma
    const updated = await prisma.finance_transactions.update({
      where: { id: req.params.id },
      data: {
        linkedDocumentId,
        linkedDocumentType,
        linkedDocumentNumber: linkedDocumentNumber || null
      }
    });

    // Si la nouvelle liaison est une dette, mettre à jour intelligemment
    if (linkedDocumentType === 'DETTE' || linkedDocumentType === 'CRÉANCE') {
      try {
        const newDebt = await prisma.debt.findUnique({ where: { id: linkedDocumentId } });
        if (newDebt) {
          const txAmount = Math.abs(Number(updated.amount || 0));
          const isDebit = updated.type === 'DEBIT';
          const isDette = newDebt.type === 'DETTE';
          const isTropPercu = newDebt.debtNature === 'TROP_PERCU';
          
          const updateData = { updatedAt: new Date() };
          let shouldIncreaseAmount;
          
          if (isTropPercu) {
            shouldIncreaseAmount = (isDette && !isDebit) || (!isDette && isDebit);
          } else {
            shouldIncreaseAmount = (isDette && isDebit) || (!isDette && !isDebit);
          }
          
          if (shouldIncreaseAmount) {
            // Transaction crée/augmente la dette/créance
            updateData.amount = newDebt.amount + txAmount;
          } else {
            // Transaction rembourse la dette/créance
            updateData.paidAmount = newDebt.paidAmount + txAmount;
          }
          
          const newAmount = updateData.amount !== undefined ? updateData.amount : newDebt.amount;
          const newPaid = updateData.paidAmount !== undefined ? updateData.paidAmount : newDebt.paidAmount;
          updateData.status = newAmount > 0 && newPaid >= newAmount ? 'PAYÉE' : newDebt.status === 'ANNULÉE' ? 'ANNULÉE' : 'EN_COURS';
          
          await prisma.debt.update({
            where: { id: newDebt.id },
            data: updateData
          });
          console.log(`💰 Dette ${newDebt.id} mise à jour via liaison: ${updateData.amount ? `amount=${updateData.amount}` : `paidAmount=${updateData.paidAmount}`} (tx: ${txAmount} ${updated.type})`);
        }
      } catch (_) {}
    }
    
    // Mettre à jour la mémoire
    state.transactions = state.transactions.map(t => 
      t.id === req.params.id 
        ? { ...t, linkedDocumentId, linkedDocumentType, linkedDocumentNumber }
        : t
    );
    debouncedSave();
    
    console.log(`✅ Transaction ${req.params.id} liée au document ${linkedDocumentId}`);
    res.json({ 
      transaction: {
        ...updated,
        date: updated.date.toISOString(),
        createdAt: updated.createdAt.toISOString()
      }
    });
  } catch (e) {
    console.error('❌ POST /api/finance/transactions/:id/link error:', e.message);
    res.status(500).json({ error: 'Erreur liaison transaction-document', details: e.message });
  }
});

// DELETE /api/finance/transactions/:id/link - Délier une transaction d'un document
app.delete(['/finance/transactions/:id/link', '/api/finance/transactions/:id/link'], requireAuth, async (req, res) => {
  try {
    console.log(`🔓 Déliaison transaction ${req.params.id}`);

    // Récupérer la transaction avant de délier pour réajuster la dette
    const currentTx = await prisma.finance_transactions.findUnique({ where: { id: req.params.id } });
    if (currentTx && currentTx.linkedDocumentId && (currentTx.linkedDocumentType === 'DETTE' || currentTx.linkedDocumentType === 'CRÉANCE')) {
      try {
        const debt = await prisma.debt.findUnique({ where: { id: currentTx.linkedDocumentId } });
        if (debt) {
          const txAmount = Math.abs(Number(currentTx.amount || 0));
          const isDebit = currentTx.type === 'DEBIT';
          const isDette = debt.type === 'DETTE';
          const isTropPercu = debt.debtNature === 'TROP_PERCU';
          
          const updateData = { updatedAt: new Date() };
          let hadIncreasedAmount;
          
          if (isTropPercu) {
            hadIncreasedAmount = (isDette && !isDebit) || (!isDette && isDebit);
          } else {
            hadIncreasedAmount = (isDette && isDebit) || (!isDette && !isDebit);
          }
          
          if (hadIncreasedAmount) {
            // Transaction avait augmenté amount → on reverse
            updateData.amount = Math.max(0, debt.amount - txAmount);
          } else {
            // Transaction avait augmenté paidAmount → on reverse
            updateData.paidAmount = Math.max(0, debt.paidAmount - txAmount);
          }
          
          const newAmount = updateData.amount !== undefined ? updateData.amount : debt.amount;
          const newPaid = updateData.paidAmount !== undefined ? updateData.paidAmount : debt.paidAmount;
          updateData.status = debt.status === 'ANNULÉE' ? 'ANNULÉE' : (newAmount > 0 && newPaid >= newAmount ? 'PAYÉE' : 'EN_COURS');
          
          await prisma.debt.update({
            where: { id: debt.id },
            data: updateData
          });
          console.log(`↩️ Dette ${debt.id} réajustée après déliaison: ${updateData.amount !== undefined ? `amount=${updateData.amount}` : `paidAmount=${updateData.paidAmount}`} (reversed ${txAmount})`);
        }
      } catch (_) {}
    }
    
    // Mettre à jour la transaction dans Prisma
    const updated = await prisma.finance_transactions.update({
      where: { id: req.params.id },
      data: {
        linkedDocumentId: null,
        linkedDocumentType: null,
        linkedDocumentNumber: null
      }
    });
    
    // Mettre à jour la mémoire
    state.transactions = state.transactions.map(t => 
      t.id === req.params.id 
        ? { ...t, linkedDocumentId: null, linkedDocumentType: null, linkedDocumentNumber: null }
        : t
    );
    debouncedSave();
    
    console.log(`✅ Transaction ${req.params.id} déliée`);
    res.json({ 
      transaction: {
        ...updated,
        date: updated.date.toISOString(),
        createdAt: updated.createdAt.toISOString()
      }
    });
  } catch (e) {
    console.error('❌ DELETE /api/finance/transactions/:id/link error:', e.message);
    res.status(500).json({ error: 'Erreur déliaison transaction-document', details: e.message });
  }
});

app.get(['/finance/categories', '/api/finance/categories'], requireAuth, async (req, res) => {
  try {
    // Charger depuis Prisma (source de vérité)
    const categories = await prisma.finance_categories.findMany({
      orderBy: { name: 'asc' }
    });
    if (categories.length > 0) {
      state.categories = categories;
    }
    res.json({ categories: state.categories });
  } catch (e) {
    console.warn('⚠️ Erreur chargement catégories:', e.message);
    res.json({ categories: state.categories });
  }
});
app.get(['/finance/category-breakdown', '/api/finance/category-breakdown'], requireAuth, (req, res) => {
  res.json({ period: req.query.period || 'month', breakdown: [], total: 0 });
});

// Expense Reports (notes de frais)
app.get(['/finance/expense-reports', '/api/finance/expense-reports'], requireAuth, async (req, res) => {
  try {
    const { eventId } = req.query;
    await ensureExpenseReportColumns();
    // Load from Prisma (source of truth)
    let reports = await prisma.finance_expense_reports.findMany({
      orderBy: { createdAt: 'desc' }
    });
    if (eventId) reports = reports.filter(r => r.eventId === eventId);
    
    // Sync with memory state
    if (reports.length > 0) {
      state.expenseReports = reports;
    }
    
    res.json({ reports });
  } catch (e) {
    console.warn('⚠️ Failed to load expense reports from Prisma:', e.message);
    const { eventId } = req.query;
    let list = state.expenseReports;
    if (eventId) list = list.filter(r => r.eventId === eventId);
    res.json({ reports: list });
  }
});
app.post(['/finance/expense-reports', '/api/finance/expense-reports'], requireAuth, uploadLimiter, upload.single('file'), async (req, res) => {
  try {
    await ensureExpenseReportColumns();
    const { date, description, amount, status = 'open', planned = false, eventId } = req.body;
    const type = req.body.type || 'Note de frais avec justificatif';
    const notes = req.body.notes || null;
    
    const userId = req.user?.id || req.user?.email || 'anonymous';
    const createdBy = req.user?.name || req.user?.email || 'Anonymous';
    const reportId = uid();
    
    const reportData = {
      id: reportId,
      // type: type,  // TEMPORAIRE: désactivé car client Prisma pas à jour
      userId: userId,
      createdBy: createdBy,
      date: date ? new Date(date) : new Date(),
      description: description || '',
      amount: Number(amount || 0),
      status: status || 'open',
      notes: notes,
      planned: planned === 'true' || planned === true,
      fileName: req.file?.originalname || null,
      fileUrl: req.file ? `/uploads/${req.file.filename}` : null,
      eventId: eventId || null
    };
    
    // Save to Prisma
    const saved = await prisma.finance_expense_reports.create({ data: reportData });
    
    // Also update memory (with type included)
    const report = {
      ...reportData,
      type: type,  // Ajouté ici pour la mémoire
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt
    };
    state.expenseReports.unshift(report);
    debouncedSave();
    
    // 🔔 CREATE NOTIFICATION: new expense report created
    // Notify admin and users with finance permissions
    try {
      const financeUsers = state.users?.filter(u => 
        u.role?.includes('ADMIN') || 
        u.role?.includes('TRESORIER') || 
        u.role?.includes('PRESIDENT') ||
        u.permissions?.includes('finance') ||
        u.permissions?.includes('gestion_financiere')
      ) || [];
      
      const createdByName = createdBy || 'Un membre';
      const notificationMsg = `Une nouvelle note de frais a été déposée par ${createdByName}: ${description || 'Sans description'}`;
      const notification = {
        id: 'n' + Date.now(),
        type: 'expense_report_created',
        message: notificationMsg,
        createdAt: new Date().toISOString(),
        read: false,
        metadata: { expenseReportId: reportId, userId: userId, amount }
      };
      state.notifications.unshift(notification);
      console.log('🔔 Notification création note de frais:', notificationMsg);
    } catch (notifErr) {
      console.warn('⚠️ Erreur notification:', notifErr.message);
    }
    
    // 📧 ENVOYER EMAIL AUTOMATIQUE si compte noreply connecté
    try {
      // Récupérer les infos du membre
      const member = await prisma.members.findUnique({
        where: { id: userId }
      });
      
      if (member && member.email) {
        await sendExpenseReportNotification(
          {
            id: reportId,
            montant: Number(amount || 0),
            description: description || 'Note de frais',
            date: date || new Date().toISOString(),
            statut: status || 'EN_ATTENTE'
          },
          {
            prenom: member.prenom || member.firstname,
            nom: member.nom || member.lastname,
            email: member.email
          }
        );
        console.log(`✅ Email de confirmation envoyé à ${member.email}`);
      }
    } catch (emailErr) {
      console.warn('⚠️ Erreur envoi email:', emailErr.message);
    }
    
    console.log('✅ Note de frais créée dans Prisma:', reportId);
    res.status(201).json({ report });
  } catch (e) {
    console.error('❌ POST /api/finance/expense-reports PRISMA ERROR:', e.message, e.code);
    // Fallback: save to memory only
    const userId = req.user?.id || req.user?.email || 'anonymous';
    const createdBy = req.user?.name || req.user?.email || 'Anonymous';
    const report = {
      id: uid(),
      userId: userId,
      createdBy: createdBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      date: req.body.date || today(),
      type: req.body.type || 'Note de frais avec justificatif',
      description: req.body.description || '',
      amount: Number(req.body.amount || 0),
      status: req.body.status || 'open',
      notes: req.body.notes || null,
      planned: req.body.planned === 'true' || req.body.planned === true,
      fileName: req.file?.originalname,
      fileUrl: req.file ? `/uploads/${req.file.filename}` : '',
      eventId: req.body.eventId || null
    };
    state.expenseReports.unshift(report);
    debouncedSave();
    res.status(201).json({ report });
  }
});
app.put(['/finance/expense-reports/:id', '/api/finance/expense-reports/:id'], requireAuth, async (req, res) => {
  try {
    await ensureExpenseReportColumns();
    // Filtrer les champs autorisés pour la mise à jour
    const allowedFields = ['status', 'type', 'description', 'amount', 'date', 'notes', 'statusNotes', 'approvedBy', 'attachmentUrl', 'attachmentFileName', 'attachmentType'];
    const updateData = {};
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });
    
    // Ajouter toujours updatedAt
    updateData.updatedAt = new Date();
    
    console.log('📝 Mise à jour demandée pour:', req.params.id, '- données:', updateData);
    
    // Update in Prisma
    const updated = await prisma.finance_expense_reports.update({
      where: { id: req.params.id },
      data: updateData
    });
    
    // Update memory - convertir les dates en ISO string
    const reportToStore = {
      ...updated,
      createdAt: updated.createdAt?.toISOString?.() || updated.createdAt,
      updatedAt: updated.updatedAt?.toISOString?.() || updated.updatedAt,
      date: updated.date?.toISOString?.() || updated.date
    };
    
    state.expenseReports = state.expenseReports.map(r => r.id === req.params.id ? reportToStore : r);
    debouncedSave();
    
    console.log('✅ Expense report mis à jour:', req.params.id, '- nouveau statut:', updated.status);
    res.json({ report: reportToStore });
  } catch (e) {
    console.error('❌ PUT /api/finance/expense-reports error:', e.message, e.code);
    // Fallback: update in memory
    const updatedData = { ...req.body, updatedAt: new Date().toISOString() };
    state.expenseReports = state.expenseReports.map(r => r.id === req.params.id ? { ...r, ...updatedData } : r);
    const report = state.expenseReports.find(r => r.id === req.params.id);
    debouncedSave();
    console.log('⚠️ Fallback mode - expense report mis à jour en mémoire:', req.params.id);
    res.json({ report });
  }
});
app.post(['/finance/expense-reports/:id/close', '/api/finance/expense-reports/:id/close'], requireAuth, (req, res) => {
  state.expenseReports = state.expenseReports.map(r => r.id === req.params.id ? { ...r, status: 'closed', closedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : r);
  const report = state.expenseReports.find(r => r.id === req.params.id);
  debouncedSave();
  res.json({ report });
});
app.post(['/finance/expense-reports/:id/reimburse', '/api/finance/expense-reports/:id/reimburse'], requireAuth, (req, res) => {
  state.expenseReports = state.expenseReports.map(r => r.id === req.params.id ? { ...r, status: 'reimbursed', reimbursedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : r);
  const report = state.expenseReports.find(r => r.id === req.params.id);
  debouncedSave();
  res.json({ report });
});
app.post(['/finance/expense-reports/:id/status', '/api/finance/expense-reports/:id/status'], requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    await ensureExpenseReportColumns();
    
    // Get report before updating to notify creator
    const reportBefore = state.expenseReports.find(r => r.id === req.params.id) || 
                         await prisma.finance_expense_reports.findUnique({ where: { id: req.params.id } });
    
    // Update in Prisma
    const updated = await prisma.finance_expense_reports.update({
      where: { id: req.params.id },
      data: { status, updatedAt: new Date() }
    });
    
    // Update memory
    state.expenseReports = state.expenseReports.map(r => r.id === req.params.id ? { ...updated, updatedAt: updated.updatedAt.toISOString() } : r);
    const report = state.expenseReports.find(r => r.id === req.params.id);
    debouncedSave();
    
    // 🔔 CREATE NOTIFICATION: status change notification
    // Notify the creator (userId) about the status change
    if (reportBefore && reportBefore.userId) {
      const statusMessages = {
        'approved': '✅ approuvée',
        'rejected': '❌ refusée',
        'processing': '⏳ en traitement',
        'reimbursed': '💰 remboursée',
        'closed': '🔒 fermée'
      };
      const statusDisplay = statusMessages[status] || status;
      const notificationMsg = `Votre note de frais (${reportBefore.description || 'sans description'}, ${reportBefore.amount}€) a été ${statusDisplay}`;
      const notification = {
        id: 'n' + Date.now(),
        type: 'expense_report_status',
        message: notificationMsg,
        createdAt: new Date().toISOString(),
        read: false,
        metadata: { expenseReportId: req.params.id, userId: reportBefore.userId, status }
      };
      state.notifications.unshift(notification);
      console.log('🔔 Notification changement statut:', notificationMsg);
    }
    
    res.json({ report });
  } catch (e) {
    console.error('❌ POST /api/finance/expense-reports/:id/status error:', e.message);
    // Fallback
    const { status } = req.body;
    const reportBefore = state.expenseReports.find(r => r.id === req.params.id);
    
    state.expenseReports = state.expenseReports.map(r => r.id === req.params.id ? { ...r, status, updatedAt: new Date().toISOString() } : r);
    const report = state.expenseReports.find(r => r.id === req.params.id);
    debouncedSave();
    
    // 🔔 Still send notification in fallback mode
    if (reportBefore && reportBefore.userId) {
      const statusMessages = {
        'approved': '✅ approuvée',
        'rejected': '❌ refusée',
        'processing': '⏳ en traitement',
        'reimbursed': '💰 remboursée',
        'closed': '🔒 fermée'
      };
      const statusDisplay = statusMessages[status] || status;
      const notificationMsg = `Votre note de frais (${reportBefore.description || 'sans description'}, ${reportBefore.amount}€) a été ${statusDisplay}`;
      const notification = {
        id: 'n' + Date.now(),
        type: 'expense_report_status',
        message: notificationMsg,
        createdAt: new Date().toISOString(),
        read: false,
        metadata: { expenseReportId: req.params.id, userId: reportBefore.userId, status }
      };
      state.notifications.unshift(notification);
    }
    
    res.json({ report });
  }
});
app.delete(['/finance/expense-reports/:id', '/api/finance/expense-reports/:id'], requireAuth, (req, res) => {
  state.expenseReports = state.expenseReports.filter(r => r.id !== req.params.id);
  debouncedSave();
  res.json({ ok: true });
});

// ============================================
// DETTES ET CRÉANCES
// ============================================
app.get(['/finance/debts', '/api/finance/debts'], requireAuth, async (req, res) => {
  try {
    const debts = await prisma.debt.findMany({
      orderBy: { createdAt: 'desc' }
    });
    // Calculer le montant restant et enrichir la réponse
    const enrichedDebts = await Promise.all(debts.map(async (debt) => {
      // Récupérer les transactions liées pour afficher le détail des paiements
      const linkedTx = await prisma.finance_transactions.findMany({
        where: { linkedDocumentId: debt.id },
        orderBy: { date: 'desc' },
        select: { id: true, amount: true, date: true, description: true, type: true }
      });
      return {
        ...debt,
        paidAmount: debt.paidAmount || 0,
        remainingAmount: Math.max(0, debt.amount - (debt.paidAmount || 0)),
        progressPercent: debt.amount > 0 ? Math.min(100, Math.round(((debt.paidAmount || 0) / debt.amount) * 100)) : 0,
        linkedTransactions: linkedTx
      };
    }));
    res.json({ debts: enrichedDebts });
  } catch (e) {
    console.error('❌ GET /api/finance/debts error:', e.message);
    res.status(500).json({ error: 'Erreur chargement dettes' });
  }
});

// POST /api/finance/debts/recalculate - Recalculer toutes les dettes basées sur leurs transactions liées
app.post(['/finance/debts/recalculate', '/api/finance/debts/recalculate'], requireAuth, async (req, res) => {
  try {
    console.log('🔄 Recalcul de toutes les dettes...');
    
    const debts = await prisma.debt.findMany();
    let updated = 0;
    
    for (const debt of debts) {
      // Récupérer toutes les transactions liées
      const linkedTx = await prisma.finance_transactions.findMany({
        where: { linkedDocumentId: debt.id }
      });
      
      if (linkedTx.length === 0) continue;
      
      // Recalculer amount et paidAmount selon la logique intelligente
      let newAmount = 0;
      let newPaidAmount = 0;
      const isDette = debt.type === 'DETTE';
      const isTropPercu = debt.debtNature === 'TROP_PERCU';
      
      for (const tx of linkedTx) {
        const txAmount = Math.abs(tx.amount || 0);
        const isDebit = tx.type === 'DEBIT';
        
        let shouldIncreaseAmount;
        if (isTropPercu) {
          shouldIncreaseAmount = (isDette && !isDebit) || (!isDette && isDebit);
        } else {
          shouldIncreaseAmount = (isDette && isDebit) || (!isDette && !isDebit);
        }
        
        if (shouldIncreaseAmount) {
          // Transaction crée/augmente la dette/créance
          newAmount += txAmount;
        } else {
          // Transaction rembourse la dette/créance
          newPaidAmount += txAmount;
        }
      }
      
      // Calculer le statut
      const newStatus = newAmount > 0 && newPaidAmount >= newAmount ? 'PAYÉE' : debt.status === 'ANNULÉE' ? 'ANNULÉE' : 'EN_COURS';
      
      // Mettre à jour la dette
      await prisma.debt.update({
        where: { id: debt.id },
        data: {
          amount: newAmount,
          paidAmount: newPaidAmount,
          status: newStatus,
          updatedAt: new Date()
        }
      });
      
      console.log(`✅ Dette ${debt.id} recalculée: amount=${newAmount}, paidAmount=${newPaidAmount}, status=${newStatus}`);
      updated++;
    }
    
    console.log(`🎉 ${updated} dettes recalculées`);
    res.json({ ok: true, updated, message: `${updated} dettes recalculées avec succès` });
  } catch (e) {
    console.error('❌ Erreur recalcul dettes:', e.message);
    res.status(500).json({ error: 'Erreur recalcul dettes', details: e.message });
  }
});

app.post(['/finance/debts', '/api/finance/debts'], requireAuth, async (req, res) => {
  try {
    const { type, amount, description, debtorType, debtorName, debtorId, dueDate, status, notes } = req.body;
    
    // Validation: amount peut être 0 (pour constituer progressivement), mais doit être défini
    if (!type || amount === undefined || amount === null || !description || !debtorName) {
      return res.status(400).json({ error: 'Champs requis manquants' });
    }

    const debt = await prisma.debt.create({
      data: {
        id: `debt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        amount: parseFloat(amount),
        paidAmount: 0,
        description,
        debtorType: debtorType || 'OTHER',
        debtorName,
        debtorId: debtorId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: status || 'EN_COURS',
        notes: notes || null,
        createdBy: req.userId || null,
        updatedAt: new Date()
      }
    });

    res.json({ debt: { ...debt, remainingAmount: debt.amount, progressPercent: 0, linkedTransactions: [] } });
  } catch (e) {
    console.error('❌ POST /api/finance/debts error:', e.message);
    res.status(500).json({ error: 'Erreur création dette' });
  }
});

app.patch(['/finance/debts/:id', '/api/finance/debts/:id'], requireAuth, async (req, res) => {
  try {
    const allowedFields = ['status', 'description', 'amount', 'debtorName', 'debtorType', 'debtorId', 'dueDate', 'notes', 'type'];
    const updateData = { updatedAt: new Date() };
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'amount') updateData[field] = parseFloat(req.body[field]);
        else if (field === 'dueDate') updateData[field] = req.body[field] ? new Date(req.body[field]) : null;
        else updateData[field] = req.body[field];
      }
    }

    const debt = await prisma.debt.update({
      where: { id: req.params.id },
      data: updateData
    });

    // Si le montant total a changé, vérifier si la dette est maintenant entièrement réglée
    if (updateData.amount !== undefined) {
      const newStatus = debt.paidAmount >= debt.amount ? 'PAYÉE' : (debt.status === 'ANNULÉE' ? 'ANNULÉE' : 'EN_COURS');
      if (newStatus !== debt.status) {
        await prisma.debt.update({ where: { id: debt.id }, data: { status: newStatus, updatedAt: new Date() } });
        debt.status = newStatus;
      }
    }

    res.json({ debt: { ...debt, remainingAmount: Math.max(0, debt.amount - (debt.paidAmount || 0)), progressPercent: debt.amount > 0 ? Math.min(100, Math.round(((debt.paidAmount || 0) / debt.amount) * 100)) : 0 } });
  } catch (e) {
    console.error('❌ PATCH /api/finance/debts/:id error:', e.message);
    res.status(500).json({ error: 'Erreur mise à jour dette' });
  }
});

app.delete(['/finance/debts/:id', '/api/finance/debts/:id'], requireAuth, async (req, res) => {
  try {
    await prisma.debt.delete({
      where: { id: req.params.id }
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('❌ DELETE /api/finance/debts/:id error:', e.message);
    res.status(500).json({ error: 'Erreur suppression dette' });
  }
});

// EXPORT placeholder
app.get(['/finance/export', '/api/finance/export'], requireAuth, (req, res) => {
  res.header('Content-Type','text/csv');
  res.send('Date,Type,Description,Montant\n');
});

// PERMISSIONS & ADMIN endpoints
app.get('/api/admin/users', requireAuth, async (req, res) => {
  try {
    // Récupérer depuis site_users (la table des comptes d'accès)
    const siteUsers = await prisma.site_users.findMany({
      include: {
        members: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            matricule: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    // Formater pour le frontend
    const users = siteUsers.map(u => ({
      id: u.id,
      username: u.username,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      role: u.role,
      status: u.isActive ? 'ACTIVE' : 'DISABLED',
      passwordStatus: u.mustChangePassword ? 'TEMPORARY' : 'PERMANENT',
      hasInternalAccess: u.hasInternalAccess,
      hasExternalAccess: u.hasExternalAccess,
      lastLoginAt: u.lastLoginAt,
      linkedMemberId: u.linkedMemberId,
      linkedMemberName: u.members ? `${u.members.firstName} ${u.members.lastName}` : null,
      linkedMemberMatricule: u.members?.matricule || null,
      createdAt: u.createdAt,
      mustChangePassword: u.mustChangePassword
    }));
    
    res.json(users);
  } catch (e) {
    console.error('❌ GET /api/admin/users error:', e.message);
    res.status(500).json({ error: 'Failed to fetch users', details: e.message });
  }
});

app.post('/api/admin/users', requireAuth, async (req, res) => {
  try {
    const { email, firstName, lastName, matricule, password, temporaryPassword, role, mustChangePassword } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'firstName and lastName are required' });
    }
    
    // Check if user already exists in Prisma
    const existingInPrisma = await prisma.members.findUnique({
      where: { email }
    });
    
    if (existingInPrisma) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }
    
    // Use password from any source (password, temporaryPassword, or generate new)
    const tempPassword = password || temporaryPassword || generateTemporaryPassword();
    const hashedPassword = hashPasswordForStorage(tempPassword);
    
    // Determine if password must be changed
    // If mustChangePassword is explicitly set, use it; otherwise, default to true if no password provided
    const shouldChangePwd = mustChangePassword !== undefined ? mustChangePassword : (!password);
    
    // Create in Prisma (single source of truth)
    const newMember = await prisma.members.create({
      data: {
        id: uid(),
        email,
        firstName,
        lastName,
        matricule: matricule || '',
        password: hashedPassword,
        isPasswordTemporary: shouldChangePwd,
        mustChangePassword: shouldChangePwd,
        role: role || 'USER',
        status: 'active',
        permissions: {},
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    
    // Also add to state.members for in-memory access
    state.members.push({
      id: newMember.id,
      email: newMember.email,
      firstName: newMember.firstName,
      lastName: newMember.lastName,
      matricule: newMember.matricule,
      password: newMember.password,
      role: newMember.role,
      status: newMember.status,
      isPasswordTemporary: newMember.isPasswordTemporary,
      mustChangePassword: newMember.mustChangePassword,
      permissions: newMember.permissions || {},
      createdAt: newMember.createdAt.toISOString()
    });
    
    debouncedSave();
    
    console.log('✅ User créé:', newMember.id, email, 'role:', role, 'mustChangePassword:', newMember.mustChangePassword, 'tempPassword:', tempPassword);
    
    // Send email with credentials using mailback password template
    try {
      await sendTemplatedEmail(
        'mailback password',
        email,
        {
          firstName: newMember.firstName,
          lastName: newMember.lastName,
          urbex_id: newMember.matricule || email,
          temporar_mdp: tempPassword
        },
        'RétroBus Essonne - Identifiants'
      );
      console.log('✅ Email de bienvenue envoyé à:', email);
    } catch (emailError) {
      console.error('⚠️ Erreur envoi email de bienvenue:', emailError.message);
      // Continue even if email fails
    }
    
    res.status(201).json({ 
      user: newMember,
      emailSent: true,
      message: 'Utilisateur créé. Un email avec les identifiants a été envoyé à ' + email
    });
  } catch (e) {
    console.error('❌ POST /api/admin/users error:', e.message);
    res.status(500).json({ error: 'Failed to create user', details: e.message });
  }
});

// PUT /api/admin/users/:id - Update user
app.put('/api/admin/users/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, role, hasInternalAccess, hasExternalAccess } = req.body;

    // Try site_users first (admin users)
    let existingUser = await prisma.site_users.findUnique({
      where: { id }
    });

    if (existingUser) {
      // Update in site_users (admin accounts)
      const updatedUser = await prisma.site_users.update({
        where: { id },
        data: {
          firstName: firstName !== undefined ? firstName : existingUser.firstName,
          lastName: lastName !== undefined ? lastName : existingUser.lastName,
          role: role !== undefined ? role : existingUser.role,
          hasInternalAccess: hasInternalAccess !== undefined ? hasInternalAccess : existingUser.hasInternalAccess,
          hasExternalAccess: hasExternalAccess !== undefined ? hasExternalAccess : existingUser.hasExternalAccess,
          updatedAt: new Date()
        }
      });

      // Also update in state if exists
      const stateIndex = state.members.findIndex(m => m.id === id);
      if (stateIndex !== -1) {
        state.members[stateIndex] = {
          ...state.members[stateIndex],
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          role: updatedUser.role,
          hasInternalAccess: updatedUser.hasInternalAccess,
          hasExternalAccess: updatedUser.hasExternalAccess
        };
      }

      debouncedSave();
      console.log('✅ Admin user updated:', id, firstName, lastName, `intranet:${hasInternalAccess}`, `externe:${hasExternalAccess}`);
      return res.json({ user: updatedUser });
    }

    // Fall back to members (member accounts)
    existingUser = await prisma.members.findUnique({
      where: { id }
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update in members
    const updatedMember = await prisma.members.update({
      where: { id },
      data: {
        firstName: firstName !== undefined ? firstName : existingUser.firstName,
        lastName: lastName !== undefined ? lastName : existingUser.lastName,
        role: role !== undefined ? role : existingUser.role,
        updatedAt: new Date()
      }
    });

    // Also update in state.members
    const stateIndex = state.members.findIndex(m => m.id === id);
    if (stateIndex !== -1) {
      state.members[stateIndex] = {
        ...state.members[stateIndex],
        firstName: updatedMember.firstName,
        lastName: updatedMember.lastName,
        role: updatedMember.role
      };
    }

    debouncedSave();
    console.log('✅ Member updated:', id, firstName, lastName);
    res.json({ user: updatedMember });
  } catch (e) {
    console.error('❌ PUT /api/admin/users/:id error:', e.message);
    res.status(500).json({ error: 'Failed to update user', details: e.message });
  }
});

// DELETE /api/admin/users/:id - Delete user
app.delete('/api/admin/users/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const existingUser = await prisma.members.findUnique({
      where: { id }
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete from Prisma
    await prisma.members.delete({
      where: { id }
    });

    // Remove from state.members
    state.members = state.members.filter(m => m.id !== id);

    debouncedSave();

    console.log('✅ User deleted:', id);
    res.json({ success: true, message: 'User deleted' });
  } catch (e) {
    console.error('❌ DELETE /api/admin/users/:id error:', e.message);
    res.status(500).json({ error: 'Failed to delete user', details: e.message });
  }
});

// POST /api/admin/users/create-with-password - Create user with permanent password (no temporary redirect)
app.post('/api/admin/users/create-with-password', requireAuth, async (req, res) => {
  try {
    const { email, firstName, lastName, password, role } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'firstName and lastName are required' });
    }
    
    // Check if user already exists
    const existingInPrisma = await prisma.members.findUnique({
      where: { email }
    });
    
    if (existingInPrisma) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }
    
    // Store with hashed password (permanent)
    const hashedPassword = hashPasswordForStorage(password);
    
    // Create with PERMANENT password - no temporary redirect
    const newMember = await prisma.members.create({
      data: {
        id: uid(),
        email,
        firstName,
        lastName,
        password: hashedPassword,
        role: role || 'USER',
        status: 'active',
        permissions: {},
        isPasswordTemporary: false,
        mustChangePassword: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    
    // Also add to state.members
    state.members.push({
      id: newMember.id,
      email: newMember.email,
      firstName: newMember.firstName,
      lastName: newMember.lastName,
      password: newMember.password,
      role: newMember.role,
      status: newMember.status,
      isPasswordTemporary: false,
      mustChangePassword: false,
      permissions: newMember.permissions || {},
      createdAt: newMember.createdAt.toISOString()
    });
    
    debouncedSave();
    
    console.log(`✅ Admin créé: ${email} (mot de passe permanent, pas de redirection)`);
    res.status(201).json({ 
      user: newMember,
      message: 'User created with permanent password - no temporary redirect',
      loginInfo: {
        email: newMember.email,
        password: password
      }
    });
  } catch (e) {
    console.error('❌ POST /api/admin/users/create-with-password error:', e.message);
    res.status(500).json({ error: 'Failed to create user', details: e.message });
  }
});

// POST /api/admin/users/:id/reset-password - Generate temporary password
app.post('/api/admin/users/:id/reset-password', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { alternativeEmail } = req.body;

    // Check if user exists in members
    let user = await prisma.members.findUnique({
      where: { id }
    });

    let isSiteUser = false;
    
    // If not found in members, check site_users (with members relation for matricule)
    if (!user) {
      user = await prisma.site_users.findUnique({
        where: { id },
        include: {
          members: {
            select: {
              matricule: true
            }
          }
        }
      });
      isSiteUser = true;
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Determine target email (alternative or default)
    const targetEmail = alternativeEmail && alternativeEmail.trim() ? alternativeEmail.trim() : user.email;

    // Generate temporary password
    const tempPassword = generateTemporaryPassword();
    const hashedPassword = hashPasswordForStorage(tempPassword);

    // Update user with hashed temporary password
    let updatedUser;
    let userMatricule;
    let syncedMemberId = null;
    
    if (isSiteUser) {
      updatedUser = await prisma.site_users.update({
        where: { id },
        data: {
          password: hashedPassword,
          mustChangePassword: true,
          updatedAt: new Date()
        },
        include: {
          members: {
            select: {
              matricule: true
            }
          }
        }
      });

      // Keep members auth source in sync.
      // Priority: linked member, fallback by same email if account is not linked.
      let memberToSyncId = updatedUser.linkedMemberId || null;
      if (!memberToSyncId && updatedUser.email) {
        const memberByEmail = await prisma.members.findFirst({
          where: { email: updatedUser.email },
          select: { id: true }
        });
        memberToSyncId = memberByEmail?.id || null;
      }

      if (memberToSyncId) {
        await prisma.members.update({
          where: { id: memberToSyncId },
          data: {
            password: hashedPassword,
            isPasswordTemporary: true,
            mustChangePassword: true,
            updatedAt: new Date()
          }
        }).catch(() => null);

        const stateIndex = state.members.findIndex(m => m.id === memberToSyncId);
        if (stateIndex !== -1) {
          state.members[stateIndex] = {
            ...state.members[stateIndex],
            password: hashedPassword,
            isPasswordTemporary: true,
            mustChangePassword: true
          };
        }

        syncedMemberId = memberToSyncId;
      }

      // Get matricule from linked member
      userMatricule = updatedUser.members?.matricule || updatedUser.email;
    } else {
      updatedUser = await prisma.members.update({
        where: { id },
        data: {
          password: hashedPassword,
          isPasswordTemporary: true,
          mustChangePassword: true,
          updatedAt: new Date()
        }
      });
      // Get matricule directly from member
      userMatricule = updatedUser.matricule || updatedUser.email;

      // Update in memory state for members
      const stateIndex = state.members.findIndex(m => m.id === id);
      if (stateIndex !== -1) {
        state.members[stateIndex] = {
          ...state.members[stateIndex],
          password: hashedPassword,
          isPasswordTemporary: true,
          mustChangePassword: true
        };
      }
      syncedMemberId = id;
    }

    debouncedSave();

    console.log('✅ Temporary password generated for user:', id, isSiteUser ? '(site_users)' : '(members)');
    
    // Send email with new credentials using mailback password template
    try {
      await sendTemplatedEmail(
        'mailback password',
        targetEmail,
        {
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          urbex_id: userMatricule,
          temporar_mdp: tempPassword
        },
        'RétroBus Essonne - Nouveau mot de passe'
      );
      console.log('✅ Email de réinitialisation envoyé à:', targetEmail);
      if (alternativeEmail && alternativeEmail.trim()) {
        console.log('   (Email alternatif utilisé au lieu de:', updatedUser.email + ')');
      }
    } catch (emailError) {
      console.error('⚠️ Erreur envoi email de réinitialisation:', emailError.message);
      // Continue even if email fails
    }
    
    res.json({ 
      success: true,
      emailSent: true,
      tempPassword: tempPassword,
      temporaryPassword: tempPassword,
      message: 'Mot de passe réinitialisé. Un email avec les nouveaux identifiants a été envoyé à ' + targetEmail,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName
      },
      syncedMemberId
    });
  } catch (e) {
    console.error('❌ POST /api/admin/users/:id/reset-password error:', e.message);
    res.status(500).json({ error: 'Failed to reset password', details: e.message });
  }
});

// POST /api/admin/users/:id/link-member - Link site_users account to a members record
app.post('/api/admin/users/:id/link-member', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { memberId } = req.body;

    if (!memberId) {
      return res.status(400).json({ error: 'memberId is required' });
    }

    // Vérifier que le compte site_users existe
    const siteUser = await prisma.site_users.findUnique({
      where: { id }
    });

    if (!siteUser) {
      return res.status(404).json({ error: 'Site user account not found' });
    }

    // Vérifier que le membre existe
    const member = await prisma.members.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        matricule: true,
        email: true
      }
    });

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Vérifier qu'aucun autre site_users n'est déjà lié à ce membre
    const existingLink = await prisma.site_users.findFirst({
      where: {
        linkedMemberId: memberId,
        NOT: { id: id }
      }
    });

    if (existingLink) {
      return res.status(400).json({ 
        error: 'Ce membre est déjà lié à un autre compte d\'accès',
        existingAccount: {
          username: existingLink.username,
          email: existingLink.email
        }
      });
    }

    // Mettre à jour le lien
    const updated = await prisma.site_users.update({
      where: { id },
      data: {
        linkedMemberId: memberId,
        updatedAt: new Date()
      },
      include: {
        members: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            matricule: true,
            email: true
          }
        }
      }
    });

    console.log(`✅ Linked site_user ${id} to member ${memberId} (${member.firstName} ${member.lastName}, matricule: ${member.matricule})`);

    res.json({
      success: true,
      message: 'Compte lié au membre avec succès',
      linkedMember: {
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        matricule: member.matricule,
        email: member.email
      }
    });
  } catch (e) {
    console.error('❌ POST /api/admin/users/:id/link-member error:', e.message);
    res.status(500).json({ error: 'Failed to link member', details: e.message });
  }
});

// POST /api/auth/change-password - Change user password
app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  try {
    // 🔐 Validation et sanitization des entrées
    const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
    const confirmPassword = typeof req.body?.confirmPassword === 'string' ? req.body.confirmPassword : '';
    const userEmail = req.user?.id; // Decoded from token (usually email)

    if (!userEmail) {
      auditLog('PASSWORD_CHANGE_NOT_AUTH', 'ANONYMOUS', { reason: 'No auth' }, 'failed');
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!currentPassword || !newPassword) {
      auditLog('PASSWORD_CHANGE_MISSING_FIELDS', userEmail, { current: !!currentPassword, new: !!newPassword }, 'failed');
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword !== confirmPassword) {
      auditLog('PASSWORD_CHANGE_MISMATCH', userEmail, { path: '/api/auth/change-password' }, 'failed');
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    // Try to find user in members by email first
    let user = await prisma.members.findFirst({
      where: { 
        OR: [
          { email: userEmail },
          { id: userEmail }
        ]
      }
    });
    let userType = 'members';

    // If not found in members, try site_users by email
    if (!user) {
      user = await prisma.site_users.findFirst({
        where: {
          OR: [
            { email: userEmail },
            { username: userEmail },
            { id: userEmail }
          ]
        }
      });
      userType = 'site_users';
    }

    // Fallback to state.members if still not found
    if (!user) {
      user = state.members.find(m => m.id === userEmail || m.email === userEmail);
      userType = 'state_members';
    }

    if (!user) {
      auditLog('PASSWORD_CHANGE_USER_NOT_FOUND', userEmail, { searchType: userType }, 'failed');
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    if (!user.password || !verifyPassword(currentPassword, user.password)) {
      auditLog('PASSWORD_CHANGE_INVALID_CURRENT', userEmail, { userType }, 'failed');
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Validate new password strength
    const validation = validatePasswordStrength(newPassword);
    if (!validation.isValid) {
      auditLog('PASSWORD_CHANGE_WEAK_PASSWORD', userEmail, { requirements: validation.errors }, 'failed');
      return res.status(400).json({ 
        error: 'Password does not meet requirements',
        requirements: validation.errors
      });
    }

    // Hash new password
    const hashedPassword = hashPasswordForStorage(newPassword);

    // Update user based on type
    if (userType === 'members') {
      await prisma.members.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          isPasswordTemporary: false,
          mustChangePassword: false,
          updatedAt: new Date()
        }
      });
    } else if (userType === 'site_users') {
      await prisma.site_users.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          mustChangePassword: false,
          updatedAt: new Date()
        }
      });
    }

    // Update in memory state
    const stateIndex = state.members.findIndex(m => m.id === user.id);
    if (stateIndex !== -1) {
      state.members[stateIndex] = {
        ...state.members[stateIndex],
        password: hashedPassword,
        isPasswordTemporary: false,
        mustChangePassword: false
      };
    }

    debouncedSave();

    auditLog('PASSWORD_CHANGE_SUCCESS', userEmail, { userType, userId: user.id }, 'success');
    res.json({ 
      success: true,
      message: 'Password changed successfully'
    });
  } catch (e) {
    console.error('❌ POST /api/auth/change-password error:', e.message);
    auditLog('PASSWORD_CHANGE_EXCEPTION', req.user?.id, { error: e.message }, 'failed');
    res.status(500).json({ error: 'Failed to change password' });
  }
});

app.get(['/api/admin/users/:id/permissions', '/api/user-permissions/:id'], requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Try site_users first (main source for admin users list)
    const siteUser = await prisma.site_users.findUnique({ where: { id } });
    if (siteUser) {
      const rows = await prisma.user_permissions.findMany({ where: { userId: id } });
      const permissionMap = rows.reduce((acc, row) => {
        acc[row.resource] = Array.isArray(row.actions) ? row.actions : [];
        return acc;
      }, {});

      return res.json({
        userId: id,
        email: siteUser.email,
        permissions: permissionMap
      });
    }

    // Fallback to members
    const member = await prisma.members.findUnique({ where: { id } });
    if (member) {
      let permissionMap = {};
      const raw = member.permissions;
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        permissionMap = raw;
      } else if (Array.isArray(raw)) {
        permissionMap = raw.reduce((acc, p) => {
          if (p?.resource) acc[p.resource] = Array.isArray(p.actions) ? p.actions : [];
          return acc;
        }, {});
      }

      return res.json({
        userId: id,
        email: member.email,
        permissions: permissionMap
      });
    }

    // Keep compatibility with later duplicated route definitions
    return next();
  } catch (e) {
    console.error('❌ GET /api/admin/users/:id/permissions error:', e.message);
    return res.status(500).json({ error: 'Failed to fetch permissions', details: e.message });
  }
});

// NEWSLETTER endpoints
app.get('/newsletter', requireAuth, (req, res) => {
  const subscribers = state.members.map(m => ({
    id: m.id,
    email: m.email,
    status: 'CONFIRMED',
    subscribedAt: m.createdAt,
    firstName: m.firstName,
    lastName: m.lastName
  }));
  res.json(subscribers);
});

app.post('/newsletter', requireAuth, (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email required' });
  const id = 'sub_' + uid();
  const subscriber = {
    id,
    email,
    status: 'CONFIRMED',
    subscribedAt: new Date().toISOString()
  };
  state.members.push({
    id: subscriber.id,
    email: subscriber.email,
    firstName: email.split('@')[0],
    lastName: 'Newsletter',
    status: 'active',
    permissions: [],
    createdAt: new Date().toISOString()
  });
  res.status(201).json(subscriber);
});

app.get('/newsletter/:id', requireAuth, (req, res) => {
  const member = state.members.find(m => m.id === req.params.id);
  if (!member) return res.status(404).json({ error: 'Subscriber not found' });
  res.json({
    id: member.id,
    email: member.email,
    status: 'CONFIRMED',
    subscribedAt: member.createdAt
  });
});

app.put('/newsletter/:id/status', requireAuth, (req, res) => {
  const { status } = req.body || {};
  const idx = state.members.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Subscriber not found' });
  state.members[idx].status = status || 'active';
  res.json({ ok: true, status });
});

app.delete('/newsletter/:id', requireAuth, (req, res) => {
  state.members = state.members.filter(m => m.id !== req.params.id);
  res.json({ ok: true });
});

app.get('/newsletter/stats', requireAuth, (req, res) => {
  res.json({
    total: state.members.length,
    confirmed: state.members.length,
    pending: 0
  });
});

app.get('/newsletter/export', requireAuth, (req, res) => {
  const format = req.query.format || 'csv';
  if (format === 'csv') {
    res.header('Content-Type', 'text/csv');
    const csv = 'Email,Status,SubscribedAt\n' + 
      state.members.map(m => `"${m.email}","CONFIRMED","${m.createdAt}"`).join('\n');
    res.send(csv);
  } else {
    res.json(state.members.map(m => ({ email: m.email, status: 'CONFIRMED' })));
  }
});

// FINANCE API ALIASES - for frontend compatibility
// /api/finance/balance -> /api/finance/bank-balance
app.get('/api/finance/balance', (req, res) => {
  res.json({ balance: state.bankBalance });
});

// PUT /api/finance/balance - Update balance
app.put('/api/finance/balance', (req, res) => {
  try {
    const { balance, reason } = req.body;
    
    if (typeof balance !== 'number' || balance < 0) {
      return res.status(400).json({ error: 'Montant invalide' });
    }

    state.bankBalance = parseFloat(balance);
    console.log(`✅ Solde mis à jour: ${balance} (raison: ${reason || 'non spécifiée'})`);
    
    res.json({ 
      success: true,
      newBalance: state.bankBalance,
      message: 'Solde mis à jour avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur PUT /api/finance/balance:', error);
    res.status(500).json({ error: 'Erreur mise à jour solde' });
  }
});

// /api/finance/scheduled-operations -> /finance/scheduled-expenses - PERSISTED IN PRISMA
app.get('/api/finance/scheduled-operations', async (req, res) => {
  try {
    const { eventId } = req.query;
    // Load from Prisma
    let operations = await prisma.scheduled_operations.findMany({
      orderBy: { createdAt: 'desc' }
    });
    if (eventId) operations = operations.filter(x => x.id === eventId);
    
    // Sync with memory state
    if (operations.length > 0) {
      state.scheduled = operations;
      state.scheduledOperations = operations;
    }
    
    res.json({ operations });
  } catch (e) {
    console.warn('⚠️ Failed to load operations from Prisma:', e.message);
    const { eventId } = req.query;
    let list = state.scheduled;
    if (eventId) list = list.filter(x => x.eventId === eventId);
    res.json({ operations: list });
  }
});

app.post('/api/finance/scheduled-operations', requireAuth, async (req, res) => {
  try {
    const opId = uid();
    const totalAmount = parseFloat(req.body.totalAmount || req.body.amount || 0);
    const opData = {
      id: opId,
      type: req.body.type || 'expense',
      description: req.body.description || '',
      amount: req.body.amount || 0,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
      category: req.body.category || '',
      recurring: req.body.recurring || 'MONTHLY',
      frequency: req.body.frequency || 'MONTHLY',
      nextDate: req.body.nextDate ? new Date(req.body.nextDate) : null,
      notes: req.body.notes || '',
      isExecuted: false,
      createdBy: req.user?.name || req.user?.email || 'Anonymous',
      totalAmount: totalAmount,
      remainingTotalAmount: totalAmount,
      paymentsCount: 0,
      estimatedEndDate: req.body.estimatedEndDate ? new Date(req.body.estimatedEndDate) : null
    };
    
    // Save to Prisma
    const saved = await prisma.scheduled_operations.create({ data: opData });
    
    // Also update memory
    state.scheduled.push(saved);
    state.scheduledOperations.push(saved);
    debouncedSave();
    
    console.log('✅ Opération programmée créée dans Prisma:', opId);
    res.status(201).json(saved);
  } catch (e) {
    console.error('❌ POST /api/finance/scheduled-operations error:', e.message);
    // Fallback: save to memory only
    const op = { 
      id: uid(), 
      userId: req.user?.id || req.user?.email || 'anonymous',
      createdBy: req.user?.name || req.user?.email || 'Anonymous',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...req.body 
    };
    state.scheduled.push(op);
    state.scheduledOperations.push(op);
    debouncedSave();
    res.status(201).json(op);
  }
});

app.put('/api/finance/scheduled-operations/:id', requireAuth, async (req, res) => {
  try {
    const updateData = {
      ...req.body,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
      nextDate: req.body.nextDate ? new Date(req.body.nextDate) : undefined,
      estimatedEndDate: req.body.estimatedEndDate ? new Date(req.body.estimatedEndDate) : undefined
    };
    
    // Update in Prisma
    const updated = await prisma.scheduled_operations.update({
      where: { id: req.params.id },
      data: updateData
    });
    
    // Update memory state
    state.scheduled = state.scheduled.map(o => o.id === req.params.id ? updated : o);
    state.scheduledOperations = state.scheduledOperations.map(o => o.id === req.params.id ? updated : o);
    debouncedSave();
    
    console.log('✅ Opération programmée mise à jour dans Prisma:', req.params.id);
    res.json(updated);
  } catch (e) {
    console.error('❌ PUT /api/finance/scheduled-operations error:', e.message);
    // Fallback: update in memory
    state.scheduled = state.scheduled.map(o => o.id === req.params.id ? { ...o, ...req.body, updatedAt: new Date().toISOString() } : o);
    const op = state.scheduled.find(o => o.id === req.params.id);
    debouncedSave();
    res.json(op);
  }
});

app.delete('/api/finance/scheduled-operations/:id', requireAuth, async (req, res) => {
  try {
    // Delete from Prisma
    await prisma.scheduled_operations.delete({
      where: { id: req.params.id }
    });
    
    // Delete from memory
    state.scheduled = state.scheduled.filter(o => o.id !== req.params.id);
    state.scheduledOperations = state.scheduledOperations.filter(o => o.id !== req.params.id);
    debouncedSave();
    
    console.log('✅ Opération programmée supprimée de Prisma:', req.params.id);
    res.json({ ok: true });
  } catch (e) {
    console.error('❌ DELETE /api/finance/scheduled-operations error:', e.message);
    // Fallback: delete from memory
    state.scheduled = state.scheduled.filter(o => o.id !== req.params.id);
    state.scheduledOperations = state.scheduledOperations.filter(o => o.id !== req.params.id);
    debouncedSave();
    res.json({ ok: true });
  }
});

// ============================================================
// SIMULATIONS ENDPOINT - Financial scenario simulations
// ============================================================
app.get('/api/finance/simulations', requireAuth, async (req, res) => {
  try {
    const scenarios = await prisma.finance_simulation_scenarios.findMany({
      orderBy: { createdAt: 'desc' }
    });
    state.simulations = scenarios.map(s => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString()
    }));
    console.log('✅ Simulations chargées depuis Prisma');
    res.json(state.simulations || []);
  } catch (e) {
    console.error('⚠️ GET /api/finance/simulations fallback:', e.message);
    res.json(state.simulations || []);
  }
});

app.post('/api/finance/simulations', requireAuth, async (req, res) => {
  try {
    const scenarioId = uid();
    const scenarioData = {
      id: scenarioId,
      name: req.body.name || 'New Scenario',
      description: req.body.description || '',
      projectionMonths: req.body.projectionMonths || 12,
      status: 'DRAFT',
      createdBy: req.user?.name || req.user?.email || 'Anonymous'
    };
    
    const scenario = await prisma.finance_simulation_scenarios.create({
      data: scenarioData
    });
    
    const result = {
      ...scenario,
      createdAt: scenario.createdAt.toISOString(),
      updatedAt: scenario.updatedAt.toISOString(),
      incomeItems: [],
      expenseItems: []
    };
    
    state.simulations.push(result);
    debouncedSave();
    console.log('✅ Simulation créée dans Prisma:', scenarioId);
    res.status(201).json(result);
  } catch (e) {
    console.error('❌ POST /api/finance/simulations error:', e.message);
    // Fallback
    const scenario = {
      id: uid(),
      userId: req.user?.id || req.user?.email || 'anonymous',
      createdBy: req.user?.name || req.user?.email || 'Anonymous',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...req.body,
      incomeItems: req.body.incomeItems || [],
      expenseItems: req.body.expenseItems || []
    };
    state.simulations.push(scenario);
    debouncedSave();
    res.status(201).json(scenario);
  }
});

app.get('/api/finance/simulations/:id', requireAuth, (req, res) => {
  const scenario = state.simulations.find(s => s.id === req.params.id);
  if (!scenario) {
    return res.status(404).json({ error: 'Scenario not found' });
  }
  res.json(scenario);
});

app.put('/api/finance/simulations/:id', requireAuth, async (req, res) => {
  try {
    const updated = await prisma.finance_simulation_scenarios.update({
      where: { id: req.params.id },
      data: {
        name: req.body.name,
        description: req.body.description,
        projectionMonths: req.body.projectionMonths,
        status: req.body.status
      }
    });
    
    const result = {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString()
    };
    
    state.simulations = state.simulations.map(s => s.id === req.params.id ? result : s);
    debouncedSave();
    console.log('✅ Simulation mise à jour dans Prisma:', req.params.id);
    res.json(result);
  } catch (e) {
    console.error('❌ PUT /api/finance/simulations/:id error:', e.message);
    // Fallback
    const idx = state.simulations.findIndex(s => s.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Scenario not found' });
    }
    state.simulations[idx] = {
      ...state.simulations[idx],
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    debouncedSave();
    res.json(state.simulations[idx]);
  }
});

app.delete('/api/finance/simulations/:id', requireAuth, async (req, res) => {
  try {
    await prisma.finance_simulation_scenarios.delete({
      where: { id: req.params.id }
    });
    
    state.simulations = state.simulations.filter(s => s.id !== req.params.id);
    debouncedSave();
    console.log('✅ Simulation supprimée de Prisma:', req.params.id);
    res.json({ ok: true });
  } catch (e) {
    console.error('❌ DELETE /api/finance/simulations/:id error:', e.message);
    // Fallback
    state.simulations = state.simulations.filter(s => s.id !== req.params.id);
    debouncedSave();
    res.json({ ok: true });
  }
});

// Add income item to simulation
app.post('/api/finance/simulations/:id/income', requireAuth, (req, res) => {
  const scenario = state.simulations.find(s => s.id === req.params.id);
  if (!scenario) {
    return res.status(404).json({ error: 'Scenario not found' });
  }
  const item = {
    id: uid(),
    ...req.body,
    createdAt: new Date().toISOString()
  };
  if (!scenario.incomeItems) scenario.incomeItems = [];
  scenario.incomeItems.push(item);
  debouncedSave();
  res.status(201).json(item);
});

// Remove income item from simulation
app.delete('/api/finance/simulations/:id/income/:itemId', requireAuth, (req, res) => {
  const scenario = state.simulations.find(s => s.id === req.params.id);
  if (!scenario) {
    return res.status(404).json({ error: 'Scenario not found' });
  }
  if (!scenario.incomeItems) scenario.incomeItems = [];
  scenario.incomeItems = scenario.incomeItems.filter(i => i.id !== req.params.itemId);
  debouncedSave();
  res.json({ ok: true });
});

// Add expense item to simulation
app.post('/api/finance/simulations/:id/expense', requireAuth, (req, res) => {
  const scenario = state.simulations.find(s => s.id === req.params.id);
  if (!scenario) {
    return res.status(404).json({ error: 'Scenario not found' });
  }
  const item = {
    id: uid(),
    ...req.body,
    createdAt: new Date().toISOString()
  };
  if (!scenario.expenseItems) scenario.expenseItems = [];
  scenario.expenseItems.push(item);
  debouncedSave();
  res.status(201).json(item);
});

// Remove expense item from simulation
app.delete('/api/finance/simulations/:id/expense/:itemId', requireAuth, (req, res) => {
  const scenario = state.simulations.find(s => s.id === req.params.id);
  if (!scenario) {
    return res.status(404).json({ error: 'Scenario not found' });
  }
  if (!scenario.expenseItems) scenario.expenseItems = [];
  scenario.expenseItems = scenario.expenseItems.filter(e => e.id !== req.params.itemId);
  debouncedSave();
  res.json({ ok: true });
});

// Run simulation (calculate projection)
app.post('/api/finance/simulations/:id/run', requireAuth, (req, res) => {
  const scenario = state.simulations.find(s => s.id === req.params.id);
  if (!scenario) {
    return res.status(404).json({ error: 'Scenario not found' });
  }

  const { startingBalance = 0, projectionMonths = 12 } = req.body;
  const incomeItems = scenario.incomeItems || [];
  const expenseItems = scenario.expenseItems || [];

  // Helper: get frequency multiplier (times per year)
  const getFrequencyMultiplier = (freq) => {
    const freqMap = {
      'MONTHLY': 12,
      'QUARTERLY': 4,
      'SEMI_ANNUAL': 2,
      'YEARLY': 1,
      'ONE_SHOT': 0
    };
    return freqMap[freq] || 1;
  };

  // Calculate monthly amounts
  const monthlyIncome = incomeItems.reduce((sum, item) => {
    const multiplier = getFrequencyMultiplier(item.frequency);
    return sum + (parseFloat(item.amount) || 0) / (multiplier > 0 ? multiplier : 12);
  }, 0);

  const monthlyExpense = expenseItems.reduce((sum, item) => {
    const multiplier = getFrequencyMultiplier(item.frequency);
    return sum + (parseFloat(item.amount) || 0) / (multiplier > 0 ? multiplier : 12);
  }, 0);

  const monthlyNet = monthlyIncome - monthlyExpense;

  // Generate projection
  const projection = [];
  let currentBalance = startingBalance;
  for (let month = 1; month <= projectionMonths; month++) {
    currentBalance += monthlyNet;
    projection.push({
      month,
      startBalance: month === 1 ? startingBalance : projection[month - 2]?.endBalance || startingBalance,
      income: monthlyIncome,
      expenses: monthlyExpense,
      net: monthlyNet,
      endBalance: currentBalance
    });
  }

  const results = {
    scenarioId: scenario.id,
    projectionMonths,
    startingBalance,
    finalBalance: currentBalance,
    monthlyNet,
    totalChange: currentBalance - startingBalance,
    projection,
    summary: {
      isPositive: monthlyNet >= 0,
      breakEvenMonth: monthlyNet === 0 ? 1 : monthlyNet < 0 ? Math.ceil(-startingBalance / monthlyNet) : null,
      projectionMonths
    }
  };

  res.json(results);
});

// /api/finance/documents -> returns all documents (finance perspective)
app.get('/api/finance/documents', requireAuth, async (req, res) => {
  try {
    console.log('📥 GET /api/finance/documents started...');
    const docs = await prisma.financial_documents.findMany({
      orderBy: { createdAt: 'desc' }
    });
    console.log(`✅ ${docs.length} documents trouvés dans Prisma`);
    state.financialDocuments = docs.map(d => ({
      ...d,
      // Normaliser le statut selon le type
      status: d.type === 'INVOICE' ? (d.invoiceStatus || 'DRAFT') : (d.quoteStatus || 'DRAFT'),
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      date: d.date?.toISOString?.() || d.date,
      dueDate: d.dueDate?.toISOString?.() || d.dueDate
    }));
    console.log('✅ Documents financiers chargés et normalisés');
    res.json(state.financialDocuments || []);
  } catch (e) {
    console.error('❌ Erreur GET /api/finance/documents:', e.message);
    console.error('📋 Stack:', e.stack);
    res.status(500).json({
      success: false,
      error: 'Impossible de charger les documents',
      details: e.message
    });
  }
});

// POST /api/finance/documents -> create new document (devis/facture)
app.post('/api/finance/documents', requireAuth, async (req, res) => {
  try {
    const docId = uid();
    const type = req.body.type || 'QUOTE';
    const number = req.body.number || `${type === 'QUOTE' ? 'DEV' : 'FACT'}-${Date.now()}`;
    
    console.log(`📝 Creating new document: type=${type}, number=${number}`);
    
    const docData = {
      id: docId,
      type: type,
      number: number,
      title: req.body.title || '',
      description: req.body.description || null,
      date: req.body.date ? new Date(req.body.date) : new Date(),
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
      amount: Number(req.body.amount || 0),
      taxRate: Number(req.body.taxRate || 20),
      taxAmount: Number(req.body.taxAmount || 0),
      amountExcludingTax: Number(req.body.amountExcludingTax || 0),
      // Infos destinataire/client
      destinataireName: req.body.destinataireName || null,
      destinataireAdresse: req.body.destinataireAdresse || null,
      destinataireSociete: req.body.destinataireSociete || null,
      destinataireContacts: req.body.destinataireContacts || null,
      // Autres champs
      paymentTerms: req.body.paymentTerms || '30',
      paymentMethod: req.body.paymentMethod || null,
      notes: req.body.notes || null,
      internalNotes: req.body.internalNotes || null,
      // Initialiser le statut selon le type
      quoteStatus: type === 'QUOTE' ? 'DRAFT' : null,
      invoiceStatus: type === 'INVOICE' ? 'DRAFT' : null,
      createdBy: req.user?.email || req.user?.name || 'API',
      updatedAt: new Date()
    };
    
    console.log(`🔧 Document data prepared: ${JSON.stringify({...docData, documentUrl: docData.documentUrl ? '✅' : '❌'}).substring(0, 200)}...`);
    
    const doc = await prisma.financial_documents.create({
      data: docData
    });
    
    console.log(`✅ Document created in Prisma: ${docId}`);
    
    const result = {
      ...doc,
      status: type === 'INVOICE' ? (doc.invoiceStatus || 'DRAFT') : (doc.quoteStatus || 'DRAFT'),
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
      date: doc.date.toISOString(),
      dueDate: doc.dueDate?.toISOString?.() || null
    };
    
    state.financialDocuments.push(result);
    debouncedSave();
    
    res.status(201).json(result);
  } catch (e) {
    console.error('❌ POST /api/finance/documents error:', e.message);
    console.error('📋 Error code:', e.code);
    console.error('📋 Error meta:', e.meta);
    console.error('📋 Full error:', e);
    
    // Check for unique constraint violation
    if (e.code === 'P2002') {
      console.error('⚠️ Unique constraint violation on fields:', e.meta?.target);
      return res.status(400).json({
        success: false,
        error: 'Unique constraint violation',
        details: `Un document avec le type "${req.body.type}" et le numéro "${req.body.number}" existe déjà`,
        code: 'UNIQUE_CONSTRAINT'
      });
    }
    
    // Return error response instead of fallback
    res.status(500).json({
      success: false,
      error: 'Impossible de créer le document',
      details: e.message
    });
  }
});

// PUT /api/finance/documents/:id -> update document
app.put('/api/finance/documents/:id', requireAuth, async (req, res) => {
  try {
    const updateData = {
      title: req.body.title,
      description: req.body.description,
      htmlContent: req.body.htmlContent,
      amount: req.body.amount ? Number(req.body.amount) : undefined,
      taxRate: req.body.taxRate ? Number(req.body.taxRate) : undefined,
      taxAmount: req.body.taxAmount ? Number(req.body.taxAmount) : undefined,
      amountExcludingTax: req.body.amountExcludingTax ? Number(req.body.amountExcludingTax) : undefined,
      destinataireName: req.body.destinataireName,
      destinataireAdresse: req.body.destinataireAdresse,
      destinataireSociete: req.body.destinataireSociete,
      destinataireContacts: req.body.destinataireContacts,
      notes: req.body.notes,
      paymentTerms: req.body.paymentTerms,
      paymentMethod: req.body.paymentMethod
    };
    
    // Nettoyer les undefined
    Object.keys(updateData).forEach(k => updateData[k] === undefined && delete updateData[k]);
    
    const updated = await prisma.financial_documents.update({
      where: { id: req.params.id },
      data: updateData
    });
    
    const result = {
      ...updated,
      status: updated.type === 'INVOICE' ? (updated.invoiceStatus || 'DRAFT') : (updated.quoteStatus || 'DRAFT'),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      date: updated.date.toISOString(),
      dueDate: updated.dueDate?.toISOString?.() || null
    };
    
    state.financialDocuments = state.financialDocuments.map(d => d.id === req.params.id ? result : d);
    debouncedSave();
    console.log('✅ Document mis à jour dans Prisma:', req.params.id);
    res.json(result);
  } catch (e) {
    console.error('❌ PUT /api/finance/documents/:id error:', e.message);
    // Fallback
    const idx = state.financialDocuments.findIndex(d => d.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Document not found' });
    
    state.financialDocuments[idx] = {
      ...state.financialDocuments[idx],
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    debouncedSave();
    res.json(state.financialDocuments[idx]);
  }
});

// DELETE /api/finance/documents/:id -> delete document
app.delete('/api/finance/documents/:id', requireAuth, async (req, res) => {
  try {
    await prisma.financial_documents.delete({
      where: { id: req.params.id }
    });
    
    state.financialDocuments = state.financialDocuments.filter(d => d.id !== req.params.id);
    debouncedSave();
    console.log('✅ Document supprimé de Prisma:', req.params.id);
    res.json({ ok: true });
  } catch (e) {
    console.error('❌ DELETE /api/finance/documents/:id error:', e.message);
    // Fallback
    state.financialDocuments = state.financialDocuments.filter(d => d.id !== req.params.id);
    debouncedSave();
    res.json({ ok: true });
  }
});

// PATCH /api/finance/documents/:id/status -> update document status + auto-create invoice or transaction
app.patch(['/finance/documents/:id/status', '/api/finance/documents/:id/status'], requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // Trouver le document
    const docIdx = state.financialDocuments.findIndex(d => d.id === id);
    if (docIdx === -1) return res.status(404).json({ error: 'Document not found' });
    
    const doc = state.financialDocuments[docIdx];
    
    // Déterminer le champ de statut selon le type
    const statusField = doc.type === 'INVOICE' ? 'invoiceStatus' : 'quoteStatus';
    const oldStatus = doc[statusField] || doc.status;
    
    // Mettre à jour le statut dans state (en mémoire)
    state.financialDocuments[docIdx][statusField] = status;
    state.financialDocuments[docIdx].status = status; // Pour compatibilité
    state.financialDocuments[docIdx].updatedAt = new Date().toISOString();
    
    // Mettre à jour dans Prisma
    await prisma.financial_documents.update({
      where: { id },
      data: {
        [statusField]: status,
        updatedAt: new Date()
      }
    });
    
    let response = { ...state.financialDocuments[docIdx] };
    
    // ========== LOGIQUE MÉTIER ==========
    
    // Cas 1: Devis accepté (QUOTE + ACCEPTED) -> créer facture auto
    if (doc.type === 'QUOTE' && status === 'ACCEPTED' && oldStatus !== 'ACCEPTED') {
      try {
        // Créer la facture depuis le devis
        const invoiceId = uid();
        const invoiceNumber = `FAC-${doc.number.replace('DV-', '')}`;
        
        const invoiceData = {
          id: invoiceId,
          type: 'INVOICE',
          number: invoiceNumber,
          title: doc.title,
          description: doc.description,
          date: new Date(),
          dueDate: doc.dueDate,
          amountExcludingTax: doc.amountExcludingTax,
          taxRate: doc.taxRate || 0,
          taxAmount: doc.taxAmount || 0,
          amount: doc.amount,
          invoiceStatus: 'DRAFT',
          linkedQuoteId: doc.id,
          linkedQuoteNumber: doc.number,
          eventId: doc.eventId || '',
          memberId: doc.memberId || '',
          destinataireName: doc.destinataireName || '',
          destinataireAdresse: doc.destinataireAdresse || '',
          destinataireSociete: doc.destinataireSociete || '',
          destinataireContacts: doc.destinataireContacts || '',
          notes: doc.notes || '',
          createdBy: req.user?.name || req.user?.email || 'Anonymous',
          updatedAt: new Date()
        };
        
        // Créer dans Prisma
        const invoice = await prisma.financial_documents.create({
          data: invoiceData
        });
        
        const invoiceResult = {
          ...invoice,
          status: 'DRAFT',
          createdAt: invoice.createdAt.toISOString(),
          updatedAt: invoice.updatedAt.toISOString(),
          date: invoice.date.toISOString(),
          dueDate: invoice.dueDate?.toISOString?.() || null
        };
        
        state.financialDocuments.push(invoiceResult);
        response.invoiceCreated = true;
        response.invoiceId = invoiceId;
        response.invoiceNumber = invoiceNumber;
        
        console.log(`✅ Facture auto-créée à partir du devis ${doc.number}: ${invoiceNumber}`);
      } catch (invoiceErr) {
        console.error('❌ Erreur création facture auto:', invoiceErr.message);
        response.invoiceError = invoiceErr.message;
      }
    }
    
    // Cas 2: Facture marquée payée (INVOICE + PAID) -> créer opération automatique
    if (doc.type === 'INVOICE' && status === 'PAID' && oldStatus !== 'PAID') {
      try {
        // Vérifier si paiement ou acompte
        const amountPaid = parseFloat(doc.amountPaid || doc.amount) || 0;
        const fullAmount = parseFloat(doc.amount) || 0;
        const isFullPayment = Math.abs(amountPaid - fullAmount) < 0.01;
        
        const operationType = isFullPayment ? 'PAIEMENT FACT' : 'ACOMPTE FACT';
        const operationDescription = `${operationType} #${doc.number}`;
        
        const operation = {
          id: uid(),
          type: 'SCHEDULED_PAYMENT',
          description: operationDescription,
          amount: amountPaid,
          frequency: 'ONE_SHOT',
          nextDate: new Date().toISOString(),
          date: new Date().toISOString(),
          linkedDocumentId: doc.id,
          linkedDocumentNumber: doc.number,
          category: 'FACTURE',
          createdBy: req.user?.name || req.user?.email || 'Anonymous',
          createdAt: new Date().toISOString()
        };
        
        // Ajouter à l'état approprié selon le type
        if (!state.transactions) state.transactions = [];
        state.transactions.unshift(operation);
        
        // Mettre à jour le solde bancaire
        state.bankBalance += amountPaid;
        
        response.transactionCreated = true;
        response.transactionAmount = amountPaid;
        response.transactionDescription = operationDescription;
        
        console.log(`✅ Opération auto-créée pour facture payée: ${operationDescription} (${amountPaid}€)`);
      } catch (transErr) {
        console.error('❌ Erreur création opération auto:', transErr.message);
        response.transactionError = transErr.message;
      }
    }
    
    debouncedSave();
    res.json(response);
  } catch (e) {
    console.error('❌ PATCH /documents/:id/status error:', e.message);
    res.status(500).json({ error: 'Failed to update status', details: e.message });
  }
});

// Quote templates endpoint - retourner les templates depuis le backup
app.get('/api/quote-templates', requireAuth, (req, res) => {
  res.json(state.quoteTemplates || []);
});
app.post('/api/quote-templates', requireAuth, (req, res) => {
  const template = { 
    id: uid(), 
    userId: req.user?.id || req.user?.email || 'anonymous',
    createdBy: req.user?.name || req.user?.email || 'Anonymous',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...req.body 
  };
  state.quoteTemplates.push(template);
  debouncedSave();
  res.status(201).json(template);
});
app.put('/api/quote-templates/:id', requireAuth, (req, res) => {
  const idx = state.quoteTemplates.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  state.quoteTemplates[idx] = { ...state.quoteTemplates[idx], ...req.body, updatedAt: new Date().toISOString() };
  debouncedSave();
  res.json(state.quoteTemplates[idx]);
});
app.delete('/api/quote-templates/:id', requireAuth, (req, res) => {
  state.quoteTemplates = state.quoteTemplates.filter(t => t.id !== req.params.id);
  debouncedSave();
  res.json({ ok: true });
});

// Devis Lines endpoints
app.get('/api/devis-lines/:devisId', requireAuth, async (req, res) => {
  try {
    // Retourner les lignes du devis spécifique, ou toutes si devisId = "all"
    if (req.params.devisId === 'all') {
      const lines = await prisma.devisLine.findMany();
      return res.json(lines || []);
    }
    const lines = await prisma.devisLine.findMany({
      where: { devisId: req.params.devisId }
    });
    res.json({ lines });
  } catch (e) {
    console.error('❌ GET /api/devis-lines/:devisId error:', e.message);
    res.status(500).json({ error: 'Failed to fetch devis lines', details: e.message });
  }
});

app.get('/api/devis-lines', requireAuth, async (req, res) => {
  try {
    // Retourner toutes les lignes de devis
    const lines = await prisma.devisLine.findMany();
    res.json(lines || []);
  } catch (e) {
    console.error('❌ GET /api/devis-lines error:', e.message);
    res.status(500).json({ error: 'Failed to fetch devis lines', details: e.message });
  }
});

app.post('/api/devis-lines', requireAuth, async (req, res) => {
  try {
    const line = await prisma.devisLine.create({
      data: { 
        id: uid(),
        updatedAt: new Date(),
        ...req.body
      }
    });
    res.status(201).json(line);
  } catch (e) {
    console.error('❌ POST /api/devis-lines error:', e.message);
    res.status(500).json({ error: 'Failed to create devis line', details: e.message });
  }
});

app.put('/api/devis-lines/:lineId', requireAuth, async (req, res) => {
  try {
    const line = await prisma.devisLine.update({
      where: { id: req.params.lineId },
      data: req.body
    });
    res.json(line);
  } catch (e) {
    console.error('❌ PUT /api/devis-lines/:lineId error:', e.message);
    if (e?.code === 'P2025') {
      return res.status(404).json({ error: 'Line not found' });
    }
    res.status(500).json({ error: 'Failed to update devis line', details: e.message });
  }
});

app.delete('/api/devis-lines/:lineId', requireAuth, async (req, res) => {
  try {
    await prisma.devisLine.delete({
      where: { id: req.params.lineId }
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('❌ DELETE /api/devis-lines/:lineId error:', e.message);
    if (e?.code === 'P2025') {
      return res.status(404).json({ error: 'Line not found' });
    }
    res.status(500).json({ error: 'Failed to delete devis line', details: e.message });
  }
});

// ===== FACTURE-LINES ENDPOINTS =====
app.get('/api/facture-lines/:factureId', requireAuth, async (req, res) => {
  try {
    const lines = await prisma.factureLine.findMany({
      where: { factureId: req.params.factureId },
      orderBy: { order: 'asc' }
    });
    res.json(lines);
  } catch (e) {
    console.error('❌ GET /api/facture-lines/:factureId error:', e.message);
    res.status(500).json({ error: 'Failed to fetch facture lines', details: e.message });
  }
});

app.post('/api/facture-lines', requireAuth, async (req, res) => {
  try {
    const line = await prisma.factureLine.create({
      data: { 
        id: uid(),
        updatedAt: new Date(),
        ...req.body
      }
    });
    res.status(201).json(line);
  } catch (e) {
    console.error('❌ POST /api/facture-lines error:', e.message);
    res.status(500).json({ error: 'Failed to create facture line', details: e.message });
  }
});

app.put('/api/facture-lines/:lineId', requireAuth, async (req, res) => {
  try {
    const line = await prisma.factureLine.update({
      where: { id: req.params.lineId },
      data: req.body
    });
    res.json(line);
  } catch (e) {
    console.error('❌ PUT /api/facture-lines/:lineId error:', e.message);
    if (e?.code === 'P2025') {
      return res.status(404).json({ error: 'Line not found' });
    }
    res.status(500).json({ error: 'Failed to update facture line', details: e.message });
  }
});

app.delete('/api/facture-lines/:lineId', requireAuth, async (req, res) => {
  try {
    await prisma.factureLine.delete({
      where: { id: req.params.lineId }
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('❌ DELETE /api/facture-lines/:lineId error:', e.message);
    if (e?.code === 'P2025') {
      return res.status(404).json({ error: 'Line not found' });
    }
    res.status(500).json({ error: 'Failed to delete facture line', details: e.message });
  }
});

// Financial documents endpoint (devis, factures, documents)
app.get('/api/financial-documents', requireAuth, async (req, res) => {
  try {
    const docs = await prisma.financial_documents.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json({ financialDocuments: docs || [] });
  } catch (e) {
    console.error('❌ GET /api/financial-documents error:', e.message);
    res.status(500).json({ error: 'Failed to fetch financial documents', details: e.message });
  }
});

app.post('/api/financial-documents', requireAuth, async (req, res) => {
  try {
    const doc = await prisma.financial_documents.create({
      data: { 
        id: uid(),
        userId: req.user?.id || req.user?.email || 'anonymous',
        createdBy: req.user?.name || req.user?.email || 'Anonymous',
        updatedAt: new Date(),
        ...req.body
      }
    });
    res.status(201).json({ financialDocument: doc });
  } catch (e) {
    console.error('❌ POST /api/financial-documents error:', e.message);
    res.status(500).json({ error: 'Failed to create financial document', details: e.message });
  }
});

app.put('/api/financial-documents/:docId', requireAuth, async (req, res) => {
  try {
    const doc = await prisma.financial_documents.update({
      where: { id: req.params.docId },
      data: { ...req.body, updatedAt: new Date() }
    });
    res.json({ financialDocument: doc });
  } catch (e) {
    console.error('❌ PUT /api/financial-documents/:docId error:', e.message);
    if (e?.code === 'P2025') {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.status(500).json({ error: 'Failed to update financial document', details: e.message });
  }
});

app.delete('/api/financial-documents/:docId', requireAuth, async (req, res) => {
  try {
    await prisma.financial_documents.delete({
      where: { id: req.params.docId }
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('❌ DELETE /api/financial-documents/:docId error:', e.message);
    if (e?.code === 'P2025') {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.status(500).json({ error: 'Failed to delete financial document', details: e.message });
  }
});

// Email templates routes
app.use('/api/email-templates', requireAuth, emailTemplateRoutes);

// ===== ADMIN PROMOTION ENDPOINT =====
// POST /api/admin/users/:id/permissions - Set user permissions
app.post('/api/admin/users/:id/permissions', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { permissions, resource, actions } = req.body || {};

    // 1) site_users permissions (table user_permissions)
    const siteUser = await prisma.site_users.findUnique({ where: { id } });
    if (siteUser) {
      // Incremental toggle payload from frontend: { resource, actions: ["READ"] }
      if (resource && Array.isArray(actions) && actions.length > 0) {
        const existing = await prisma.user_permissions.findFirst({
          where: { userId: id, resource }
        });

        if (existing) {
          const merged = Array.from(new Set([...(existing.actions || []), ...actions]));
          await prisma.user_permissions.update({
            where: { id: existing.id },
            data: { actions: merged, updatedAt: new Date() }
          });
        } else {
          await prisma.user_permissions.create({
            data: {
              id: randomUUID(),
              userId: id,
              resource,
              actions,
              updatedAt: new Date()
            }
          });
        }
      }

      // Full replace payload: { permissions: { resource: [actions] } }
      if (permissions && typeof permissions === 'object' && !Array.isArray(permissions)) {
        await prisma.user_permissions.deleteMany({ where: { userId: id } });
        const entries = Object.entries(permissions).filter(([_, v]) => Array.isArray(v) && v.length > 0);
        if (entries.length > 0) {
          await prisma.user_permissions.createMany({
            data: entries.map(([resKey, acts]) => ({
              id: randomUUID(),
              userId: id,
              resource: resKey,
              actions: acts,
              updatedAt: new Date()
            }))
          });
        }
      }

      permissionsCache.delete(`perms_${id}`);
      return res.json({ ok: true, userId: id });
    }

    // 2) members fallback (legacy)
    const member = await prisma.members.findUnique({ where: { id } });
    if (!member) {
      return res.status(404).json({ error: 'User not found' });
    }

    let permissionMap = {};
    const raw = member.permissions;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      permissionMap = { ...raw };
    } else if (Array.isArray(raw)) {
      permissionMap = raw.reduce((acc, p) => {
        if (p?.resource) acc[p.resource] = Array.isArray(p.actions) ? p.actions : [];
        return acc;
      }, {});
    }

    if (resource && Array.isArray(actions) && actions.length > 0) {
      permissionMap[resource] = Array.from(new Set([...(permissionMap[resource] || []), ...actions]));
    }
    if (permissions && typeof permissions === 'object' && !Array.isArray(permissions)) {
      permissionMap = permissions;
    }

    const updatedMember = await prisma.members.update({
      where: { id },
      data: { permissions: permissionMap }
    });

    const stateUser = state.members.find(m => m.id === id);
    if (stateUser) stateUser.permissions = permissionMap;
    debouncedSave();

    console.log(`✅ Permissions updated for user ${id}`);
    res.json({ ok: true, user: updatedMember });
  } catch (e) {
    console.error('❌ POST /api/admin/users/:id/permissions error:', e.message);
    res.status(500).json({ error: 'Failed to update permissions', details: e.message });
  }
});

// DELETE /api/admin/users/:id/permissions/:resource/:action - Remove one action from a resource
app.delete('/api/admin/users/:id/permissions/:resource/:action', requireAuth, async (req, res) => {
  try {
    const { id, resource, action } = req.params;

    const siteUser = await prisma.site_users.findUnique({ where: { id } });
    if (siteUser) {
      const existing = await prisma.user_permissions.findFirst({ where: { userId: id, resource } });
      if (!existing) return res.status(404).json({ error: 'Permission not found' });

      const nextActions = (existing.actions || []).filter(a => a !== action);
      if (nextActions.length === 0) {
        await prisma.user_permissions.delete({ where: { id: existing.id } });
      } else {
        await prisma.user_permissions.update({
          where: { id: existing.id },
          data: { actions: nextActions, updatedAt: new Date() }
        });
      }

      permissionsCache.delete(`perms_${id}`);
      return res.json({ ok: true });
    }

    const member = await prisma.members.findUnique({ where: { id } });
    if (!member) return res.status(404).json({ error: 'User not found' });

    let permissionMap = {};
    const raw = member.permissions;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      permissionMap = { ...raw };
    } else if (Array.isArray(raw)) {
      permissionMap = raw.reduce((acc, p) => {
        if (p?.resource) acc[p.resource] = Array.isArray(p.actions) ? p.actions : [];
        return acc;
      }, {});
    }

    permissionMap[resource] = (permissionMap[resource] || []).filter(a => a !== action);
    if (permissionMap[resource].length === 0) delete permissionMap[resource];

    await prisma.members.update({ where: { id }, data: { permissions: permissionMap } });
    const stateUser = state.members.find(m => m.id === id);
    if (stateUser) stateUser.permissions = permissionMap;
    debouncedSave();

    return res.json({ ok: true });
  } catch (e) {
    console.error('❌ DELETE /api/admin/users/:id/permissions/:resource/:action error:', e.message);
    return res.status(500).json({ error: 'Failed to remove permission', details: e.message });
  }
});

// GET /api/admin/users/:id/permissions - Get user permissions
app.get('/api/admin/users/:id/permissions', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the member in Prisma
    const member = await prisma.members.findUnique({
      where: { id }
    });
    
    if (!member) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ 
      userId: id,
      email: member.email,
      permissions: member.permissions || []
    });
  } catch (e) {
    console.error('❌ GET /api/admin/users/:id/permissions error:', e.message);
    res.status(500).json({ error: 'Failed to fetch permissions', details: e.message });
  }
});

// POST /api/user-permissions/:userId - Add a single permission action
app.post('/api/user-permissions/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { resource, action } = req.body;

    if (!resource || !action) {
      return res.status(400).json({ error: 'Resource and action are required' });
    }

    // Find site_user
    const siteUser = await prisma.site_users.findUnique({
      where: { id: userId }
    });

    if (!siteUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if permission already exists
    let permission = await prisma.user_permissions.findFirst({
      where: { 
        userId: userId,
        resource: resource
      }
    });

    if (permission) {
      // Add action if not already present
      const actions = permission.actions || [];
      if (!actions.includes(action)) {
        actions.push(action);
        permission = await prisma.user_permissions.update({
          where: { id: permission.id },
          data: { 
            actions: actions,
            updatedAt: new Date()
          }
        });
      }
    } else {
      // Create new permission
      permission = await prisma.user_permissions.create({
        data: {
          id: randomUUID(),
          userId: userId,
          resource: resource,
          actions: [action],
          updatedAt: new Date()
        }
      });
    }

    // Clear cache
    permissionsCache.delete(`perms_${userId}`);

    console.log(`✅ Added permission ${resource}:${action} for user ${userId}`);
    res.json({ ok: true, permission });
  } catch (e) {
    console.error('❌ POST /api/user-permissions/:userId error:', e.message);
    res.status(500).json({ error: 'Failed to add permission', details: e.message });
  }
});

// DELETE /api/user-permissions/:userId - Remove a single permission action
app.delete('/api/user-permissions/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { resource, action } = req.body;

    if (!resource || !action) {
      return res.status(400).json({ error: 'Resource and action are required' });
    }

    // Find permission
    const permission = await prisma.user_permissions.findFirst({
      where: { 
        userId: userId,
        resource: resource
      }
    });

    if (!permission) {
      return res.status(404).json({ error: 'Permission not found' });
    }

    // Remove action from array
    const actions = (permission.actions || []).filter(a => a !== action);

    if (actions.length === 0) {
      // Delete the entire permission if no actions left
      await prisma.user_permissions.delete({
        where: { id: permission.id }
      });
    } else {
      // Update with remaining actions
      await prisma.user_permissions.update({
        where: { id: permission.id },
        data: { 
          actions: actions,
          updatedAt: new Date()
        }
      });
    }

    // Clear cache
    permissionsCache.delete(`perms_${userId}`);

    console.log(`✅ Removed permission ${resource}:${action} for user ${userId}`);
    res.json({ ok: true });
  } catch (e) {
    console.error('❌ DELETE /api/user-permissions/:userId error:', e.message);
    res.status(500).json({ error: 'Failed to remove permission', details: e.message });
  }
});

// POST /api/user-permissions/:userId/cards - Set visible MyRBE cards
app.post('/api/user-permissions/:userId/cards', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { visibleCards } = req.body;

    if (!Array.isArray(visibleCards)) {
      return res.status(400).json({ error: 'visibleCards must be an array' });
    }

    // Find site_user
    const siteUser = await prisma.site_users.findUnique({
      where: { id: userId }
    });

    if (!siteUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get all existing permissions
    const existingPerms = await prisma.user_permissions.findMany({
      where: { userId: userId }
    });

    // Remove GRANT action from all permissions
    for (const perm of existingPerms) {
      const actions = (perm.actions || []).filter(a => a !== 'GRANT');
      if (actions.length === 0) {
        // Delete if no actions left
        await prisma.user_permissions.delete({ where: { id: perm.id } });
      } else {
        // Update with remaining actions
        await prisma.user_permissions.update({
          where: { id: perm.id },
          data: { actions: actions }
        });
      }
    }

    // Add GRANT permission for each visible card
    for (const card of visibleCards) {
      const existing = await prisma.user_permissions.findUnique({
        where: {
          userId_resource: {
            userId: userId,
            resource: card
          }
        }
      });

      if (existing) {
        // Add GRANT to existing actions
        const actions = existing.actions || [];
        if (!actions.includes('GRANT')) {
          actions.push('GRANT');
          await prisma.user_permissions.update({
            where: { id: existing.id },
            data: { actions: actions }
          });
        }
      } else {
        // Create new permission with GRANT
        await prisma.user_permissions.create({
          data: {
            id: randomUUID(),
            userId: userId,
            resource: card,
            actions: ['GRANT'],
            updatedAt: new Date()
          }
        });
      }
    }

    // Clear cache
    permissionsCache.delete(`perms_${userId}`);

    console.log(`✅ Updated MyRBE cards for user ${userId}: ${visibleCards.length} cards`);
    res.json({ ok: true, visibleCards });
  } catch (e) {
    console.error('❌ POST /api/user-permissions/:userId/cards error:', e.message);
    res.status(500).json({ error: 'Failed to update cards', details: e.message });
  }
});

app.post('/api/admin/users/:userId/make-admin', requireAuth, async (req, res) => {
  const { userId } = req.params;
  
  console.log(`👤 Admin promotion request for user: ${userId}`);
  
  try {
    // Try site_users first (the IDs used by Permissions Management UI)
    const siteUser = await prisma.site_users.findUnique({ where: { id: userId } });
    if (siteUser) {
      const updatedSiteUser = await prisma.site_users.update({
        where: { id: userId },
        data: { role: 'ADMIN', updatedAt: new Date() }
      });

      // Optionally seed wide permissions for admin actions
      const adminResources = ['members', 'vehicles', 'events', 'finance', 'transactions', 'reports', 'permissions', 'users', 'news', 'documents', 'maintenance', 'admin'];
      const adminActions = ['READ', 'CREATE', 'UPDATE', 'DELETE', 'ADMIN'];

      for (const resource of adminResources) {
        const existing = await prisma.user_permissions.findFirst({ where: { userId, resource } });
        if (existing) {
          const merged = Array.from(new Set([...(existing.actions || []), ...adminActions]));
          await prisma.user_permissions.update({ where: { id: existing.id }, data: { actions: merged, updatedAt: new Date() } });
        } else {
          await prisma.user_permissions.create({
            data: {
              id: randomUUID(),
              userId,
              resource,
              actions: adminActions,
              updatedAt: new Date()
            }
          });
        }
      }

      permissionsCache.delete(`perms_${userId}`);
      console.log(`✅ site_user ${userId} promoted to ADMIN`);
      return res.json({ ok: true, user: updatedSiteUser });
    }

    // Fallback: members
    const member = await prisma.members.findUnique({ where: { id: userId } });
    if (!member) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Define admin resources
    const adminResources = ['members', 'vehicles', 'events', 'finance', 'transactions', 'reports', 'permissions', 'users', 'news', 'documents', 'maintenance', 'admin'];
    const adminActions = ['READ', 'CREATE', 'UPDATE', 'DELETE', 'ADMIN'];
    
    // Build admin permissions
    const adminPermissions = adminResources.map(resource => ({
      resource: resource,
      actions: adminActions
    }));
    
    // Update in Prisma
    const updatedMember = await prisma.members.update({
      where: { id: userId },
      data: {
        role: 'ADMIN',
        permissions: adminPermissions
      }
    });
    
    // Also update in state.members for in-memory access
    const stateUser = state.members.find(m => m.id === userId);
    if (stateUser) {
      stateUser.role = 'ADMIN';
      stateUser.permissions = adminPermissions;
    }
    
    debouncedSave();
    console.log(`✅ User ${userId} promoted to ADMIN`);
    res.json({ ok: true, user: updatedMember });
  } catch (e) {
    console.error('❌ Make-admin error:', e.message);
    res.status(500).json({ error: 'Failed to promote user', details: e.message });
  }
});

// POST /api/admin/users/:userId/role - Change user role
app.post('/api/admin/users/:userId/role', requireAuth, async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;
  
  if (!role) {
    return res.status(400).json({ error: 'Role is required' });
  }
  
  console.log(`👤 Role change request for user: ${userId} -> ${role}`);
  
  try {
    // First try site_users (IDs used by admin permissions UI)
    const siteUser = await prisma.site_users.findUnique({ where: { id: userId } });
    if (siteUser) {
      const updatedSiteUser = await prisma.site_users.update({
        where: { id: userId },
        data: {
          role: role,
          updatedAt: new Date()
        }
      });

      // If downgraded from admin-like role, remove elevated ADMIN action entries
      const isAdminLikeRole = ['ADMIN', 'PRESIDENT', 'VICE_PRESIDENT', 'TRESORIER', 'SECRETAIRE_GENERAL'].includes(String(role || '').toUpperCase());
      if (!isAdminLikeRole) {
        const adminResources = ['members', 'vehicles', 'events', 'finance', 'transactions', 'reports', 'permissions', 'users', 'news', 'documents', 'maintenance', 'admin'];
        await prisma.user_permissions.deleteMany({
          where: {
            userId,
            resource: { in: adminResources }
          }
        });
      }

      permissionsCache.delete(`perms_${userId}`);
      console.log(`✅ site_user ${userId} role changed to ${role}`);
      return res.json({ ok: true, user: updatedSiteUser });
    }

    // Fallback to members
    const member = await prisma.members.findUnique({ where: { id: userId } });
    if (!member) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update in Prisma
    const updatedMember = await prisma.members.update({
      where: { id: userId },
      data: {
        role: role
      }
    });
    
    // Also update in state.members for in-memory access
    const stateUser = state.members.find(m => m.id === userId);
    if (stateUser) {
      stateUser.role = role;
    }
    
    debouncedSave();
    console.log(`✅ User ${userId} role changed to ${role}`);
    res.json({ ok: true, user: updatedMember });
  } catch (e) {
    console.error('❌ Change role error:', e.message);
    res.status(500).json({ error: 'Failed to change role', details: e.message });
  }
});

// GET /api/admin/members/search/:identifier - Find member by username, email, or any identifier
app.get('/api/admin/members/search/:identifier', requireAuth, async (req, res) => {
  const { identifier } = req.params;
  
  if (!identifier) {
    return res.status(400).json({ error: 'Identifier is required' });
  }
  
  try {
    // Search in both Prisma and state
    const prismaUser = await prisma.members.findFirst({
      where: {
        OR: [
          { username: identifier },
          { username: { contains: identifier } },
          { email: { contains: identifier } },
          { firstName: { contains: identifier } },
          { lastName: { contains: identifier } }
        ]
      }
    }).catch(() => null);
    
    if (prismaUser) {
      return res.json({
        found: true,
        user: {
          id: prismaUser.id,
          username: prismaUser.username,
          email: prismaUser.email,
          firstName: prismaUser.firstName,
          lastName: prismaUser.lastName,
          role: prismaUser.role
        }
      });
    }
    
    // Search in state.members
    const stateUser = state.members.find(m => 
      m.username === identifier || 
      m.email?.includes(identifier) ||
      m.firstName?.includes(identifier) ||
      m.lastName?.includes(identifier)
    );
    
    if (stateUser) {
      return res.json({
        found: true,
        user: {
          id: stateUser.id,
          username: stateUser.username,
          email: stateUser.email,
          firstName: stateUser.firstName,
          lastName: stateUser.lastName,
          role: stateUser.role
        }
      });
    }
    
    res.status(404).json({ error: 'User not found', identifier });
  } catch (e) {
    console.error('❌ Search member error:', e.message);
    res.status(500).json({ error: 'Failed to search user', details: e.message });
  }
});

// ===== ENDPOINTS ADMINISTRATION VÉHICULES (PERSISTE DANS PRISMA) =====

// Cartes Grises - GET
app.get(['/vehicles/:parc/grayscale','/api/vehicles/:parc/grayscale'], requireAuth, async (req, res) => {
  try {
    const grayscale = await prisma.vehicleGrayscale.findUnique({
      where: { vehicleId: req.params.parc }
    });
    res.json(grayscale || { vehicleId: req.params.parc });
  } catch (e) {
    console.error('Erreur lecture CG:', e);
    res.status(500).json({ error: e.message });
  }
});

// Cartes Grises - PUT
app.put(['/vehicles/:parc/grayscale','/api/vehicles/:parc/grayscale'], requireAuth, async (req, res) => {
  try {
    const { currentGrayscaleNumber, currentGrayscaleUrl, previousGrayscaleNumber, previousGrayscaleUrl, registrationDate, expiresAt } = req.body;
    const grayscale = await prisma.vehicleGrayscale.upsert({
      where: { vehicleId: req.params.parc },
      update: { currentGrayscaleNumber, currentGrayscaleUrl, previousGrayscaleNumber, previousGrayscaleUrl, registrationDate, expiresAt, status: expiresAt && new Date(expiresAt) < new Date() ? 'expired' : 'valid' },
      create: { vehicleId: req.params.parc, currentGrayscaleNumber, currentGrayscaleUrl, previousGrayscaleNumber, previousGrayscaleUrl, registrationDate, expiresAt, status: expiresAt && new Date(expiresAt) < new Date() ? 'expired' : 'valid' }
    });
    res.json(grayscale);
  } catch (e) {
    console.error('Erreur sauvegarde CG:', e);
    res.status(500).json({ error: e.message });
  }
});

// Certificat de Cession - GET
app.get(['/vehicles/:parc/cession','/api/vehicles/:parc/cession'], requireAuth, async (req, res) => {
  try {
    const cession = await prisma.vehicleCessionCertificate.findUnique({
      where: { vehicleId: req.params.parc }
    });
    res.json(cession || { vehicleId: req.params.parc });
  } catch (e) {
    console.error('Erreur lecture cession:', e);
    res.status(500).json({ error: e.message });
  }
});

// Certificat de Cession - PUT
app.put(['/vehicles/:parc/cession','/api/vehicles/:parc/cession'], requireAuth, async (req, res) => {
  try {
    const { certificateUrl, issuedDate, issuedBy } = req.body;
    const cession = await prisma.vehicleCessionCertificate.upsert({
      where: { vehicleId: req.params.parc },
      update: { certificateUrl, issuedDate, issuedBy },
      create: { vehicleId: req.params.parc, certificateUrl, issuedDate, issuedBy }
    });
    res.json(cession);
  } catch (e) {
    console.error('Erreur sauvegarde cession:', e);
    res.status(500).json({ error: e.message });
  }
});

// Assurance - GET
app.get(['/vehicles/:parc/insurance','/api/vehicles/:parc/insurance'], requireAuth, async (req, res) => {
  try {
    const insurance = await prisma.vehicleInsurance.findUnique({
      where: { vehicleId: req.params.parc }
    });
    res.json(insurance || { vehicleId: req.params.parc });
  } catch (e) {
    console.error('Erreur lecture assurance:', e);
    res.status(500).json({ error: e.message });
  }
});

// Assurance - PUT
app.put(['/vehicles/:parc/insurance','/api/vehicles/:parc/insurance'], requireAuth, async (req, res) => {
  try {
    const { attestationUrl, insuranceCompany, policyNumber, validFrom, validUntil, validFromTime, validUntilTime } = req.body;
    const isExpired = validUntil && new Date(validUntil) < new Date();
    const insurance = await prisma.vehicleInsurance.upsert({
      where: { vehicleId: req.params.parc },
      update: { attestationUrl, insuranceCompany, policyNumber, validFrom, validUntil, validFromTime, validUntilTime, status: isExpired ? 'expired' : 'valid' },
      create: { vehicleId: req.params.parc, attestationUrl, insuranceCompany, policyNumber, validFrom, validUntil, validFromTime, validUntilTime, status: isExpired ? 'expired' : 'valid' }
    });
    res.json(insurance);
  } catch (e) {
    console.error('Erreur sauvegarde assurance:', e);
    res.status(500).json({ error: e.message });
  }
});

// Contrôle Technique - GET dernier CT
app.get(['/vehicles/:parc/inspection','/api/vehicles/:parc/inspection'], requireAuth, async (req, res) => {
  try {
    const inspection = await prisma.vehicleInspection.findFirst({
      where: { vehicleId: req.params.parc },
      orderBy: { inspectionDate: 'desc' },
      take: 1
    });
    res.json(inspection || { vehicleId: req.params.parc });
  } catch (e) {
    console.error('Erreur lecture CT:', e);
    res.status(500).json({ error: e.message });
  }
});

// Contrôle Technique - GET tous les CT
app.get(['/vehicles/:parc/inspections','/api/vehicles/:parc/inspections'], requireAuth, async (req, res) => {
  try {
    const inspections = await prisma.vehicleInspection.findMany({
      where: { vehicleId: req.params.parc },
      orderBy: { inspectionDate: 'desc' }
    });
    res.json({ inspections });
  } catch (e) {
    console.error('Erreur lecture CT:', e);
    res.status(500).json({ error: e.message });
  }
});

// Contrôle Technique - POST nouveau CT
app.post(['/vehicles/:parc/inspection','/api/vehicles/:parc/inspection'], requireAuth, async (req, res) => {
  try {
    const { attestationUrl, inspectionDate, expiryDate, mileage, status, defects, nextInspectionDate } = req.body;
    const inspection = await prisma.vehicleInspection.create({
      data: {
        vehicleId: req.params.parc,
        attestationUrl,
        inspectionDate,
        expiryDate,
        mileage,
        status: status || (expiryDate && new Date(expiryDate) < new Date() ? 'expired' : 'valid'),
        defects,
        nextInspectionDate
      }
    });
    res.status(201).json(inspection);
  } catch (e) {
    console.error('Erreur création CT:', e);
    res.status(500).json({ error: e.message });
  }
});

// Échéancier - GET tous les échéanciers pour un véhicule
app.get(['/vehicles/:parc/schedule','/api/vehicles/:parc/schedule'], requireAuth, async (req, res) => {
  try {
    const schedule = await prisma.vehicleScheduleItem.findMany({
      where: { vehicleId: req.params.parc },
      orderBy: { dueDate: 'asc' }
    });
    res.json({ schedule });
  } catch (e) {
    console.error('❌ GET /vehicles/:parc/schedule error:', e.message);
    res.status(500).json({ error: 'Failed to fetch schedule', details: e.message });
  }
});

// Échéancier - GET global tous les véhicules
app.get(['/vehicles/schedule/all','/api/vehicles/schedule/all'], requireAuth, async (req, res) => {
  try {
    const schedule = await prisma.vehicleScheduleItem.findMany({
      orderBy: { dueDate: 'asc' }
    });
    res.json({ schedule });
  } catch (e) {
    console.error('❌ GET /vehicles/schedule/all error:', e.message);
    res.status(500).json({ error: 'Failed to fetch schedules', details: e.message });
  }
});

// Échéancier - POST ajouter une ligne
app.post(['/vehicles/:parc/schedule','/api/vehicles/:parc/schedule'], requireAuth, async (req, res) => {
  try {
    const { type, description, dueDate, dueTime, priority, notes } = req.body;
    const item = await prisma.vehicleScheduleItem.create({
      data: {
        vehicleId: req.params.parc,
        type,
        description,
        dueDate: dueDate ? new Date(dueDate) : null,
        dueTime,
        priority: priority || 'normal',
        status: 'pending',
        notes
      }
    });
    res.status(201).json(item);
  } catch (e) {
    console.error('❌ POST /vehicles/:parc/schedule error:', e.message);
    res.status(500).json({ error: 'Failed to create schedule item', details: e.message });
  }
});

// Échéancier - PUT marquer comme complété
app.put(['/vehicles/schedule/:itemId','/api/vehicles/schedule/:itemId'], requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const item = await prisma.vehicleScheduleItem.update({
      where: { id: req.params.itemId },
      data: { status }
    });
    res.json(item);
  } catch (e) {
    console.error('❌ PUT /vehicles/schedule/:itemId error:', e.message);
    if (e?.code === 'P2025') {
      return res.status(404).json({ error: 'Schedule item not found' });
    }
    res.status(500).json({ error: 'Failed to update schedule item', details: e.message });
  }
});

// Échéancier - DELETE supprimer une ligne
app.delete(['/vehicles/schedule/:itemId','/api/vehicles/schedule/:itemId'], requireAuth, async (req, res) => {
  try {
    await prisma.vehicleScheduleItem.delete({
      where: { id: req.params.itemId }
    });
    res.json({ success: true });
  } catch (e) {
    console.error('❌ DELETE /vehicles/schedule/:itemId error:', e.message);
    if (e?.code === 'P2025') {
      return res.status(404).json({ error: 'Schedule item not found' });
    }
    res.status(500).json({ error: 'Failed to delete schedule item', details: e.message });
  }
});

// Notes Administratives - GET
app.get(['/vehicles/:parc/notes','/api/vehicles/:parc/notes'], requireAuth, async (req, res) => {
  try {
    const notes = await prisma.vehicleAdministrativeNote.findMany({
      where: { vehicleId: req.params.parc },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ notes });
  } catch (e) {
    console.error('Erreur lecture notes:', e);
    res.status(500).json({ error: e.message });
  }
});

// Notes Administratives - POST
app.post(['/vehicles/:parc/notes','/api/vehicles/:parc/notes'], requireAuth, async (req, res) => {
  try {
    const { category, content, attachmentUrl } = req.body;
    const note = await prisma.vehicleAdministrativeNote.create({
      data: {
        vehicleId: req.params.parc,
        category,
        content,
        attachmentUrl
      }
    });
    res.status(201).json(note);
  } catch (e) {
    console.error('Erreur création note:', e);
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// 🔧 DIAGNOSTIC ENDPOINT (pour développement)
// ============================================================
app.get('/api/diagnostic/finance', requireAuth, (req, res) => {
  const expenseStats = {
    total: state.expenseReports.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0),
    byStatus: state.expenseReports.reduce((acc, r) => {
      const status = r.status || 'open';
      if (!acc[status]) acc[status] = 0;
      acc[status]++;
      return acc;
    }, {})
  };

  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT
    },
    finance: {
      expenseReports: {
        count: state.expenseReports.length,
        totalAmount: expenseStats.total,
        byStatus: expenseStats.byStatus,
        hasUserId: state.expenseReports.length > 0 && !!state.expenseReports[0].userId,
        sample: state.expenseReports.slice(0, 2).map(r => ({
          id: r.id,
          userId: r.userId,
          createdBy: r.createdBy,
          amount: r.amount,
          status: r.status,
          createdAt: r.createdAt,
          hasTimestamps: !!r.createdAt && !!r.updatedAt
        }))
      },
      scheduled: {
        count: state.scheduled.length,
        sample: state.scheduled.slice(0, 1)
      },
      transactions: {
        count: state.transactions.length
      },
      bankBalance: state.bankBalance
    },
    endpoints: {
      '/api/finance/expense-reports': 'GET/POST',
      '/api/finance/debts': 'GET/POST/PATCH/DELETE',
      '/api/finance/transactions': 'GET/POST',
      '/api/finance/scheduled-expenses': 'GET/POST',
      '/api/finance/balance': 'GET',
      '/api/financial-documents': 'GET/POST',
      '/api/quote-templates': 'GET/POST'
    }
  });
});

app.get('/api/admin/site-logs', requireAuth, requireAdmin, (req, res) => {
  const requestedLimit = Number.parseInt(req.query.limit, 10);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(1000, requestedLimit)) : 200;
  const statusFilter = (req.query.status || '').toString().toLowerCase().trim();
  const search = (req.query.search || '').toString().toLowerCase().trim();

  let logs = getAuditLogs(1000);

  if (statusFilter) {
    logs = logs.filter((log) => String(log.status || '').toLowerCase() === statusFilter);
  }

  if (search) {
    logs = logs.filter((log) => {
      const haystack = `${log.action || ''} ${log.user || ''} ${log.details || ''}`.toLowerCase();
      return haystack.includes(search);
    });
  }

  const sliced = logs.slice(0, limit);

  res.json({
    success: true,
    total: logs.length,
    returned: sliced.length,
    summary: getAuditLogsSummary(),
    logs: sliced,
  });
});

app.post('/api/public/traffic-event', async (req, res) => {
  try {
    const eventType = String(req.body?.eventType || '').toLowerCase();
    const path = String(req.body?.path || '/').slice(0, 200);
    const adSlot = String(req.body?.adSlot || '').slice(0, 120) || null;
    const referrer = String(req.body?.referrer || req.get('referer') || '');
    const sourceHint = String(req.body?.source || req.body?.sourceHint || '').slice(0, 80);
    const searchQuery = normalizeSearchQuery(req.body?.searchQuery || req.body?.query || req.body?.keyword);
    const rawTs = req.body?.timestamp;
    const estimatedCpc = 0.18;

    if (!['visit', 'pageview', 'click', 'search_impression', 'search_click', 'ad_impression', 'ad_click'].includes(eventType)) {
      return res.status(400).json({ success: false, error: 'Invalid eventType' });
    }

    const eventDate = rawTs ? new Date(rawTs) : new Date();
    if (Number.isNaN(eventDate.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid timestamp' });
    }

    const key = buildDailyKey(eventDate);
    const entry = ensureDailyTrafficEntry(key);

    if (eventType === 'visit') entry.visits += 1;
    if (eventType === 'pageview') entry.pageViews += 1;
    if (eventType === 'click') entry.clicks += 1;
    if (eventType === 'search_impression') entry.search.impressions += 1;
    if (eventType === 'search_click') entry.search.clicks += 1;
    if (eventType === 'ad_impression') entry.adsense.impressions += 1;
    if (eventType === 'ad_click') {
      entry.adsense.clicks += 1;
      entry.adsense.estimatedRevenue = Number((entry.adsense.estimatedRevenue + estimatedCpc).toFixed(2));
    }

    const source = classifyAccessSource(referrer, sourceHint);
    entry.sources[source] = (entry.sources[source] || 0) + 1;

    if (source === 'google' && eventType === 'visit') {
      entry.search.clicks += 1;
    }
    if (source === 'google' && eventType === 'pageview') {
      entry.search.impressions += 1;
    }

    if (searchQuery) {
      entry.search.queries[searchQuery] = (entry.search.queries[searchQuery] || 0) + 1;
    }

    if (path) {
      entry.pages[path] = (entry.pages[path] || 0) + 1;
    }

    try {
      await prisma.analyticsTrafficEvent.create({
        data: {
          eventType,
          path,
          referrer: referrer || null,
          source,
          searchQuery: searchQuery || null,
          adSlot,
          createdAt: eventDate,
        },
      });
    } catch (dbError) {
      console.warn('⚠️ Persist traffic event skipped:', dbError.message);
    }

    return res.json({ success: true, recorded: { eventType, date: key, source } });
  } catch (error) {
    console.error('❌ /api/public/traffic-event error:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to record traffic event' });
  }
});

app.get('/api/admin/site-traffic-context', requireAuth, requireTrafficContextAccess, async (req, res) => {
  try {
    const externalBase = (process.env.EXTERNAL_SITE_URL || 'https://www.association-rbe.fr').replace(/\/+$/, '');
    const pagePaths = ['/', '/parc', '/adherer', '/contact', '/evenements'];
    const resourcePaths = ['/robots.txt', '/sitemap.xml', '/manifest.json', '/llms.txt'];

    const pageProbes = await Promise.all(
      pagePaths.map((pagePath) => probeHttpUrl(`${externalBase}${pagePath}`))
    );

    const resourceProbes = await Promise.all(
      resourcePaths.map((resourcePath) => probeHttpUrl(`${externalBase}${resourcePath}`))
    );

    const successfulProbes = pageProbes.filter((probe) => probe.ok);
    const averageResponseTimeMs =
      successfulProbes.length > 0
        ? Math.round(successfulProbes.reduce((sum, probe) => sum + (probe.responseTimeMs || 0), 0) / successfulProbes.length)
        : null;
    const successRatePct = pageProbes.length > 0
      ? Math.round((successfulProbes.length / pageProbes.length) * 100)
      : 0;

    const [mobilePerf, desktopPerf] = await Promise.all([
      getPageSpeedMetrics(externalBase, 'mobile'),
      getPageSpeedMetrics(externalBase, 'desktop'),
    ]);

    const memory = process.memoryUsage();
    const toMb = (bytes) => Math.round((bytes / 1024 / 1024) * 10) / 10;
    const logsSummary = getAuditLogsSummary();

    recordTrafficSnapshot({
      timestamp: new Date().toISOString(),
      averageResponseTimeMs,
      successRatePct,
      visitsCount: successfulProbes.length,
      pageProbeCount: pageProbes.length,
      pageProbeSuccessCount: successfulProbes.length,
      pagespeedMobileScore: mobilePerf?.score ?? null,
      pagespeedDesktopScore: desktopPerf?.score ?? null,
    });

    const timeline = getTrafficTimeline(Number.parseInt(req.query.historyLimit, 10));
    const monthlyVisits = buildMonthlyVisitsSeries(trafficContextHistory, req.query.month);
    const [monthlyTraffic, searchConsoleApi] = await Promise.all([
      buildMonthlyTrafficAnalytics(req.query.month),
      getSearchConsoleOverview({ monthParam: req.query.month }),
    ]);

    res.json({
      success: true,
      generatedAt: new Date().toISOString(),
      externalSite: externalBase,
      serverContext: {
        uptimeSeconds: Math.round(process.uptime()),
        nodeVersion: process.version,
        memoryMb: {
          rss: toMb(memory.rss),
          heapUsed: toMb(memory.heapUsed),
          heapTotal: toMb(memory.heapTotal),
        },
      },
      trafficContext: {
        pageProbeCount: pageProbes.length,
        pageProbeSuccessCount: successfulProbes.length,
        successRatePct,
        averageResponseTimeMs,
        pages: pageProbes,
        resources: resourceProbes,
        history: {
          points: timeline.length,
          timeline,
        },
        monthlyVisits,
        monthlyTraffic,
      },
      pagespeed: {
        mobile: mobilePerf,
        desktop: desktopPerf,
      },
      searchConsoleApi,
      logsContext: {
        totalLogs: logsSummary.total,
        byStatus: logsSummary.byStatus,
        topActions: logsSummary.topActions,
        lastEventAt: logsSummary.lastEventAt,
      },
    });
  } catch (error) {
    console.error('❌ /api/admin/site-traffic-context error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to load traffic and context data',
      details: error.message,
    });
  }
});

app.get('/api/admin/search-console/overview', requireAuth, requireAdmin, async (req, res) => {
  try {
    const overview = await getSearchConsoleOverview({
      monthParam: req.query.month,
      startDateParam: req.query.startDate,
      endDateParam: req.query.endDate,
    });

    res.json({ success: true, data: overview });
  } catch (error) {
    console.error('❌ /api/admin/search-console/overview error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to load Search Console overview',
      details: error.message,
    });
  }
});

// Endpoint pour nettoyer/normaliser les données
app.post('/api/admin/normalize-data', requireAuth, requireAdmin, (req, res) => {

  const stats = {
    expenseReports: { fixed: 0, skipped: 0 },
    scheduled: { fixed: 0, skipped: 0 },
    simulations: { fixed: 0, skipped: 0 }
  };

  // Normaliser les notes de frais
  state.expenseReports.forEach((r, i) => {
    let fixed = false;

    if (!r.userId) {
      r.userId = 'legacy';
      fixed = true;
    }
    if (!r.createdBy) {
      r.createdBy = 'Legacy User';
      fixed = true;
    }
    if (!r.createdAt) {
      r.createdAt = r.date || new Date().toISOString();
      fixed = true;
    }
    if (!r.updatedAt) {
      r.updatedAt = r.createdAt;
      fixed = true;
    }

    if (fixed) {
      stats.expenseReports.fixed++;
      state.expenseReports[i] = r;
    } else {
      stats.expenseReports.skipped++;
    }
  });

  // Normaliser les opérations programmées
  state.scheduled.forEach((o, i) => {
    let fixed = false;
    if (!o.userId) {
      o.userId = 'legacy';
      fixed = true;
    }
    if (!o.createdBy) {
      o.createdBy = 'Legacy User';
      fixed = true;
    }
    if (!o.createdAt) {
      o.createdAt = new Date().toISOString();
      fixed = true;
    }
    if (!o.updatedAt) {
      o.updatedAt = o.createdAt;
      fixed = true;
    }

    if (fixed) {
      stats.scheduled.fixed++;
      state.scheduled[i] = o;
    } else {
      stats.scheduled.skipped++;
    }
  });

  // Normaliser les simulations
  state.simulations.forEach((s, i) => {
    let fixed = false;
    if (!s.userId) {
      s.userId = 'legacy';
      fixed = true;
    }
    if (!s.createdBy) {
      s.createdBy = 'Legacy User';
      fixed = true;
    }
    if (!s.updatedAt) {
      s.updatedAt = s.createdAt || new Date().toISOString();
      fixed = true;
    }

    if (fixed) {
      stats.simulations.fixed++;
      state.simulations[i] = s;
    } else {
      stats.simulations.skipped++;
    }
  });

  debouncedSave();
  res.json({
    status: 'normalized',
    timestamp: new Date().toISOString(),
    stats
  });
});

// ============ DIAGNOSTIC ENDPOINTS ============
// Check database schema
app.get('/api/health/database-schema', async (req, res) => {
  try {
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    
    const hasPaymentsTable = tables.some(t => t.table_name === 'scheduled_operation_payments');
    
    res.json({
      status: 'ok',
      hasPaymentsTable,
      tables: tables.map(t => t.table_name)
    });
  } catch (e) {
    console.error('❌ Database schema error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ============ SCHEDULED OPERATIONS PAYMENTS ============
// GET all payments for an operation
app.get('/api/finance/scheduled-operations/:operationId/payments', async (req, res) => {
  try {
    const { operationId } = req.params;
    
    const payments = await prisma.scheduled_operation_payments.findMany({
      where: { scheduledOperationId: operationId },
      orderBy: { paidAt: 'desc' }
    });
    
    res.json(payments || []);
  } catch (e) {
    console.error('❌ GET payments error:', e.message, e.code);
    // Si c'est une erreur de table inexistante, retourner un tableau vide
    if (e.code === 'P1017' || e.message.includes('does not exist')) {
      return res.json([]);
    }
    res.status(500).json({ error: e.message, code: e.code });
  }
});

// POST add a payment
app.post('/api/finance/scheduled-operations/:operationId/payments', requireAuth, async (req, res) => {
  try {
    const { operationId } = req.params;
    const { amount, period } = req.body;
    
    // Verify operation exists
    const operation = await prisma.scheduled_operations.findUnique({
      where: { id: operationId }
    });
    
    if (!operation) {
      return res.status(404).json({ error: 'Operation not found' });
    }
    
    const paymentId = uid();
    const paymentData = {
      id: paymentId,
      scheduledOperationId: operationId,
      period: period || new Date().toISOString().split('T')[0],
      amount: parseFloat(amount) || 0,
      paidAt: new Date()
    };
    
    // Save payment to Prisma
    let payment;
    try {
      payment = await prisma.scheduled_operation_payments.create({
        data: paymentData
      });
    } catch (createError) {
      // Si c'est une erreur de table inexistante, créer la table
      if (createError.code === 'P1017' || createError.message.includes('does not exist')) {
        console.log('⚠️ Table scheduled_operation_payments does not exist, creating...');
        
        // Create table
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "scheduled_operation_payments" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "scheduledOperationId" TEXT NOT NULL,
            "period" TEXT NOT NULL,
            "amount" DOUBLE PRECISION NOT NULL,
            "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "fileName" TEXT,
            "mimeType" TEXT,
            "size" INTEGER,
            "attachmentDataUrl" TEXT
          );
        `);
        
        // Create indexes
        try {
          await prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "scheduled_operation_payments_paidAt_idx" ON "scheduled_operation_payments"("paidAt");
          `);
          await prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "scheduled_operation_payments_period_idx" ON "scheduled_operation_payments"("period");
          `);
          await prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "scheduled_operation_payments_scheduledOperationId_idx" ON "scheduled_operation_payments"("scheduledOperationId");
          `);
        } catch (indexError) {
          console.log('ℹ️ Indexes might already exist');
        }
        
        // Add foreign key
        try {
          await prisma.$executeRawUnsafe(`
            ALTER TABLE "scheduled_operation_payments" 
            ADD CONSTRAINT "scheduled_operation_payments_scheduledOperationId_fkey" 
            FOREIGN KEY ("scheduledOperationId") REFERENCES "scheduled_operations"("id") ON DELETE CASCADE;
          `);
        } catch (fkError) {
          console.log('ℹ️ Foreign key might already exist');
        }
        
        console.log('✅ Table created successfully');
        
        // Retry creation
        payment = await prisma.scheduled_operation_payments.create({
          data: paymentData
        });
      } else {
        throw createError;
      }
    }
    
    // Update the operation's remainingTotalAmount (using the operation we already fetched)
    if (operation) {
      const currentRemaining = operation.remainingTotalAmount || operation.totalAmount || 0;
      const newRemaining = Math.max(0, currentRemaining - parseFloat(amount));
      
      // Get all payments for this operation to count them
      const allPayments = await prisma.scheduled_operation_payments.findMany({
        where: { scheduledOperationId: operationId }
      });
      
      const updatedOp = await prisma.scheduled_operations.update({
        where: { id: operationId },
        data: {
          remainingTotalAmount: newRemaining,
          paymentsCount: allPayments.length
        }
      });
      
      // Update memory state
      const idx = state.scheduledOperations.findIndex(op => op.id === operationId);
      if (idx >= 0) {
        state.scheduledOperations[idx] = updatedOp;
      }
      debouncedSave();
    }
    
    console.log('✅ Payment recorded:', paymentId);
    res.status(201).json(payment);
  } catch (e) {
    console.error('❌ POST payment error:', { message: e.message, code: e.code, stack: e.stack });
    res.status(500).json({ error: e.message, code: e.code, details: process.env.NODE_ENV === 'development' ? e.stack : undefined });
  }
});

// DELETE a payment (and recalculate remaining)
app.delete('/api/finance/scheduled-operations/:operationId/payments/:paymentId', requireAuth, async (req, res) => {
  try {
    const { operationId, paymentId } = req.params;
    
    // Get the payment to know how much to refund
    const payment = await prisma.scheduled_operation_payments.findUnique({
      where: { id: paymentId }
    });
    
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    // Delete the payment
    await prisma.scheduled_operation_payments.delete({
      where: { id: paymentId }
    });
    
    // Update operation's remainingTotalAmount by adding back the amount
    const operation = await prisma.scheduled_operations.findUnique({
      where: { id: operationId }
    });
    
    if (operation) {
      const currentRemaining = operation.remainingTotalAmount || 0;
      const newRemaining = currentRemaining + payment.amount;
      
      // Count remaining payments
      const allPayments = await prisma.scheduled_operation_payments.findMany({
        where: { scheduledOperationId: operationId }
      });
      
      const updatedOp = await prisma.scheduled_operations.update({
        where: { id: operationId },
        data: {
          remainingTotalAmount: newRemaining,
          paymentsCount: allPayments.length
        }
      });
      
      // Update memory state
      const idx = state.scheduledOperations.findIndex(op => op.id === operationId);
      if (idx >= 0) {
        state.scheduledOperations[idx] = updatedOp;
      }
      debouncedSave();
    }
    
    console.log('✅ Payment deleted:', paymentId);
    res.json({ success: true });
  } catch (e) {
    console.error('❌ DELETE payment error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ============ SUBVENTIONS ROUTER ============
app.use('/api/subventions', subventionsRouter);

// ============ RETROMERCH ROUTER ============
// Lazy router initialization - prisma will be passed when requests come in
console.log('🔧 Setting up RetroMerch router... prisma:', prisma ? '✅ OK' : '❌ UNDEFINED');
if (prisma) {
  app.use('/api/retromerch', retromerchRouter(prisma));
} else {
  console.warn('⚠️  Prisma not ready for RetroMerch router');
}

// Generic error handler
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  console.error('❌ Error stack:', err.stack);
  console.error('❌ Request:', {
    method: req.method,
    url: req.url,
    body: req.body ? `${JSON.stringify(req.body).substring(0, 200)}...` : 'no body'
  });
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

app.listen(PORT, async () => {
  // Load users from Prisma into state.members at startup
  try {
    const prismaMembers = await prisma.members.findMany();
    state.members = prismaMembers.map(m => ({
      id: m.id,
      email: m.email,
      firstName: m.firstName,
      lastName: m.lastName,
      matricule: m.matricule,
      password: m.password,
      role: m.role,
      status: m.status,
      permissions: m.permissions || [],
      createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : m.createdAt
    }));
    console.log(`✅ Loaded ${state.members.length} members from Prisma`);
  } catch (e) {
    console.warn('⚠️ Failed to load members from Prisma:', e.message);
  }

  // Load contrôles techniques from Prisma
  try {
    const prismaCtData = await prisma.vehicleControlTechnique.findMany();
    state.vehicleControleTechnique = prismaCtData.map(ct => ({
      id: ct.id,
      parc: ct.parc,
      attestationPath: ct.attestationPath,
      ctDate: ct.ctDate instanceof Date ? ct.ctDate.toISOString() : ct.ctDate,
      ctStatus: ct.ctStatus,
      nextCtDate: ct.nextCtDate instanceof Date ? ct.nextCtDate.toISOString() : ct.nextCtDate,
      mileage: ct.mileage,
      notes: ct.notes
    }));
    console.log(`✅ Loaded ${state.vehicleControleTechnique.length} contrôles techniques from Prisma`);
  } catch (e) {
    console.warn('⚠️ Failed to load contrôles techniques from Prisma:', e.message);
  }

  // Load vehicles from Prisma
  try {
    const prismaVehicles = await prisma.vehicle.findMany();
    state.vehicles = prismaVehicles;
    console.log(`✅ Loaded ${state.vehicles.length} vehicles from Prisma`);
  } catch (e) {
    console.warn('⚠️ Failed to load vehicles from Prisma:', e.message);
  }

  // Load events from Prisma
  try {
    const prismaEvents = await prisma.event.findMany();
    state.events = prismaEvents;
    console.log(`✅ Loaded ${state.events.length} events from Prisma`);
  } catch (e) {
    console.warn('⚠️ Failed to load events from Prisma:', e.message);
  }

  // Load retro news from Prisma
  try {
    const prismaNews = await prisma.retroNews.findMany();
    state.retroNews = prismaNews;
    console.log(`✅ Loaded ${state.retroNews.length} retro news from Prisma`);
  } catch (e) {
    console.warn('⚠️ Failed to load retro news from Prisma:', e.message);
  }

  // Load flashes from Prisma
  try {
    const prismaFlashes = await prisma.flash.findMany();
    state.flashes = prismaFlashes;
    console.log(`✅ Loaded ${state.flashes.length} flashes from Prisma`);
  } catch (e) {
    console.warn('⚠️ Failed to load flashes from Prisma:', e.message);
  }

  // Load simulations from Prisma
  try {
    const prismaSimulations = await prisma.finance_simulation_scenarios.findMany({
      orderBy: { createdAt: 'desc' }
    });
    state.simulations = prismaSimulations.map(s => ({
      ...s,
      createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
      updatedAt: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : s.updatedAt
    }));
    console.log(`✅ Loaded ${state.simulations.length} simulations from Prisma`);
  } catch (e) {
    console.warn('⚠️ Failed to load simulations from Prisma:', e.message);
  }

  // Auto-connexion du compte noreply si configuré
  const noreplyEmail = process.env.NOREPLY_EMAIL;
  const noreplyPassword = process.env.NOREPLY_PASSWORD;
  
  if (noreplyEmail && noreplyPassword) {
    console.log('📧 Tentative de connexion automatique du compte NoReply...');
    try {
      // Créer un user ID fictif pour le noreply (système interne)
      const noreplySystemUserId = 'system-noreply';
      await createMailSession(noreplySystemUserId, noreplyEmail, noreplyPassword);
      setNoreplyUserId(noreplySystemUserId);
      console.log(`✅ Compte NoReply connecté automatiquement: ${noreplyEmail}`);
    } catch (error) {
      console.error('❌ Échec connexion auto NoReply:', error.message);
      console.warn('⚠️  Les emails du formulaire de contact ne seront pas envoyés');
      console.warn('💡 Connectez manuellement le compte via RétroMail ou vérifiez NOREPLY_EMAIL/NOREPLY_PASSWORD dans .env');
    }
  } else {
    console.warn('⚠️  NOREPLY_EMAIL ou NOREPLY_PASSWORD non configurés');
    console.warn('💡 Les emails automatiques nécessitent une connexion manuelle via RétroMail');
  }

  console.log('');
  console.log(`🌐 API accessible sur: http://localhost:${PORT}`);
  console.log('');
  console.log('📊 Endpoints disponibles:');
  console.log('   GET  /public/events     - Événements publiés');
  console.log('   GET  /public/vehicles   - Véhicules');
  console.log('   POST /public/contact    - Formulaire de contact');
  console.log('   GET  /api/events        - Tous les événements (auth)');
  console.log('   POST /api/events        - Créer événement (auth)');
  console.log('   PUT  /api/events/:id    - Modifier événement (auth)');
  console.log('   DEL  /api/events/:id    - Supprimer événement (auth)');
  console.log('');
  console.log('✅ Serveur prêt - toutes les modifications sont persistées');
  console.log('═══════════════════════════════════════════════════════════');
});

// Utilitaire pour déconnecter Prisma proprement
async function safeDisconnectPrisma() {
  try {
    if (prisma && typeof prisma.$disconnect === 'function') {
      await prisma.$disconnect();
      console.log('🔌 Prisma déconnecté proprement');
    } else {
      console.log('ℹ️ Prisma non initialisé ou indisponible, pas de déconnexion nécessaire');
    }
  } catch (e) {
    console.warn('⚠️ Erreur lors de la déconnexion Prisma:', e.message);
  }
}

// ============ AUTO-GENERATED CRUD ENDPOINTS ============

// ============ VEHICLE CRUD ============

// GET - List all vehicle
app.get(['/api/vehicle', '/vehicle'], requireAuth, async (req, res) => {
  try {
    const items = await prisma.vehicle.findMany();
    res.json(items);
  } catch (e) {
    console.error('❌ Error getting vehicle:', e.message);
    res.status(500).json({ error: 'Failed to fetch vehicle', details: e.message });
  }
});

// GET - Get single vehicle
app.get(['/api/vehicle/:id', '/vehicle/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicle.findUnique({
      where: { id: req.params.id }
    });
    if (!item) return res.status(404).json({ error: 'vehicle not found' });
    res.json(item);
  } catch (e) {
    console.error('❌ Error getting vehicle:', e.message);
    res.status(500).json({ error: 'Failed to fetch vehicle', details: e.message });
  }
});

// POST - Create new vehicle
app.post(['/api/vehicle', '/vehicle'], requireAuth, async (req, res) => {
  try {
    const { parc, type, modele, etat, marque, ...rest } = req.body;
    
    if (!parc || !type || !modele || !etat) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        required: ['parc', 'type', 'modele', 'etat']
      });
    }
    
    const item = await prisma.vehicle.create({
      data: {
        parc,
        type,
        modele,
        etat,
        marque: marque || null,
        ...rest,
        updatedAt: new Date()
      }
    });
    res.status(201).json(item);
  } catch (e) {
    console.error('❌ Error creating vehicle:', e.message);
    res.status(500).json({ error: 'Failed to create vehicle', details: e.message });
  }
});

// PUT - Update vehicle
app.put(['/api/vehicle/:id', '/vehicle/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicle.update({
      where: { id: req.params.id },
      data: { ...req.body, updatedAt: new Date() }
    });
    res.json(item);
  } catch (e) {
    console.error('❌ Error updating vehicle:', e.message);
    res.status(500).json({ error: 'Failed to update vehicle', details: e.message });
  }
});

// DELETE - Remove vehicle
app.delete(['/api/vehicle/:id', '/vehicle/:id'], requireAuth, async (req, res) => {
  try {
    const deleted = await prisma.vehicle.delete({
      where: { id: req.params.id }
    });
    res.json({ ok: true, deleted });
  } catch (e) {
    console.error('❌ Error deleting vehicle:', e.message);
    res.status(500).json({ error: 'Failed to delete vehicle', details: e.message });
  }
});

// ============ EVENT CRUD ============

// GET - List all event
app.get(['/api/event', '/event'], requireAuth, async (req, res) => {
  try {
    const items = await prisma.event.findMany();
    res.json(items);
  } catch (e) {
    console.error('❌ Error getting event:', e.message);
    res.status(500).json({ error: 'Failed to fetch event', details: e.message });
  }
});

// GET - Get single event
app.get(['/api/event/:id', '/event/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.event.findUnique({
      where: { id: req.params.id }
    });
    if (!item) return res.status(404).json({ error: 'event not found' });
    res.json(item);
  } catch (e) {
    console.error('❌ Error getting event:', e.message);
    res.status(500).json({ error: 'Failed to fetch event', details: e.message });
  }
});

// POST - Create new event
app.post(['/api/event', '/event'], requireAuth, async (req, res) => {
  try {
    const { title, date, ...rest } = req.body;
    
    if (!title || !date) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        required: ['title', 'date']
      });
    }
    
    const item = await prisma.event.create({
      data: {
        id: uid(),
        title,
        date: new Date(date),
        ...rest,
        updatedAt: new Date()
      }
    });
    res.status(201).json(item);
  } catch (e) {
    console.error('❌ Error creating event:', e.message);
    res.status(500).json({ error: 'Failed to create event', details: e.message });
  }
});

// PUT - Update event
app.put(['/api/event/:id', '/event/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.event.update({
      where: { id: req.params.id },
      data: { ...req.body, updatedAt: new Date() }
    });
    res.json(item);
  } catch (e) {
    console.error('❌ Error updating event:', e.message);
    res.status(500).json({ error: 'Failed to update event', details: e.message });
  }
});

// DELETE - Remove event
app.delete(['/api/event/:id', '/event/:id'], requireAuth, async (req, res) => {
  try {
    const deleted = await prisma.event.delete({
      where: { id: req.params.id }
    });
    res.json({ ok: true, deleted });
  } catch (e) {
    console.error('❌ Error deleting event:', e.message);
    res.status(500).json({ error: 'Failed to delete event', details: e.message });
  }
});

// ============ FLASH CRUD ============

// GET - List all flash
app.get(['/api/flash', '/flash'], requireAuth, async (req, res) => {
  try {
    const items = await prisma.flash.findMany();
    res.json(items);
  } catch (e) {
    console.error('❌ Error getting flash:', e.message);
    res.status(500).json({ error: 'Failed to fetch flash', details: e.message });
  }
});

// GET - Get single flash
app.get(['/api/flash/:id', '/flash/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.flash.findUnique({
      where: { id: req.params.id }
    });
    if (!item) return res.status(404).json({ error: 'flash not found' });
    res.json(item);
  } catch (e) {
    console.error('❌ Error getting flash:', e.message);
    res.status(500).json({ error: 'Failed to fetch flash', details: e.message });
  }
});

// POST - Create new flash
app.post(['/api/flash', '/flash'], requireAuth, async (req, res) => {
  try {
    const { content, title, ...rest } = req.body; // Ignore title, it's not a flash field
    
    if (!content) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        required: ['content']
      });
    }
    
    const item = await prisma.flash.create({
      data: {
        id: uid(),
        content,
        ...rest,
        updatedAt: new Date()
      }
    });
    res.status(201).json(item);
  } catch (e) {
    console.error('❌ Error creating flash:', e.message);
    res.status(500).json({ error: 'Failed to create flash', details: e.message });
  }
});

// PUT - Update flash
app.put(['/api/flash/:id', '/flash/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.flash.update({
      where: { id: req.params.id },
      data: { ...req.body, updatedAt: new Date() }
    });
    res.json(item);
  } catch (e) {
    console.error('❌ Error updating flash:', e.message);
    res.status(500).json({ error: 'Failed to update flash', details: e.message });
  }
});

// DELETE - Remove flash
app.delete(['/api/flash/:id', '/flash/:id'], requireAuth, async (req, res) => {
  try {
    const deleted = await prisma.flash.delete({
      where: { id: req.params.id }
    });
    res.json({ ok: true, deleted });
  } catch (e) {
    console.error('❌ Error deleting flash:', e.message);
    res.status(500).json({ error: 'Failed to delete flash', details: e.message });
  }
});

// ============ RETRO_REQUEST CRUD ============

// GET - List all retro_request
app.get(['/api/retro_request', '/retro_request'], requireAuth, async (req, res) => {
  try {
    const items = await prisma.retro_request.findMany();
    res.json(items);
  } catch (e) {
    console.error('❌ Error getting retro_request:', e.message);
    res.status(500).json({ error: 'Failed to fetch retro_request', details: e.message });
  }
});

// GET - Get single retro_request
app.get(['/api/retro_request/:id', '/retro_request/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.retro_request.findUnique({
      where: { id: req.params.id }
    });
    if (!item) return res.status(404).json({ error: 'retro_request not found' });
    res.json(item);
  } catch (e) {
    console.error('❌ Error getting retro_request:', e.message);
    res.status(500).json({ error: 'Failed to fetch retro_request', details: e.message });
  }
});

// POST - Create new retro_request
app.post(['/api/retro_request', '/retro_request'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.retro_request.create({
      data: {
        id: uid(),
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    res.status(201).json(item);
  } catch (e) {
    console.error('❌ Error creating retro_request:', e.message);
    res.status(500).json({ error: 'Failed to create retro_request', details: e.message });
  }
});

// PUT - Update retro_request
app.put(['/api/retro_request/:id', '/retro_request/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.retro_request.update({
      where: { id: req.params.id },
      data: { ...req.body, updatedAt: new Date() }
    });
    res.json(item);
  } catch (e) {
    console.error('❌ Error updating retro_request:', e.message);
    res.status(500).json({ error: 'Failed to update retro_request', details: e.message });
  }
});

// DELETE - Remove retro_request
app.delete(['/api/retro_request/:id', '/retro_request/:id'], requireAuth, async (req, res) => {
  try {
    const deleted = await prisma.retro_request.delete({
      where: { id: req.params.id }
    });
    res.json({ ok: true, deleted });
  } catch (e) {
    console.error('❌ Error deleting retro_request:', e.message);
    res.status(500).json({ error: 'Failed to delete retro_request', details: e.message });
  }
});

// ============ RETRO_REQUEST_FILE CRUD ============

// GET - List all retro_request_file
app.get(['/api/retro_request_file', '/retro_request_file'], requireAuth, async (req, res) => {
  try {
    const items = await prisma.retro_request_file.findMany();
    res.json(items);
  } catch (e) {
    console.error('❌ Error getting retro_request_file:', e.message);
    res.status(500).json({ error: 'Failed to fetch retro_request_file', details: e.message });
  }
});

// GET - Get single retro_request_file
app.get(['/api/retro_request_file/:id', '/retro_request_file/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.retro_request_file.findUnique({
      where: { id: req.params.id }
    });
    if (!item) return res.status(404).json({ error: 'retro_request_file not found' });
    res.json(item);
  } catch (e) {
    console.error('❌ Error getting retro_request_file:', e.message);
    res.status(500).json({ error: 'Failed to fetch retro_request_file', details: e.message });
  }
});

// POST - Create new retro_request_file
app.post(['/api/retro_request_file', '/retro_request_file'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.retro_request_file.create({
      data: {
        id: uid(),
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    res.status(201).json(item);
  } catch (e) {
    console.error('❌ Error creating retro_request_file:', e.message);
    res.status(500).json({ error: 'Failed to create retro_request_file', details: e.message });
  }
});

// PUT - Update retro_request_file
app.put(['/api/retro_request_file/:id', '/retro_request_file/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.retro_request_file.update({
      where: { id: req.params.id },
      data: { ...req.body, updatedAt: new Date() }
    });
    res.json(item);
  } catch (e) {
    console.error('❌ Error updating retro_request_file:', e.message);
    res.status(500).json({ error: 'Failed to update retro_request_file', details: e.message });
  }
});

// DELETE - Remove retro_request_file
app.delete(['/api/retro_request_file/:id', '/retro_request_file/:id'], requireAuth, async (req, res) => {
  try {
    const deleted = await prisma.retro_request_file.delete({
      where: { id: req.params.id }
    });
    res.json({ ok: true, deleted });
  } catch (e) {
    console.error('❌ Error deleting retro_request_file:', e.message);
    res.status(500).json({ error: 'Failed to delete retro_request_file', details: e.message });
  }
});

// ============ SITE_USERS CRUD ============

// GET - List all site_users
app.get(['/api/site_users', '/site_users'], requireAuth, async (req, res) => {
  try {
    const items = await prisma.site_users.findMany();
    res.json(items);
  } catch (e) {
    console.error('❌ Error getting site_users:', e.message);
    res.status(500).json({ error: 'Failed to fetch site_users', details: e.message });
  }
});

// GET - Get single site_users
app.get(['/api/site_users/:id', '/site_users/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.site_users.findUnique({
      where: { id: req.params.id }
    });
    if (!item) return res.status(404).json({ error: 'site_users not found' });
    res.json(item);
  } catch (e) {
    console.error('❌ Error getting site_users:', e.message);
    res.status(500).json({ error: 'Failed to fetch site_users', details: e.message });
  }
});

// POST - Create new site_users
app.post(['/api/site_users', '/site_users'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.site_users.create({
      data: {
        id: uid(),
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    res.status(201).json(item);
  } catch (e) {
    console.error('❌ Error creating site_users:', e.message);
    res.status(500).json({ error: 'Failed to create site_users', details: e.message });
  }
});

// PUT - Update site_users
app.put(['/api/site_users/:id', '/site_users/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.site_users.update({
      where: { id: req.params.id },
      data: { ...req.body, updatedAt: new Date() }
    });
    res.json(item);
  } catch (e) {
    console.error('❌ Error updating site_users:', e.message);
    res.status(500).json({ error: 'Failed to update site_users', details: e.message });
  }
});

// DELETE - Remove site_users
app.delete(['/api/site_users/:id', '/site_users/:id'], requireAuth, async (req, res) => {
  try {
    const deleted = await prisma.site_users.delete({
      where: { id: req.params.id }
    });
    res.json({ ok: true, deleted });
  } catch (e) {
    console.error('❌ Error deleting site_users:', e.message);
    res.status(500).json({ error: 'Failed to delete site_users', details: e.message });
  }
});

// ============ DOCUMENT CRUD ============

// GET - List all document
app.get(['/api/document', '/document'], requireAuth, async (req, res) => {
  try {
    const items = await prisma.document.findMany();
    res.json(items);
  } catch (e) {
    console.error('❌ Error getting document:', e.message);
    res.status(500).json({ error: 'Failed to fetch document', details: e.message });
  }
});

// GET - Get single document
app.get(['/api/document/:id', '/document/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.document.findUnique({
      where: { id: req.params.id }
    });
    if (!item) return res.status(404).json({ error: 'document not found' });
    res.json(item);
  } catch (e) {
    console.error('❌ Error getting document:', e.message);
    res.status(500).json({ error: 'Failed to fetch document', details: e.message });
  }
});

// POST - Create new document
app.post(['/api/document', '/document'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.document.create({
      data: {
        id: uid(),
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    res.status(201).json(item);
  } catch (e) {
    console.error('❌ Error creating document:', e.message);
    res.status(500).json({ error: 'Failed to create document', details: e.message });
  }
});

// PUT - Update document
app.put(['/api/document/:id', '/document/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.document.update({
      where: { id: req.params.id },
      data: { ...req.body, updatedAt: new Date() }
    });
    res.json(item);
  } catch (e) {
    console.error('❌ Error updating document:', e.message);
    res.status(500).json({ error: 'Failed to update document', details: e.message });
  }
});

// DELETE - Remove document
app.delete(['/api/document/:id', '/document/:id'], requireAuth, async (req, res) => {
  try {
    const deleted = await prisma.document.delete({
      where: { id: req.params.id }
    });
    res.json({ ok: true, deleted });
  } catch (e) {
    console.error('❌ Error deleting document:', e.message);
    res.status(500).json({ error: 'Failed to delete document', details: e.message });
  }
});

// ============ VEHICLE_MAINTENANCE CRUD ============

// GET - List all vehicle_maintenance
app.get(['/api/vehicle_maintenance', '/vehicle_maintenance'], requireAuth, async (req, res) => {
  try {
    const items = await prisma.vehicle_maintenance.findMany();
    res.json(items);
  } catch (e) {
    console.error('❌ Error getting vehicle_maintenance:', e.message);
    res.status(500).json({ error: 'Failed to fetch vehicle_maintenance', details: e.message });
  }
});

// GET - Get single vehicle_maintenance
app.get(['/api/vehicle_maintenance/:id', '/vehicle_maintenance/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicle_maintenance.findUnique({
      where: { id: req.params.id }
    });
    if (!item) return res.status(404).json({ error: 'vehicle_maintenance not found' });
    res.json(item);
  } catch (e) {
    console.error('❌ Error getting vehicle_maintenance:', e.message);
    res.status(500).json({ error: 'Failed to fetch vehicle_maintenance', details: e.message });
  }
});

// POST - Create new vehicle_maintenance
app.post(['/api/vehicle_maintenance', '/vehicle_maintenance'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicle_maintenance.create({
      data: {
        id: uid(),
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    res.status(201).json(item);
  } catch (e) {
    console.error('❌ Error creating vehicle_maintenance:', e.message);
    res.status(500).json({ error: 'Failed to create vehicle_maintenance', details: e.message });
  }
});

// PUT - Update vehicle_maintenance
app.put(['/api/vehicle_maintenance/:id', '/vehicle_maintenance/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicle_maintenance.update({
      where: { id: req.params.id },
      data: { ...req.body, updatedAt: new Date() }
    });
    res.json(item);
  } catch (e) {
    console.error('❌ Error updating vehicle_maintenance:', e.message);
    res.status(500).json({ error: 'Failed to update vehicle_maintenance', details: e.message });
  }
});

// DELETE - Remove vehicle_maintenance
app.delete(['/api/vehicle_maintenance/:id', '/vehicle_maintenance/:id'], requireAuth, async (req, res) => {
  try {
    const deleted = await prisma.vehicle_maintenance.delete({
      where: { id: req.params.id }
    });
    res.json({ ok: true, deleted });
  } catch (e) {
    console.error('❌ Error deleting vehicle_maintenance:', e.message);
    res.status(500).json({ error: 'Failed to delete vehicle_maintenance', details: e.message });
  }
});

// ============ VEHICLE_SERVICE_SCHEDULE CRUD ============

// GET - List all vehicle_service_schedule
app.get(['/api/vehicle_service_schedule', '/vehicle_service_schedule'], requireAuth, async (req, res) => {
  try {
    const items = await prisma.vehicle_service_schedule.findMany();
    res.json(items);
  } catch (e) {
    console.error('❌ Error getting vehicle_service_schedule:', e.message);
    res.status(500).json({ error: 'Failed to fetch vehicle_service_schedule', details: e.message });
  }
});

// GET - Get single vehicle_service_schedule
app.get(['/api/vehicle_service_schedule/:id', '/vehicle_service_schedule/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicle_service_schedule.findUnique({
      where: { id: req.params.id }
    });
    if (!item) return res.status(404).json({ error: 'vehicle_service_schedule not found' });
    res.json(item);
  } catch (e) {
    console.error('❌ Error getting vehicle_service_schedule:', e.message);
    res.status(500).json({ error: 'Failed to fetch vehicle_service_schedule', details: e.message });
  }
});

// POST - Create new vehicle_service_schedule
app.post(['/api/vehicle_service_schedule', '/vehicle_service_schedule'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicle_service_schedule.create({
      data: {
        id: uid(),
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    res.status(201).json(item);
  } catch (e) {
    console.error('❌ Error creating vehicle_service_schedule:', e.message);
    res.status(500).json({ error: 'Failed to create vehicle_service_schedule', details: e.message });
  }
});

// PUT - Update vehicle_service_schedule
app.put(['/api/vehicle_service_schedule/:id', '/vehicle_service_schedule/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicle_service_schedule.update({
      where: { id: req.params.id },
      data: { ...req.body, updatedAt: new Date() }
    });
    res.json(item);
  } catch (e) {
    console.error('❌ Error updating vehicle_service_schedule:', e.message);
    res.status(500).json({ error: 'Failed to update vehicle_service_schedule', details: e.message });
  }
});

// DELETE - Remove vehicle_service_schedule
app.delete(['/api/vehicle_service_schedule/:id', '/vehicle_service_schedule/:id'], requireAuth, async (req, res) => {
  try {
    const deleted = await prisma.vehicle_service_schedule.delete({
      where: { id: req.params.id }
    });
    res.json({ ok: true, deleted });
  } catch (e) {
    console.error('❌ Error deleting vehicle_service_schedule:', e.message);
    res.status(500).json({ error: 'Failed to delete vehicle_service_schedule', details: e.message });
  }
});

// ============ USAGE CRUD ============

// GET - List all usage
app.get(['/api/usage', '/usage'], requireAuth, async (req, res) => {
  try {
    const items = await prisma.Usage.findMany();
    res.json(items);
  } catch (e) {
    console.error('❌ Error getting usage:', e.message);
    res.status(500).json({ error: 'Failed to fetch usage', details: e.message });
  }
});

// GET - Get single usage
app.get(['/api/usage/:id', '/usage/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.Usage.findUnique({
      where: { id: req.params.id }
    });
    if (!item) return res.status(404).json({ error: 'usage not found' });
    res.json(item);
  } catch (e) {
    console.error('❌ Error getting usage:', e.message);
    res.status(500).json({ error: 'Failed to fetch usage', details: e.message });
  }
});

// POST - Create new usage
app.post(['/api/usage', '/usage'], requireAuth, async (req, res) => {
  try {
    const { parc, startedAt, ...rest } = req.body;
    
    if (!parc || !startedAt) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        required: ['parc', 'startedAt']
      });
    }
    
    const item = await prisma.Usage.create({
      data: {
        parc,
        startedAt: new Date(startedAt),
        ...rest,
        updatedAt: new Date()
      }
    });
    res.status(201).json(item);
  } catch (e) {
    console.error('❌ Error creating usage:', e.message);
    res.status(500).json({ error: 'Failed to create usage', details: e.message });
  }
});

// PUT - Update usage
app.put(['/api/usage/:id', '/usage/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.Usage.update({
      where: { id: req.params.id },
      data: { ...req.body, updatedAt: new Date() }
    });
    res.json(item);
  } catch (e) {
    console.error('❌ Error updating usage:', e.message);
    res.status(500).json({ error: 'Failed to update usage', details: e.message });
  }
});

// DELETE - Remove usage
app.delete(['/api/usage/:id', '/usage/:id'], requireAuth, async (req, res) => {
  try {
    const deleted = await prisma.Usage.delete({
      where: { id: req.params.id }
    });
    res.json({ ok: true, deleted });
  } catch (e) {
    console.error('❌ Error deleting usage:', e.message);
    res.status(500).json({ error: 'Failed to delete usage', details: e.message });
  }
});

// ============ VEHICLECONTROLTECHNIQUE CRUD ============

// GET - List all vehicleControlTechnique
app.get(['/api/vehicle-control-technique', '/vehicle-control-technique'], requireAuth, async (req, res) => {
  try {
    const items = await prisma.vehicleControlTechnique.findMany();
    res.json(items);
  } catch (e) {
    console.error('❌ Error getting vehicleControlTechnique:', e.message);
    res.status(500).json({ error: 'Failed to fetch vehicleControlTechnique', details: e.message });
  }
});

// GET - Get single vehicleControlTechnique
app.get(['/api/vehicle-control-technique/:id', '/vehicle-control-technique/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicleControlTechnique.findUnique({
      where: { id: req.params.id }
    });
    if (!item) return res.status(404).json({ error: 'vehicleControlTechnique not found' });
    res.json(item);
  } catch (e) {
    console.error('❌ Error getting vehicleControlTechnique:', e.message);
    res.status(500).json({ error: 'Failed to fetch vehicleControlTechnique', details: e.message });
  }
});

// POST - Create new vehicleControlTechnique
app.post(['/api/vehicle-control-technique', '/vehicle-control-technique'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicleControlTechnique.create({
      data: {
        id: uid(),
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    res.status(201).json(item);
  } catch (e) {
    console.error('❌ Error creating vehicleControlTechnique:', e.message);
    res.status(500).json({ error: 'Failed to create vehicleControlTechnique', details: e.message });
  }
});

// PUT - Update vehicleControlTechnique
app.put(['/api/vehicle-control-technique/:id', '/vehicle-control-technique/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicleControlTechnique.update({
      where: { id: req.params.id },
      data: { ...req.body, updatedAt: new Date() }
    });
    res.json(item);
  } catch (e) {
    console.error('❌ Error updating vehicleControlTechnique:', e.message);
    res.status(500).json({ error: 'Failed to update vehicleControlTechnique', details: e.message });
  }
});

// DELETE - Remove vehicleControlTechnique
app.delete(['/api/vehicle-control-technique/:id', '/vehicle-control-technique/:id'], requireAuth, async (req, res) => {
  try {
    const deleted = await prisma.vehicleControlTechnique.delete({
      where: { id: req.params.id }
    });
    res.json({ ok: true, deleted });
  } catch (e) {
    console.error('❌ Error deleting vehicleControlTechnique:', e.message);
    res.status(500).json({ error: 'Failed to delete vehicleControlTechnique', details: e.message });
  }
});

// ============ VEHICLECESSIONCERTIFICATE CRUD ============

// GET - List all vehicleCessionCertificate
app.get(['/api/vehicle-cession-certificate', '/vehicle-cession-certificate'], requireAuth, async (req, res) => {
  try {
    const items = await prisma.vehicleCessionCertificate.findMany();
    res.json(items);
  } catch (e) {
    console.error('❌ Error getting vehicleCessionCertificate:', e.message);
    res.status(500).json({ error: 'Failed to fetch vehicleCessionCertificate', details: e.message });
  }
});

// GET - Get single vehicleCessionCertificate
app.get(['/api/vehicle-cession-certificate/:id', '/vehicle-cession-certificate/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicleCessionCertificate.findUnique({
      where: { id: req.params.id }
    });
    if (!item) return res.status(404).json({ error: 'vehicleCessionCertificate not found' });
    res.json(item);
  } catch (e) {
    console.error('❌ Error getting vehicleCessionCertificate:', e.message);
    res.status(500).json({ error: 'Failed to fetch vehicleCessionCertificate', details: e.message });
  }
});

// POST - Create new vehicleCessionCertificate
app.post(['/api/vehicle-cession-certificate', '/vehicle-cession-certificate'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicleCessionCertificate.create({
      data: {
        id: uid(),
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    res.status(201).json(item);
  } catch (e) {
    console.error('❌ Error creating vehicleCessionCertificate:', e.message);
    res.status(500).json({ error: 'Failed to create vehicleCessionCertificate', details: e.message });
  }
});

// PUT - Update vehicleCessionCertificate
app.put(['/api/vehicle-cession-certificate/:id', '/vehicle-cession-certificate/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicleCessionCertificate.update({
      where: { id: req.params.id },
      data: { ...req.body, updatedAt: new Date() }
    });
    res.json(item);
  } catch (e) {
    console.error('❌ Error updating vehicleCessionCertificate:', e.message);
    res.status(500).json({ error: 'Failed to update vehicleCessionCertificate', details: e.message });
  }
});

// DELETE - Remove vehicleCessionCertificate
app.delete(['/api/vehicle-cession-certificate/:id', '/vehicle-cession-certificate/:id'], requireAuth, async (req, res) => {
  try {
    const deleted = await prisma.vehicleCessionCertificate.delete({
      where: { id: req.params.id }
    });
    res.json({ ok: true, deleted });
  } catch (e) {
    console.error('❌ Error deleting vehicleCessionCertificate:', e.message);
    res.status(500).json({ error: 'Failed to delete vehicleCessionCertificate', details: e.message });
  }
});

// ============ VEHICLEGRAYSCALE CRUD ============

// GET - List all vehicleGrayscale
app.get(['/api/vehicle-grayscale', '/vehicle-grayscale'], requireAuth, async (req, res) => {
  try {
    const items = await prisma.vehicleGrayscale.findMany();
    res.json(items);
  } catch (e) {
    console.error('❌ Error getting vehicleGrayscale:', e.message);
    res.status(500).json({ error: 'Failed to fetch vehicleGrayscale', details: e.message });
  }
});

// GET - Get single vehicleGrayscale
app.get(['/api/vehicle-grayscale/:id', '/vehicle-grayscale/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicleGrayscale.findUnique({
      where: { id: req.params.id }
    });
    if (!item) return res.status(404).json({ error: 'vehicleGrayscale not found' });
    res.json(item);
  } catch (e) {
    console.error('❌ Error getting vehicleGrayscale:', e.message);
    res.status(500).json({ error: 'Failed to fetch vehicleGrayscale', details: e.message });
  }
});

// POST - Create new vehicleGrayscale
app.post(['/api/vehicle-grayscale', '/vehicle-grayscale'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicleGrayscale.create({
      data: {
        id: uid(),
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    res.status(201).json(item);
  } catch (e) {
    console.error('❌ Error creating vehicleGrayscale:', e.message);
    res.status(500).json({ error: 'Failed to create vehicleGrayscale', details: e.message });
  }
});

// PUT - Update vehicleGrayscale
app.put(['/api/vehicle-grayscale/:id', '/vehicle-grayscale/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicleGrayscale.update({
      where: { id: req.params.id },
      data: { ...req.body, updatedAt: new Date() }
    });
    res.json(item);
  } catch (e) {
    console.error('❌ Error updating vehicleGrayscale:', e.message);
    res.status(500).json({ error: 'Failed to update vehicleGrayscale', details: e.message });
  }
});

// DELETE - Remove vehicleGrayscale
app.delete(['/api/vehicle-grayscale/:id', '/vehicle-grayscale/:id'], requireAuth, async (req, res) => {
  try {
    const deleted = await prisma.vehicleGrayscale.delete({
      where: { id: req.params.id }
    });
    res.json({ ok: true, deleted });
  } catch (e) {
    console.error('❌ Error deleting vehicleGrayscale:', e.message);
    res.status(500).json({ error: 'Failed to delete vehicleGrayscale', details: e.message });
  }
});

// ============ VEHICLEINSURANCE CRUD ============

// GET - List all vehicleInsurance
app.get(['/api/vehicle-insurance', '/vehicle-insurance'], requireAuth, async (req, res) => {
  try {
    const items = await prisma.vehicleInsurance.findMany();
    res.json(items);
  } catch (e) {
    console.error('❌ Error getting vehicleInsurance:', e.message);
    res.status(500).json({ error: 'Failed to fetch vehicleInsurance', details: e.message });
  }
});

// GET - Get single vehicleInsurance
app.get(['/api/vehicle-insurance/:id', '/vehicle-insurance/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicleInsurance.findUnique({
      where: { id: req.params.id }
    });
    if (!item) return res.status(404).json({ error: 'vehicleInsurance not found' });
    res.json(item);
  } catch (e) {
    console.error('❌ Error getting vehicleInsurance:', e.message);
    res.status(500).json({ error: 'Failed to fetch vehicleInsurance', details: e.message });
  }
});

// POST - Create new vehicleInsurance
app.post(['/api/vehicle-insurance', '/vehicle-insurance'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicleInsurance.create({
      data: {
        id: uid(),
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    res.status(201).json(item);
  } catch (e) {
    console.error('❌ Error creating vehicleInsurance:', e.message);
    res.status(500).json({ error: 'Failed to create vehicleInsurance', details: e.message });
  }
});

// PUT - Update vehicleInsurance
app.put(['/api/vehicle-insurance/:id', '/vehicle-insurance/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicleInsurance.update({
      where: { id: req.params.id },
      data: { ...req.body, updatedAt: new Date() }
    });
    res.json(item);
  } catch (e) {
    console.error('❌ Error updating vehicleInsurance:', e.message);
    res.status(500).json({ error: 'Failed to update vehicleInsurance', details: e.message });
  }
});

// DELETE - Remove vehicleInsurance
app.delete(['/api/vehicle-insurance/:id', '/vehicle-insurance/:id'], requireAuth, async (req, res) => {
  try {
    const deleted = await prisma.vehicleInsurance.delete({
      where: { id: req.params.id }
    });
    res.json({ ok: true, deleted });
  } catch (e) {
    console.error('❌ Error deleting vehicleInsurance:', e.message);
    res.status(500).json({ error: 'Failed to delete vehicleInsurance', details: e.message });
  }
});

// ============ VEHICLEINSPECTION CRUD ============

// GET - List all vehicleInspection
app.get(['/api/vehicle-inspection', '/vehicle-inspection'], requireAuth, async (req, res) => {
  try {
    const items = await prisma.vehicleInspection.findMany();
    res.json(items);
  } catch (e) {
    console.error('❌ Error getting vehicleInspection:', e.message);
    res.status(500).json({ error: 'Failed to fetch vehicleInspection', details: e.message });
  }
});

// GET - Get single vehicleInspection
app.get(['/api/vehicle-inspection/:id', '/vehicle-inspection/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicleInspection.findUnique({
      where: { id: req.params.id }
    });
    if (!item) return res.status(404).json({ error: 'vehicleInspection not found' });
    res.json(item);
  } catch (e) {
    console.error('❌ Error getting vehicleInspection:', e.message);
    res.status(500).json({ error: 'Failed to fetch vehicleInspection', details: e.message });
  }
});

// POST - Create new vehicleInspection
app.post(['/api/vehicle-inspection', '/vehicle-inspection'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicleInspection.create({
      data: {
        id: uid(),
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    res.status(201).json(item);
  } catch (e) {
    console.error('❌ Error creating vehicleInspection:', e.message);
    res.status(500).json({ error: 'Failed to create vehicleInspection', details: e.message });
  }
});

// PUT - Update vehicleInspection
app.put(['/api/vehicle-inspection/:id', '/vehicle-inspection/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicleInspection.update({
      where: { id: req.params.id },
      data: { ...req.body, updatedAt: new Date() }
    });
    res.json(item);
  } catch (e) {
    console.error('❌ Error updating vehicleInspection:', e.message);
    res.status(500).json({ error: 'Failed to update vehicleInspection', details: e.message });
  }
});

// DELETE - Remove vehicleInspection
app.delete(['/api/vehicle-inspection/:id', '/vehicle-inspection/:id'], requireAuth, async (req, res) => {
  try {
    const deleted = await prisma.vehicleInspection.delete({
      where: { id: req.params.id }
    });
    res.json({ ok: true, deleted });
  } catch (e) {
    console.error('❌ Error deleting vehicleInspection:', e.message);
    res.status(500).json({ error: 'Failed to delete vehicleInspection', details: e.message });
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Arrêt du serveur...');
  // Sauvegarder l'état avant de fermer
  if (ENABLE_RUNTIME_STATE_SAVE) {
    console.log('💾 Sauvegarde de l\'état en cours...');
    persistStateToDisk();
  }
  await safeDisconnectPrisma();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Arrêt du serveur (SIGTERM)...');
  // Sauvegarder l'état avant de fermer
  if (ENABLE_RUNTIME_STATE_SAVE) {
    console.log('💾 Sauvegarde de l\'état en cours...');
    persistStateToDisk();
  }
  await safeDisconnectPrisma();
  process.exit(0);
});