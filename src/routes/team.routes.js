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
 * POST   /api/team/:id/upload-avatar - Upload photo de profil (ADMIN uniquement)
 */

import express from 'express';
import multer from 'multer';
import * as teamController from '../controllers/teamController.js';

const router = express.Router();

// Configuration multer pour upload d'avatars
const avatarUpload = multer({
  dest: 'uploads/temp/',
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non autorisé. Utilisez JPG, PNG ou WebP.'));
    }
  }
});

/**
 * Middleware d'authentification
 */
const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  next();
};

/**
 * Middleware pour vérifier les droits admin
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Non authentifié' });
  }

  const role = req.user.role?.toUpperCase();
  const adminRoles = ['ADMIN', 'PRESIDENT', 'VICE_PRESIDENT', 'TRESORIER', 'SECRETAIRE_GENERAL'];
  
  if (!adminRoles.includes(role)) {
    return res.status(403).json({ error: 'Accès refusé - Droits administrateur requis' });
  }

  next();
};

// Routes publiques (lecture seule)
router.get('/', teamController.getAllTeamMembers); // Accepte ?public=true
router.get('/:id', teamController.getTeamMemberById);

// Routes protégées (ADMIN uniquement)
router.post('/', requireAuth, requireAdmin, teamController.createTeamMember);
router.put('/:id', requireAuth, requireAdmin, teamController.updateTeamMember);
router.delete('/:id', requireAuth, requireAdmin, teamController.deleteTeamMember);
router.post('/reorder', requireAuth, requireAdmin, teamController.reorderTeamMembers);
router.post('/:id/upload-avatar', requireAuth, requireAdmin, avatarUpload.single('avatar'), teamController.uploadTeamAvatar);

export default router;
