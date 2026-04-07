/**
 * Notifications Routes
 * API endpoints pour la gestion des notifications système
 * 
 * Endpoints:
 * GET    /api/notifications          - Récupérer toutes les notifications
 * POST   /api/notifications          - Créer une notification
 * PUT    /api/notifications/:id      - Mettre à jour une notification
 * DELETE /api/notifications/:id      - Supprimer une notification
 * GET    /api/notifications/inbox    - Récupérer les notifications pour l'utilisateur
 */

import express from 'express';
import * as notificationsController from '../controllers/notificationsController.js';
import { generalLimiter } from '../security.js';

const router = express.Router();

// Admin endpoints - Gestion complète des notifications
// GET toutes les notifications (avec rate limiting doux)
router.get('/', generalLimiter, notificationsController.getAllNotifications);

// POST créer une notification (avec rate limiting doux)
router.post('/', generalLimiter, notificationsController.createNotification);

// PUT mettre à jour une notification (avec rate limiting doux)
router.put('/:id', generalLimiter, notificationsController.updateNotification);

// DELETE supprimer une notification (avec rate limiting doux)
router.delete('/:id', generalLimiter, notificationsController.deleteNotification);

// User endpoint - Récupérer les notifications pour l'utilisateur courant (avec rate limiting doux)
router.get('/inbox', generalLimiter, notificationsController.getUserNotifications);

// Mark as read endpoint (avec rate limiting doux)
router.put('/:id/read', generalLimiter, notificationsController.markAsRead);

export default router;
