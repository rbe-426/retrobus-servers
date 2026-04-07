/**
 * Auth Routes - Routes d'authentification
 * Usage: app.use('/api/auth', authRoutes);
 * 
 * Endpoints:
 * POST /api/auth/login
 * POST /api/auth/member-login
 * POST /api/auth/refresh-token
 * GET /api/auth/me
 */

import express from 'express';
import { authLimiter } from '../security.js';
import * as authController from '../controllers/authController.js';

const router = express.Router();

// Login simples (avec protection rate limit)
router.post('/login', authLimiter, authController.loginUser);

// Login membre (avec identification flexible: matricule, email, etc)
router.post('/member-login', authLimiter, authController.loginMember);

// Refresh token
router.post('/refresh-token', authController.refreshToken);

// Obtenir l'utilisateur courant
router.get('/me', (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
}, authController.getCurrentUser);

export default router;
