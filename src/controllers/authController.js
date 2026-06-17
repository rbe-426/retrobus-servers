/**
 * Auth Controller - Logique des endpoints d'authentification
 * Traite les requêtes de login, refresh token, etc.
 */

import { createTokenPair, verifyToken } from '../lib/tokenService.js';
import { sanitizeInput, auditLog } from '../security.js';
import { authenticateUser, updateLastLogin, getUserRole } from '../services/userService.js';

/**
 * POST /api/auth/login
 * Endpoint de login simple avec email et password
 */
export const loginUser = async (req, res) => {
  try {
    const email = sanitizeInput(req.body?.email || '').toLowerCase().trim();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      return res.status(400).json({ error: 'Email & password requis' });
    }

    // Authentifier l'utilisateur
    const member = await authenticateUser(email, password);
    if (!member) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    // Mettre à jour le dernier login
    await updateLastLogin(member.id);

    // Récupérer le rôle
    let role = member.role || 'MEMBER';
    // TODO: Chercher dans site_users pour le rôle depuis là si nécessaire

    // Créer les tokens JWT
    const { accessToken, refreshToken } = createTokenPair({
      userId: member.id,
      email: email,
      role: role,
      permissions: member.permissions || []
    });

    auditLog('LOGIN_SUCCESS', email, { role, hasPermissions: !!member.permissions }, 'success');

    res.json({
      token: accessToken,  // Backward-compatibility
      accessToken,
      refreshToken,
      expiresIn: '1h',
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
};

/**
 * POST /api/auth/member-login
 * Endpoint de login pour membres avec matricule/email/identifiant
 */
export const loginMember = async (req, res) => {
  try {
    const identifier = sanitizeInput(req.body?.identifier || '').toLowerCase().trim();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!identifier || !password) {
      auditLog('MEMBER_LOGIN_MISSING_FIELDS', identifier, { identifier: !!identifier, password: !!password }, 'failed');
      return res.status(400).json({ error: 'identifier & password requis' });
    }

    // Authentifier l'utilisateur
    const member = await authenticateUser(identifier, password);
    if (!member) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    // Mettre à jour le dernier login
    await updateLastLogin(member.id);

    // Récupérer le rôle
    let role = member.role || 'MEMBER';

    // Vérifier si mot de passe doit être changé
    const mustChangePassword = member.mustChangePassword === true || member.isPasswordTemporary === true;

    // Créer les tokens JWT
    const { accessToken, refreshToken } = createTokenPair({
      userId: member.id,
      email: member.email || identifier,
      role: role,
      permissions: member.permissions || []
    });

    auditLog('MEMBER_LOGIN_SUCCESS', identifier, { role, hasPermissions: !!member.permissions }, 'success');

    res.json({
      token: accessToken,  // Backward-compatibility
      accessToken,
      refreshToken,
      expiresIn: '1h',
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
  } catch (error) {
    console.error('❌ Member login error:', error.message);
    auditLog('MEMBER_LOGIN_EXCEPTION', req.body?.identifier, { error: error.message }, 'failed');
    res.status(500).json({ error: 'Login failed', details: error.message });
  }
};

/**
 * POST /api/auth/refresh-token
 * Endpoint pour renouveler les tokens
 */
export const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'refreshToken requis' });
    }

    // Vérifier le refresh token
    const decoded = verifyToken(token);
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
};

/**
 * GET /api/auth/me
 * Endpoint pour obtenir les infos de l'utilisateur courant
 */
export const getCurrentUser = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
        permissions: req.user.permissions || []
      }
    });
  } catch (error) {
    console.error('❌ Error getting current user:', error.message);
    res.status(500).json({ error: 'Error getting user info' });
  }
};

export default {
  loginUser,
  loginMember,
  refreshToken,
  getCurrentUser
};
