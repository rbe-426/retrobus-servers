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
import { authLimiter } from '../security.js';

const router = express.Router();

// Admin endpoints - Gestion complète des notifications
router.get('/', authLimiter, notificationsController.getAllNotifications);
router.post('/', authLimiter, notificationsController.createNotification);
router.put('/:id', authLimiter, notificationsController.updateNotification);
router.delete('/:id', authLimiter, notificationsController.deleteNotification);

// User endpoint - Récupérer les notifications pour l'utilisateur courant
router.get('/inbox', authLimiter, notificationsController.getUserNotifications);

// Mark as read endpoint
router.put('/:id/read', authLimiter, notificationsController.markAsRead);

export default router;
