import { Router } from 'express';
import {
  getAllChangelogs,
  getChangelogById,
  createChangelog,
  updateChangelog,
  deleteChangelog,
  getChangelogStats
} from '../controllers/changelogController.js';

const router = Router();

// GET /api/changelog - Liste tous les changelogs (ordre chronologique inverse)
router.get('/', getAllChangelogs);

// GET /api/changelog/stats - Statistiques des changelogs
router.get('/stats', getChangelogStats);

// GET /api/changelog/:id - Récupère un changelog spécifique
router.get('/:id', getChangelogById);

// POST /api/changelog - Crée un nouveau changelog (admin seulement)
router.post('/', createChangelog);

// PUT /api/changelog/:id - Met à jour un changelog (admin seulement)
router.put('/:id', updateChangelog);

// DELETE /api/changelog/:id - Supprime un changelog (admin seulement)
router.delete('/:id', deleteChangelog);

export default router;
