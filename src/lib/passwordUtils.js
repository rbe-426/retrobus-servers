/**
 * Utilitaires de gestion des mots de passe
 * - Générateur de mots de passe forts
 * - Hachage et vérification
 */

import crypto from 'crypto';

/**
 * Génère un mot de passe temporaire fort
 * Format: 2 majuscules + 4 chiffres + 2 caractères spéciaux
 * Exemple: Xr5#8@Kq
 */
export function generateTemporaryPassword() {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  const special = '!@#$%^&*_+-=';

  let password = '';

  // 2 majuscules aléatoires
  for (let i = 0; i < 2; i++) {
    password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
  }

  // 4 chiffres aléatoires
  for (let i = 0; i < 4; i++) {
    password += digits.charAt(Math.floor(Math.random() * digits.length));
  }

  // 2 caractères spéciaux aléatoires
  for (let i = 0; i < 2; i++) {
    password += special.charAt(Math.floor(Math.random() * special.length));
  }

  // Mélanger les caractères pour plus de sécurité
  const array = password.split('');
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }

  return array.join('');
}

/**
 * Hache un mot de passe avec crypto (Node.js natif)
 * Utilise PBKDF2 pour être résistant au brute-force
 */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const iterations = 100000;
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512');
  
  return {
    hash: hash.toString('hex'),
    salt: salt,
    iterations: iterations
  };
}

/**
 * Vérifie un mot de passe contre un hash stocké
 */
export function verifyPassword(password, storedHash) {
  try {
    // Les stored hash devraient être au format: "hash:salt:iterations"
    const [hashHex, salt, iterationsStr] = storedHash.split(':');
    
    if (!hashHex || !salt || !iterationsStr) {
      console.warn('Format de hash invalide');
      return false;
    }

    const iterations = parseInt(iterationsStr, 10);
    const computedHash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512');
    
    return computedHash.toString('hex') === hashHex;
  } catch (error) {
    console.error('Erreur lors de la vérification du mot de passe:', error);
    return false;
  }
}

/**
 * Hash storage format: "hash:salt:iterations"
 */
export function formatHashForStorage(hashObj) {
  return `${hashObj.hash}:${hashObj.salt}:${hashObj.iterations}`;
}

/**
 * Crée un hash complètement formaté et storable
 */
export function hashPasswordForStorage(password) {
  const hashObj = hashPassword(password);
  return formatHashForStorage(hashObj);
}

/**
 * Valide la force du mot de passe
 * - Au minimum 8 caractères
 * - Au moins 1 majuscule
 * - Au moins 1 minuscule
 * - Au moins 1 chiffre
 * - Au moins 1 caractère spécial
 */
export function validatePasswordStrength(password) {
  const errors = [];

  if (password.length < 8) {
    errors.push('Au minimum 8 caractères');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Au moins 1 majuscule');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Au moins 1 minuscule');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Au moins 1 chiffre');
  }

  if (!/[!@#$%^&*_+\-=]/.test(password)) {
    errors.push('Au moins 1 caractère spécial (!@#$%^&*_+-=)');
  }

  return {
    isValid: errors.length === 0,
    errors: errors
  };
}
