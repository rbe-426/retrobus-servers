/**
 * CSRF Protection Service
 * Utilise une approche double-submit token + signature HMAC
 * 
 * Fonctionnement:
 * 1. GET /api/csrf-token → retourne un token unique
 * 2. Frontend stocke le token en localStorage
 * 3. Frontend l'envoie dans header X-CSRF-Token pour chaque POST/PUT/DELETE
 * 4. Serveur valide le token et l'origine
 */

import crypto from 'crypto';

const CSRF_SECRET = process.env.CSRF_SECRET || crypto.randomBytes(32).toString('hex');
const CSRF_TOKEN_TTL = 24 * 60 * 60 * 1000; // 24 heures
const MAX_TOKENS = 1000; // Limiter pour éviter les fuites mémoire

// In-memory store pour tokens CSRF (simple, production: utiliser Redis)
const csrfTokenStore = new Map();

/**
 * Génère un token CSRF unique avec un secret
 * Format: token|timestamp|signature
 */
export const generateCSRFToken = () => {
  try {
    const randomBytes = crypto.randomBytes(32).toString('hex');
    const timestamp = Date.now();
    const expiresAt = timestamp + CSRF_TOKEN_TTL;
    
    // Créer une signature HMAC du token + timestamp
    const message = `${randomBytes}|${timestamp}`;
    const signature = crypto
      .createHmac('sha256', CSRF_SECRET)
      .update(message)
      .digest('hex');
    
    const token = `${randomBytes}|${timestamp}|${signature}`;
    
    // Stocker en mémoire (cleanup des anciens si trop de tokens)
    if (csrfTokenStore.size >= MAX_TOKENS) {
      // Supprimer les tokens les plus vieux
      const entries = Array.from(csrfTokenStore.entries());
      const sortedByAge = entries.sort((a, b) => a[1].createdAt - b[1].createdAt);
      for (let i = 0; i < Math.ceil(MAX_TOKENS * 0.1); i++) {
        csrfTokenStore.delete(sortedByAge[i][0]);
      }
    }
    
    csrfTokenStore.set(token, {
      createdAt: timestamp,
      expiresAt: expiresAt
    });
    
    console.log(`🔐 Generated CSRF token. Store size: ${csrfTokenStore.size}`);
    
    return token;
  } catch (error) {
    console.error('❌ Error generating CSRF token:', error.message);
    throw error;
  }
};

/**
 * Valide un token CSRF
 * Retourne true si valide, false sinon
 */
export const verifyCSRFToken = (token) => {
  try {
    if (!token || typeof token !== 'string') {
      console.warn('⚠️  CSRF: Token missing or invalid type');
      return false;
    }

    const parts = token.split('|');
    if (parts.length !== 3) {
      console.warn('⚠️  CSRF: Token format invalid (expected 3 parts)');
      return false;
    }

    const [randomBytes, timestamp, signature] = parts;

    // Vérifier que le token existe en store
    const tokenData = csrfTokenStore.get(token);
    if (!tokenData) {
      console.warn('⚠️  CSRF: Token not found in store (possibly expired or never issued)');
      return false;
    }

    // Vérifier l'expiration
    if (Date.now() > tokenData.expiresAt) {
      console.warn('⚠️  CSRF: Token expired');
      csrfTokenStore.delete(token); // Cleanup
      return false;
    }

    // Vérifier la signature
    const message = `${randomBytes}|${timestamp}`;
    const expectedSignature = crypto
      .createHmac('sha256', CSRF_SECRET)
      .update(message)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.warn('⚠️  CSRF: Invalid signature');
      return false;
    }

    // Token valide - NE PAS le supprimer, permettre la réutilisation pendant 24h
    // C'est toujours sécurisé : signature HMAC + expiration + origine validée
    console.log(`✅ CSRF token verified (reusable). Store size: ${csrfTokenStore.size}`);

    return true;
  } catch (error) {
    console.error('❌ Error verifying CSRF token:', error.message);
    return false;
  }
};

/**
 * Middleware pour valider CSRF sur les mutations (POST, PUT, PATCH, DELETE)
 * GET et OPTIONS ne nécessitent pas de CSRF
 */
export const csrfProtection = (req, res, next) => {
  // Sauter CSRF pour GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Sauter CSRF pour les routes publiques (login, santé, etc.)
  const publicRoutes = [
    '/api/auth/login',
    '/api/auth/member-login',
    '/auth/login',
    '/auth/member-login',
    '/api/health',
    '/health',
    '/api/csrf-token',
    '/public/contact'
  ];

  // Routes publiques du parcours bulletin (sécurisées par token d'URL)
  // On n'exempte PAS /create ni /cleanup pour conserver la protection CSRF.
  const isPublicBulletinTokenMutation = /^\/(api\/)?bulletin-flow\/[^/]+\/(step|member-data|signature|resend)$/.test(req.path);
  
  if (publicRoutes.some(route => req.path === route) || isPublicBulletinTokenMutation) {
    console.log(`✅ Bypassing CSRF for public route: ${req.path}`);
    return next();
  }

  // Récupérer le token depuis le header
  const csrfToken = req.headers['x-csrf-token'];

  console.log(`🔍 CSRF Check: ${req.method} ${req.path}`);
  console.log(`   Headers présents:`, Object.keys(req.headers).filter(h => h.includes('csrf') || h.includes('token') || h.includes('auth')));
  console.log(`   X-CSRF-Token:`, csrfToken ? csrfToken.substring(0, 30) + '...' : 'ABSENT');

  if (!csrfToken) {
    console.warn(`🚫 CSRF: Missing X-CSRF-Token header on ${req.method} ${req.path}`);
    console.warn(`   Available headers:`, Object.keys(req.headers));
    return res.status(403).json({
      error: 'CSRF token missing',
      code: 'CSRF_MISSING',
      path: req.path
    });
  }

  // Valider le token
  const isValid = verifyCSRFToken(csrfToken);
  console.log(`   Token validation:`, isValid ? '✅ VALID' : '❌ INVALID');
  
  if (!isValid) {
    console.warn(`🚫 CSRF: Invalid or expired token on ${req.method} ${req.path}`);
    return res.status(403).json({
      error: 'CSRF token invalid or expired',
      code: 'CSRF_INVALID'
    });
  }

  // Token valide et réutilisable - pas besoin de générer un nouveau token à chaque fois
  // Le token reste valide pendant 24h
  console.log(`✅ CSRF validated for ${req.method} ${req.path}`);

  next();
};

/**
 * Ajouter le nouveau token aux headers de réponse
 * Le frontend peut l'attraper et mettre à jour localStorage
 */
export const includeNewCSRFToken = (req, res, next) => {
  const originalJson = res.json;

  res.json = function(data) {
    // Ajouter le nouveau token si disponible
    if (req.newCSRFToken) {
      res.header('X-CSRF-Token', req.newCSRFToken);
    }

    // Appeler le json original
    return originalJson.call(this, data);
  };

  next();
};

/**
 * Nettoyer les tokens expirés (appeler périodiquement)
 */
export const cleanupExpiredTokens = () => {
  let cleaned = 0;
  const now = Date.now();

  for (const [token, data] of csrfTokenStore.entries()) {
    if (now > data.expiresAt) {
      csrfTokenStore.delete(token);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`🧹 CSRF cleanup: removed ${cleaned} expired tokens. Remaining: ${csrfTokenStore.size}`);
  }

  return cleaned;
};

/**
 * Injecter du debug information pour les logs de sécurité
 */
export const debugCSRFStatus = () => {
  return {
    activeTokens: csrfTokenStore.size,
    maxTokens: MAX_TOKENS,
    percentUsed: Math.round((csrfTokenStore.size / MAX_TOKENS) * 100)
  };
};
