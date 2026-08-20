import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const router = express.Router();

// Secret JWT spécifique pour Le Musée (différent du système principal)
const MUSEE_JWT_SECRET = process.env.MUSEE_JWT_SECRET || 'musee-secret-key-change-in-production-' + Date.now();

// Base de données temporaire en mémoire pour les utilisateurs du Musée
// TODO: Migrer vers Prisma avec une table dédiée
const museeUsers = [
  {
    id: 'musee-1',
    username: 'admin.musee',
    // Mot de passe: MuseeRBE2026! (à changer en production)
    passwordHash: '$2b$10$MOcE02Ughy7qaW4/D5Pd6eOf.nqJ.1dY900LzWNEXoOVLLgP9yLzK',
    role: 'admin',
    createdAt: new Date()
  }
];

// Log d'audit pour les connexions au Musée
const museeAuditLogs = [];

// Base de données temporaire pour les check-ins du Musée
// TODO: Migrer vers Prisma avec une table dédiée
const museeCheckIns = [];

function logMuseeAccess(username, action, success, ip, details = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    username,
    action,
    success,
    ip,
    ...details
  };
  
  museeAuditLogs.push(logEntry);
  
  // Garder seulement les 1000 derniers logs en mémoire
  if (museeAuditLogs.length > 1000) {
    museeAuditLogs.shift();
  }
  
  // Log serveur pour traçabilité
  console.log(`[MUSÉE] ${action} - ${username} - ${success ? 'SUCCESS' : 'FAILURE'} - IP: ${ip}`);
}

/**
 * POST /api/musee/login
 * Authentification spécifique pour Le Musée
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const clientIp = req.ip || req.connection.remoteAddress;

  if (!username || !password) {
    logMuseeAccess(username || 'unknown', 'LOGIN_ATTEMPT', false, clientIp, { reason: 'missing_credentials' });
    return res.status(400).json({ error: 'Identifiants requis' });
  }

  // Rechercher l'utilisateur
  const user = museeUsers.find(u => u.username === username);
  
  if (!user) {
    logMuseeAccess(username, 'LOGIN_ATTEMPT', false, clientIp, { reason: 'user_not_found' });
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }

  // Vérifier le mot de passe
  try {
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    
    if (!validPassword) {
      logMuseeAccess(username, 'LOGIN_ATTEMPT', false, clientIp, { reason: 'invalid_password' });
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    // Générer le token JWT
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        type: 'musee'
      },
      MUSEE_JWT_SECRET,
      { expiresIn: '8h' }
    );

    logMuseeAccess(username, 'LOGIN', true, clientIp);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Erreur authentification musée:', error);
    logMuseeAccess(username, 'LOGIN_ERROR', false, clientIp, { error: error.message });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/musee/verify
 * Vérifier la validité d'un token musée
 */
router.get('/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  const clientIp = req.ip || req.connection.remoteAddress;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, MUSEE_JWT_SECRET);
    
    if (decoded.type !== 'musee') {
      logMuseeAccess(decoded.username, 'VERIFY_TOKEN', false, clientIp, { reason: 'invalid_token_type' });
      return res.status(401).json({ error: 'Token invalide' });
    }

    logMuseeAccess(decoded.username, 'VERIFY_TOKEN', true, clientIp);
    res.json({ valid: true, user: decoded });
  } catch (error) {
    logMuseeAccess('unknown', 'VERIFY_TOKEN', false, clientIp, { reason: error.message });
    res.status(401).json({ error: 'Token invalide ou expiré' });
  }
});

/**
 * GET /api/musee/audit-logs
 * Récupérer les logs d'audit (admin uniquement)
 */
router.get('/audit-logs', (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, MUSEE_JWT_SECRET);
    
    if (decoded.type !== 'musee' || decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    res.json({ logs: museeAuditLogs });
  } catch (error) {
    res.status(401).json({ error: 'Token invalide' });
  }
});

/**
 * POST /api/musee/change-password
 * Changer le mot de passe d'un utilisateur musée
 */
router.post('/change-password', async (req, res) => {
  const authHeader = req.headers.authorization;
  const { currentPassword, newPassword } = req.body;
  const clientIp = req.ip || req.connection.remoteAddress;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, MUSEE_JWT_SECRET);
    const user = museeUsers.find(u => u.id === decoded.id);

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    // Vérifier le mot de passe actuel
    const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    
    if (!validPassword) {
      logMuseeAccess(decoded.username, 'CHANGE_PASSWORD', false, clientIp, { reason: 'invalid_current_password' });
      return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
    }

    // Hasher le nouveau mot de passe
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = newPasswordHash;

    logMuseeAccess(decoded.username, 'CHANGE_PASSWORD', true, clientIp);
    res.json({ message: 'Mot de passe modifié avec succès' });
  } catch (error) {
    console.error('Erreur changement mot de passe musée:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/musee/check-in
 * Enregistrer un check-in au Musée
 */
router.post('/check-in', (req, res) => {
  const authHeader = req.headers.authorization;
  const clientIp = req.ip || req.connection.remoteAddress;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, MUSEE_JWT_SECRET);
    
    if (decoded.type !== 'musee') {
      return res.status(401).json({ error: 'Token invalide' });
    }

    const checkIn = {
      id: `checkin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId: decoded.id,
      username: decoded.username,
      timestamp: new Date().toISOString(),
      ip: clientIp
    };

    museeCheckIns.unshift(checkIn); // Ajouter au début pour avoir les plus récents en premier

    // Garder seulement les 500 derniers check-ins en mémoire
    if (museeCheckIns.length > 500) {
      museeCheckIns.pop();
    }

    logMuseeAccess(decoded.username, 'CHECK_IN', true, clientIp);
    
    res.json({ 
      message: 'Check-in enregistré avec succès',
      checkIn: {
        timestamp: checkIn.timestamp,
        username: checkIn.username
      }
    });
  } catch (error) {
    console.error('Erreur check-in musée:', error);
    logMuseeAccess('unknown', 'CHECK_IN', false, clientIp, { reason: error.message });
    res.status(401).json({ error: 'Token invalide ou expiré' });
  }
});

/**
 * GET /api/musee/check-ins
 * Récupérer l'historique des check-ins
 */
router.get('/check-ins', (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, MUSEE_JWT_SECRET);
    
    if (decoded.type !== 'musee') {
      return res.status(401).json({ error: 'Token invalide' });
    }

    // Filtrer les check-ins de l'utilisateur connecté (ou tous si admin)
    const userCheckIns = decoded.role === 'admin' 
      ? museeCheckIns 
      : museeCheckIns.filter(ci => ci.userId === decoded.id);

    res.json({ 
      checkIns: userCheckIns.map(ci => ({
        timestamp: ci.timestamp,
        username: ci.username
      }))
    });
  } catch (error) {
    res.status(401).json({ error: 'Token invalide' });
  }
});

/**
 * GET /api/musee/stats
 * Récupérer les statistiques de check-in
 */
router.get('/stats', (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, MUSEE_JWT_SECRET);
    
    if (decoded.type !== 'musee') {
      return res.status(401).json({ error: 'Token invalide' });
    }

    // Filtrer les check-ins de l'utilisateur (ou tous si admin)
    const userCheckIns = decoded.role === 'admin' 
      ? museeCheckIns 
      : museeCheckIns.filter(ci => ci.userId === decoded.id);

    const now = new Date();
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - now.getDay()); // Début de la semaine (dimanche)
    thisWeekStart.setHours(0, 0, 0, 0);

    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const stats = {
      totalCheckIns: userCheckIns.length,
      thisWeek: userCheckIns.filter(ci => new Date(ci.timestamp) >= thisWeekStart).length,
      thisMonth: userCheckIns.filter(ci => new Date(ci.timestamp) >= thisMonthStart).length,
      lastCheckIn: userCheckIns[0]?.timestamp || null
    };

    res.json(stats);
  } catch (error) {
    res.status(401).json({ error: 'Token invalide' });
  }
});

export default router;
