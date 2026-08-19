/**
 * Events Routes - Routes de gestion des événements
 * Usage: app.use('/api/events', eventsRoutes);
 * 
 * Endpoints:
 * GET    /api/events                               - Liste tous les événements
 * GET    /api/events/:id                           - Récupère un événement par ID
 * POST   /api/events                               - Crée un nouvel événement
 * PUT    /api/events/:id                           - Met à jour un événement
 * DELETE /api/events/:id                           - Supprime un événement
 * GET    /api/events/:id/participants              - Liste les participants d'un événement
 * POST   /api/events/:id/participants              - Ajoute un participant à un événement
 * PUT    /api/events/:id/participants/:participantId - Met à jour un participant
 * DELETE /api/events/:id/participants/:participantId - Supprime un participant
 */

import express from 'express';
import * as eventsController from '../controllers/eventsController.js';

const router = express.Router();

// Routes pour les événements
router.get('/', eventsController.getAllEvents);
router.get('/:id', eventsController.getEventById);
router.post('/', eventsController.createEvent);
router.put('/:id', eventsController.updateEvent);
router.delete('/:id', eventsController.deleteEvent);

// Routes pour les participants
router.get('/:id/participants', eventsController.getEventParticipants);
router.post('/:id/participants', eventsController.addEventParticipant);
router.put('/:id/participants/:participantId', eventsController.updateEventParticipant);
router.delete('/:id/participants/:participantId', eventsController.deleteEventParticipant);

export default router;
