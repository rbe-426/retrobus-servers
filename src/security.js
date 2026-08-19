/**
 * 🔐 SÉCURITÉ ANTI-HACK - RETROBUS ESSONNE
 * Protège les données sensibles (emails, mots de passe)
 * Prévient les attaques courantes (XSS, CSRF, SQL Injection, etc.)
 */

import helmet from 'helmet';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { body, validationResult, query } from 'express-validator';
import validator from 'validator';
import sanitizeHtml from 'sanitize-html';

// ============================================================
// 🛡️ HELMET - Headers de sécurité
// ============================================================
export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  // Empêche le clickjacking
  frameguard: { action: 'deny' },
  // Désactive MIME-type sniffing
  noSniff: true,
  // Protège contre XSS (navigateurs modernes)
  xssFilter: true,
  // Empêche le iframing du site par des tiers
  crossOriginEmbedderPolicy: true,
  // HSTS - Force HTTPS
  hsts: {
    maxAge: 31536000, // 1 an
    includeSubDomains: true,
    preload: true,
  },
  // Désactive les referrers
  referrerPolicy: { policy: 'no-referrer' },
  // Désactive le DNS prefetch
  dnsPrefetchControl: { allow: false },
});

// ============================================================
// ⏱️ RATE LIMITING - Anti-brute force & DDoS
// ============================================================

// Limite générale - 100 requêtes par 15 minutes
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: '❌ Trop de requêtes, réessayez plus tard',
  standardHeaders: true,
  legacyHeaders: false,
  // Utilise IP du client (même derrière proxy)
  keyGenerator: (req) => ipKeyGenerator(req),
});

// Limite stricte pour les endpoints d'auth
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // Max 5 tentatives par 15 minutes
  message: '❌ Trop de tentatives de connexion, réessayez dans 15 minutes',
  skipSuccessfulRequests: true, // Ne compte pas les succès
  skipFailedRequests: false, // Compte les échechs
  keyGenerator: (req) => {
    // Limite par email/matricule, fallback sur IP normalisée
    const identifier = (req.body?.email || req.body?.matricule || '').toLowerCase();
    return identifier || ipKeyGenerator(req);
  },
});

// Limite stricte pour les endpoints de upload
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 20, // Max 20 uploads par heure
  message: '❌ Limite de uploads dépassée',
});

// Limite pour les endpoints de données sensibles
export const sensitiveDataLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 50, // Max 50 requêtes par heure
  message: '❌ Limite d\'accès aux données sensibles dépassée',
  skipSuccessfulRequests: false,
});

// ============================================================
// 🔒 NETTOYAGE D'ENTRÉES - XSS Protection
// ============================================================

const SANITIZE_OPTIONS = {
  allowedTags: [], // Aucune balise HTML autorisée
  allowedAttributes: {},
  disallowedTagsMode: 'discard',
};

/**
 * Nettoie une chaîne contre les injections XSS
 */
export const sanitizeInput = (input) => {
  if (!input) return input;
  if (typeof input !== 'string') return input;
  
  // Trim
  let cleaned = input.trim();
  
  // Enlever les caractères de contrôle
  cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, '');
  
  // Sanitize HTML
  cleaned = sanitizeHtml(cleaned, SANITIZE_OPTIONS);
  
  return cleaned;
};

/**
 * Valide et nettoie un objet entier
 */
export const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    // Saute les clés sensibles
    if (['password', 'passwordHash', 'salt', 'token', 'privateKey'].some(s => key.toLowerCase().includes(s))) {
      sanitized[key] = value;
      continue;
    }
    
    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

// ============================================================
// ✅ VALIDATEURS EXPRESS - Input validation
// ============================================================

/**
 * Valide un email
 */
export const validateEmail = () =>
  body('email')
    .trim()
    .toLowerCase()
    .isEmail()
    .withMessage('Email invalide')
    .normalizeEmail();

/**
 * Valide un mot de passe
 */
export const validatePassword = () =>
  body('password')
    .isLength({ min: 8 })
    .withMessage('Le mot de passe doit faire au moins 8 caractères')
    .matches(/[A-Z]/, 'g')
    .withMessage('Le mot de passe doit contenir au moins une majuscule')
    .matches(/[a-z]/, 'g')
    .withMessage('Le mot de passe doit contenir au moins une minuscule')
    .matches(/[0-9]/, 'g')
    .withMessage('Le mot de passe doit contenir au moins un chiffre')
    .matches(/[!@#$%^&*(),.?":{}|<>]/, 'g')
    .withMessage('Le mot de passe doit contenir au moins un caractère spécial');

/**
 * Valide un matricule (format: XXXX-XXX)
 */
export const validateMatricule = () =>
  body('matricule')
    .trim()
    .matches(/^\d{4}-\d{3}$/)
    .withMessage('Format matricule invalide (XXX-XXX)');

/**
 * Valide un nom
 */
export const validateName = (fieldName = 'name') =>
  body(fieldName)
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage(`${fieldName} doit faire entre 2 et 100 caractères`)
    .matches(/^[a-zA-ZÀ-ÿ\s'-]+$/)
    .withMessage(`${fieldName} contient des caractères invalides`);

/**
 * Handler pour erreurs de validation
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(e => ({
        field: e.param,
        message: e.msg
      }))
    });
  }
  next();
};

// ============================================================
// 🔍 LOGGING SÉCURISÉ - Masque données sensibles
// ============================================================

const SENSITIVE_PATTERNS = {
  password: /password['":\s=]+(['"]{0,1}[^\s'"]+['"]{0,1})/gi,
  email: /([a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
  token: /(Bearer\s+|token['":\s=]+)([a-zA-Z0-9._\-]+)/gi,
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  apiKey: /(api[_-]?key['":\s=]+)([a-zA-Z0-9._\-]+)/gi,
  authorizationHeader: /(Authorization['":\s=]+[Bb]earer\s+)([a-zA-Z0-9._\-]+)/gi,
  jwtToken: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
  // Tous les champs de mot de passe (old, new, current, confirm, etc.)
  allPasswordFields: /(["\'](?:old|new|current|confirm)?[Pp]assword["\']:\s*["\'])([^"\']*)["\'']/gi,
};

/**
 * Masque les données sensibles dans un string ou objet
 * Gère les strings, objets JSON et arrays
 */
export const maskSensitiveData = (data) => {
  // Si c'est un objet ou array, le convertir en string d'abord
  let masked = typeof data === 'string' ? data : JSON.stringify(data);
  
  // Masque tous les champs de mots de passe (password, oldPassword, newPassword, etc.)
  masked = masked.replace(SENSITIVE_PATTERNS.password, 'password":"***REDACTED***');
  masked = masked.replace(SENSITIVE_PATTERNS.allPasswordFields, '$1***REDACTED***"');
  
  // Masque les tokens JWT complets
  masked = masked.replace(SENSITIVE_PATTERNS.jwtToken, '***JWT_REDACTED***');
  
  // Masque les Authorization headers
  masked = masked.replace(SENSITIVE_PATTERNS.authorizationHeader, '$1***REDACTED***');
  
  // Masque les tokens génériques
  masked = masked.replace(SENSITIVE_PATTERNS.token, '$1***REDACTED***');
  
  // Masque les API keys
  masked = masked.replace(SENSITIVE_PATTERNS.apiKey, '$1***REDACTED***');
  
  // Masque les emails (sauf les quelques premiers caractères)
  masked = masked.replace(SENSITIVE_PATTERNS.email, (match) => {
    const [user] = match.split('@');
    const maskedUser = user.slice(0, Math.min(3, user.length)) + '***';
    return maskedUser + '@***.***';
  });
  
  // Masque les numéros de carte de crédit
  masked = masked.replace(SENSITIVE_PATTERNS.creditCard, '****-****-****-****');
  
  // Masque les SSN / Numéros d'identification
  masked = masked.replace(SENSITIVE_PATTERNS.ssn, '***-**-****');
  
  // Masque les variables d'environnement sensibles
  masked = masked.replace(/(["\']?(?:SMTP_|EMAIL_|API_|SECRET_|PRIVATE_|DATABASE_|ADMIN_)[A-Z_]*["\']?:\s*["\'])([^"\']*)["\'']/gi, '$1***REDACTED***"');
  
  return masked;
};

/**
 * Logger sécurisé pour l'API
 * Applique le masquage des données sensibles à toutes les requêtes/réponses
 */
export const secureLogger = (req, res, next) => {
  // Log la requête (masquée)
  const maskedBody = req.body ? maskSensitiveData(JSON.stringify(req.body)) : 'no body';
  console.log(`📨 [${req.method}] ${req.path} from ${req.ip}`);
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    console.log(`   Body: ${maskedBody.substring(0, 200)}...`); // Log limité
  }

  // Intercepte les réponses JSON
  const originalJson = res.json;
  res.json = function(data) {
    // Masque les données dans la réponse avant logging
    const maskedResponse = maskSensitiveData(JSON.stringify(data));
    if (res.statusCode >= 400) {
      // Log les erreurs complètement (masquées)
      console.warn(`❌ [${req.method}] ${req.path} → Status: ${res.statusCode}`);
      console.warn(`   Body: ${maskedResponse.substring(0, 400)}`);
    }
    
    // Envoie les données originales (en JSON non-masqué) à la réponse
    return originalJson.call(this, data);
  };

  // Intercepte aussi les réponses text pour les erreurs
  const originalSend = res.send;
  res.send = function(data) {
    if (typeof data === 'string' && res.statusCode >= 400) {
      const maskedData = maskSensitiveData(data);
      console.warn(`❌ [${req.method}] ${req.path} → Status: ${res.statusCode}`);
      console.warn(`   Error: ${maskedData.substring(0, 400)}`);
    }
    return originalSend.call(this, data);
  };

  next();
};

// ============================================================
// 🔐 PROTECTION CSRF
// ============================================================

const csrfTokens = new Map();

/**
 * Génère un token CSRF
 */
export const generateCsrfToken = (sessionId) => {
  const token = require('crypto').randomBytes(32).toString('hex');
  csrfTokens.set(sessionId, token);
  return token;
};

/**
 * Vérifie un token CSRF
 */
export const verifyCsrfToken = (req, res, next) => {
  // Skip CSRF pour les méthodes GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  const token = req.headers['x-csrf-token'] || req.body._csrf;
  const sessionId = req.headers['x-session-id'] || req.cookies?.sessionId;
  
  if (!token || !sessionId || csrfTokens.get(sessionId) !== token) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  
  next();
};

// ============================================================
// 🚀 ENCRYPTION - Pour données ultra-sensibles
// ============================================================

import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ENCRYPTION_ALGO = 'aes-256-gcm';

/**
 * Encrypt une donnée sensible
 */
export const encryptSensitiveData = (data) => {
  if (!data) return null;
  
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGO, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      iv: iv.toString('hex'),
      encrypted,
      authTag: authTag.toString('hex'),
    };
  } catch (error) {
    console.error('❌ Encryption error:', error);
    return null;
  }
};

/**
 * Decrypt une donnée sensible
 */
export const decryptSensitiveData = (encrypted) => {
  if (!encrypted || !encrypted.iv || !encrypted.encrypted) return null;
  
  try {
    const iv = Buffer.from(encrypted.iv, 'hex');
    const authTag = Buffer.from(encrypted.authTag, 'hex');
    const decipher = crypto.createDecipheriv(
      ENCRYPTION_ALGO,
      Buffer.from(ENCRYPTION_KEY, 'hex'),
      iv
    );
    
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('❌ Decryption error:', error);
    return null;
  }
};

// ============================================================
// 📋 AUDIT LOGGING - Trace toutes les actions sensibles
// ============================================================

const AUDIT_LOGS_MAX = 1000;
const auditLogsBuffer = [];

const pushAuditEntry = (entry) => {
  auditLogsBuffer.push(entry);
  if (auditLogsBuffer.length > AUDIT_LOGS_MAX) {
    auditLogsBuffer.splice(0, auditLogsBuffer.length - AUDIT_LOGS_MAX);
  }
};

export const auditLog = (action, user, details, status = 'success') => {
  const timestamp = new Date().toISOString();
  const maskedDetails = maskSensitiveData(JSON.stringify(details));

  pushAuditEntry({
    timestamp,
    action,
    user: user || 'ANONYMOUS',
    status,
    details: maskedDetails,
  });
  
  console.log(`🔐 [AUDIT] ${timestamp} | ${status.toUpperCase()} | ${action} | User: ${user || 'ANONYMOUS'} | ${maskedDetails}`);
};

export const getAuditLogs = (limit = 200) => {
  const normalizedLimit = Number.isFinite(Number(limit))
    ? Math.max(1, Math.min(1000, Number(limit)))
    : 200;

  return auditLogsBuffer.slice(-normalizedLimit).reverse();
};

export const getAuditLogsSummary = () => {
  const byStatus = auditLogsBuffer.reduce((acc, log) => {
    const key = (log.status || 'unknown').toLowerCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const byAction = auditLogsBuffer.reduce((acc, log) => {
    const key = log.action || 'UNKNOWN';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    total: auditLogsBuffer.length,
    byStatus,
    topActions: Object.entries(byAction)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([action, count]) => ({ action, count })),
    lastEventAt: auditLogsBuffer.length > 0 ? auditLogsBuffer[auditLogsBuffer.length - 1].timestamp : null,
  };
};

// ============================================================
// ✨ EXPORT DEFAULT
// ============================================================

export default {
  helmetConfig,
  generalLimiter,
  authLimiter,
  uploadLimiter,
  sensitiveDataLimiter,
  sanitizeInput,
  sanitizeObject,
  validateEmail,
  validatePassword,
  validateMatricule,
  validateName,
  handleValidationErrors,
  maskSensitiveData,
  secureLogger,
  generateCsrfToken,
  verifyCsrfToken,
  encryptSensitiveData,
  decryptSensitiveData,
  auditLog,
  getAuditLogs,
  getAuditLogsSummary,
};
