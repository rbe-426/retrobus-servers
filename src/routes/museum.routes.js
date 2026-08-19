/**
 * Museum Routes - Routes de gestion du musée
 * Usage: app.use('/api/museum', museumRoutes);
 * 
 * Endpoints:
 * GET    /api/museum/stats                 - Statistiques globales du musée
 * GET    /api/museum/modules               - Liste des modules disponibles
 * GET    /api/museum/modules/:id           - Détails d'un module
 * 
 * Pour chaque module (collections, exhibitions, conservation, loans, mediation, documentation, sponsorship, events):
 * GET    /api/museum/:module               - Liste
 * GET    /api/museum/:module/:id           - Détails
 * POST   /api/museum/:module               - Créer
 * PUT    /api/museum/:module/:id           - Mettre à jour
 * DELETE /api/museum/:module/:id           - Supprimer
 * GET    /api/museum/:module/stats         - Stats du module
 */

import express from 'express';
import * as museumController from '../controllers/museumController.js';

const router = express.Router();

// Stats et modules
router.get('/stats', museumController.getStats);
router.get('/modules', museumController.getModules);
router.get('/modules/:id', museumController.getModule);

// Collections
router.get('/collections', museumController.getCollections);
router.get('/collections/:id', museumController.getCollection);
router.post('/collections', museumController.createCollection);
router.put('/collections/:id', museumController.updateCollection);
router.delete('/collections/:id', museumController.deleteCollection);
router.get('/collections/stats', museumController.getCollectionsStats);

// Expositions
router.get('/exhibitions', museumController.getExhibitions);
router.get('/exhibitions/:id', museumController.getExhibition);
router.post('/exhibitions', museumController.createExhibition);
router.put('/exhibitions/:id', museumController.updateExhibition);
router.delete('/exhibitions/:id', museumController.deleteExhibition);
router.get('/exhibitions/stats', museumController.getExhibitionsStats);

// Conservation
router.get('/conservation', museumController.getConservationItems);
router.get('/conservation/:id', museumController.getConservationItem);
router.post('/conservation', museumController.createConservationItem);
router.put('/conservation/:id', museumController.updateConservationItem);
router.delete('/conservation/:id', museumController.deleteConservationItem);
router.get('/conservation/stats', museumController.getConservationStats);

// Prêts
router.get('/loans', museumController.getLoans);
router.get('/loans/:id', museumController.getLoan);
router.post('/loans', museumController.createLoan);
router.put('/loans/:id', museumController.updateLoan);
router.delete('/loans/:id', museumController.deleteLoan);
router.get('/loans/stats', museumController.getLoansStats);

// Médiation culturelle
router.get('/mediation', museumController.getMediationItems);
router.get('/mediation/:id', museumController.getMediationItem);
router.post('/mediation', museumController.createMediationItem);
router.put('/mediation/:id', museumController.updateMediationItem);
router.delete('/mediation/:id', museumController.deleteMediationItem);
router.get('/mediation/stats', museumController.getMediationStats);

// Documentation
router.get('/documentation', museumController.getDocumentation);
router.get('/documentation/:id', museumController.getDocumentationItem);
router.post('/documentation', museumController.createDocumentationItem);
router.put('/documentation/:id', museumController.updateDocumentationItem);
router.delete('/documentation/:id', museumController.deleteDocumentationItem);
router.get('/documentation/stats', museumController.getDocumentationStats);

// Mécénat
router.get('/sponsorship', museumController.getSponsorships);
router.get('/sponsorship/:id', museumController.getSponsorship);
router.post('/sponsorship', museumController.createSponsorship);
router.put('/sponsorship/:id', museumController.updateSponsorship);
router.delete('/sponsorship/:id', museumController.deleteSponsorship);
router.get('/sponsorship/stats', museumController.getSponsorshipStats);

// Événements musée
router.get('/events', museumController.getMuseumEvents);
router.get('/events/:id', museumController.getMuseumEvent);
router.post('/events', museumController.createMuseumEvent);
router.put('/events/:id', museumController.updateMuseumEvent);
router.delete('/events/:id', museumController.deleteMuseumEvent);
router.get('/events/stats', museumController.getMuseumEventsStats);

export default router;
