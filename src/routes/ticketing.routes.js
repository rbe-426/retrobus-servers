/**
 * Ticketing Routes - Routes de gestion de la billetterie du musée
 * Usage: app.use('/api/ticketing', ticketingRoutes);
 * 
 * Endpoints:
 * GET    /api/ticketing/stats              - Statistiques globales
 * GET    /api/ticketing/types              - Liste des types de tarifs
 * POST   /api/ticketing/types              - Créer un type de tarif
 * PUT    /api/ticketing/types/:id          - Mettre à jour un type
 * DELETE /api/ticketing/types/:id          - Supprimer un type
 * GET    /api/ticketing/sales              - Liste des ventes
 * POST   /api/ticketing/sales              - Créer une vente
 * GET    /api/ticketing/attendance         - Statistiques de fréquentation
 * GET    /api/ticketing/group-reservations - Réservations de groupe
 * POST   /api/ticketing/group-reservations - Créer une réservation de groupe
 * PUT    /api/ticketing/group-reservations/:id - Mettre à jour une réservation
 * GET    /api/ticketing/stats/weekly       - Stats hebdomadaires
 * GET    /api/ticketing/stats/monthly      - Stats mensuelles
 * GET    /api/ticketing/discounts          - Liste des réductions
 * POST   /api/ticketing/discounts          - Créer une réduction
 * PUT    /api/ticketing/discounts/:id      - Mettre à jour une réduction
 * DELETE /api/ticketing/discounts/:id      - Supprimer une réduction
 */

import express from 'express';
import * as ticketingController from '../controllers/ticketingController.js';

const router = express.Router();

// Stats
router.get('/stats', ticketingController.getStats);
router.get('/stats/weekly', ticketingController.getWeeklyStats);
router.get('/stats/monthly', ticketingController.getMonthlyStats);

// Types de tarifs
router.get('/types', ticketingController.getTicketTypes);
router.post('/types', ticketingController.createTicketType);
router.put('/types/:id', ticketingController.updateTicketType);
router.delete('/types/:id', ticketingController.deleteTicketType);

// Ventes
router.get('/sales', ticketingController.getSales);
router.post('/sales', ticketingController.createSale);

// Fréquentation
router.get('/attendance', ticketingController.getAttendance);

// Réservations de groupe
router.get('/group-reservations', ticketingController.getGroupReservations);
router.post('/group-reservations', ticketingController.createGroupReservation);
router.put('/group-reservations/:id', ticketingController.updateGroupReservation);

// Réductions
router.get('/discounts', ticketingController.getDiscounts);
router.get('/discounts/:id', ticketingController.getDiscount);
router.post('/discounts', ticketingController.createDiscount);
router.put('/discounts/:id', ticketingController.updateDiscount);
router.delete('/discounts/:id', ticketingController.deleteDiscount);

export default router;
