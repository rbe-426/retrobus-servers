/**
 * Team Routes - Routes de gestion de l'équipe
 * Usage: app.use('/api/team', teamRoutes);
 * 
 * Endpoints:
 * GET    /api/team              - Liste tous les membres (query ?public=true pour masquer les contacts)
 * GET    /api/team/:id          - Récupère un membre par ID
 * POST   /api/team              - Crée un nouveau membre (ADMIN uniquement)
 * PUT    /api/team/:id          - Met à jour un membre (ADMIN uniquement)
 * DELETE /api/team/:id          - Désactive un membre (ADMIN uniquement)
 * POST   /api/team/reorder      - Réordonne les membres (ADMIN uniquement)
 */

import express from 'express';
import * as teamController from '../controllers/teamController.js';

const router = express.Router();

// Routes publiques (lecture seule)
router.get('/', teamController.getAllTeamMembers); // Accepte ?public=true
router.get('/:id', teamController.getTeamMemberById);

// Routes protégées (ADMIN uniquement) - À ajouter middleware auth si nécessaire
router.post('/', teamController.createTeamMember);
router.put('/:id', teamController.updateTeamMember);
router.delete('/:id', teamController.deleteTeamMember);
router.post('/reorder', teamController.reorderTeamMembers);

export default router;
