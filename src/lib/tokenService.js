/**
 * Token Service - Gestion de JWT avec expiration
 * Remplace le système "stub." simple par un vraie token JWT sécurisé
 */

import crypto from 'crypto';

const TOKEN_SECRET = process.env.TOKEN_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_EXPIRATION = '1h'; // 1 heure
const REFRESH_TOKEN_EXPIRATION = '7d'; // 7 jours

/**
 * Crée un JWT simple sans dépendance externe (utilise base64 + signature HMAC)
 * Format: header.payload.signature
 * 
 * @param {Object} payload - Données à encoder (ex: {email, userId, role})
 * @param {String} expiresIn - Durée de validité (ex: '1h', '7d')
 * @returns {String} Token JWT
 */
export const createToken = (payload, expiresIn = TOKEN_EXPIRATION) => {
  try {
    // Header JWT
    const header = {
      alg: 'HS256',
      typ: 'JWT'
    };

    // Ajouter l'expiration au payload
    const iat = Math.floor(Date.now() / 1000); // now in seconds
    const exp = iat + parseExpirationToSeconds(expiresIn);
    
    const tokenPayload = {
      ...payload,
      iat, // issued at
      exp  // expiration time
    };

    // Encoder en base64
    const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const payloadB64 = Buffer.from(JSON.stringify(tokenPayload)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    // Signer avec HMAC-SHA256
    const message = `${headerB64}.${payloadB64}`;
    const signature = crypto
      .createHmac('sha256', TOKEN_SECRET)
      .update(message)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    return `${message}.${signature}`;
  } catch (error) {
    console.error('❌ Error creating token:', error.message);
    throw new Error('Token creation failed');
  }
};

/**
 * Vérifie et décode un JWT
 * 
 * @param {String} token - Token JWT à vérifier
 * @returns {Object|null} Payload si valide, null si expiré ou invalide
 */
export const verifyToken = (token) => {
  try {
    if (!token) return null;

    const parts = token.split('.');
    if (parts.length !== 3) {
      console.warn('⚠️ Invalid token format');
      return null;
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    // Vérifier la signature
    const message = `${headerB64}.${payloadB64}`;
    const expectedSignature = crypto
      .createHmac('sha256', TOKEN_SECRET)
      .update(message)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    if (signatureB64 !== expectedSignature) {
      console.warn('⚠️ Invalid token signature');
      return null;
    }

    // Décoder le payload
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString());

    // Vérifier l'expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      console.warn(`⚠️ Token expired (exp: ${payload.exp}, now: ${now})`);
      return null;
    }

    return payload;
  } catch (error) {
    console.error('❌ Error verifying token:', error.message);
    return null;
  }
};

/**
 * Crée un token de refresh (valide 7 jours)
 * Utilisé pour obtenir un nouveau token d'accès sans se reconnecter
 * 
 * @param {Object} payload - Données utilisateur
 * @returns {String} Refresh token
 */
export const createRefreshToken = (payload) => {
  return createToken(payload, REFRESH_TOKEN_EXPIRATION);
};

/**
 * Convertit une expiration en secondes
 * Supporte: '1h', '7d', '30m', etc.
 * 
 * @param {String} expiresIn - Durée (ex: '1h')
 * @returns {Number} Secondes
 */
const parseExpirationToSeconds = (expiresIn) => {
  const units = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400
  };

  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) return 3600; // Default 1h

  const [, value, unit] = match;
  return parseInt(value) * (units[unit] || 1);
};

/**
 * Crée une paire de tokens (access + refresh)
 * 
 * @param {Object} payload - Données utilisateur
 * @returns {Object} {accessToken, refreshToken, expiresIn}
 */
export const createTokenPair = (payload) => {
  const accessToken = createToken(payload, TOKEN_EXPIRATION);
  const refreshToken = createRefreshToken(payload);

  return {
    accessToken,
    refreshToken,
    expiresIn: '1h',
    tokenType: 'Bearer'
  };
};

export default {
  createToken,
  verifyToken,
  createRefreshToken,
  createTokenPair,
  TOKEN_EXPIRATION,
  REFRESH_TOKEN_EXPIRATION,
  TOKEN_SECRET
};
