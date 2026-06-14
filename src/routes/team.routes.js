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
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as teamController from '../controllers/teamController.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '../../uploads/team-avatars');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.params.id}-${Date.now()}${ext}`);
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non autorisé'));
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

/**
 * Middleware de gestion des erreurs Multer
 */
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error('❌ Erreur Multer:', err.code, err.message);
    
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: 'Fichier trop volumineux', 
        details: 'La taille maximale est de 5 MB' 
      });
    }
    
    return res.status(400).json({ 
      error: 'Erreur lors de l\'upload', 
      details: err.message 
    });
  }
  
  if (err) {
    console.error('❌ Erreur upload:', err.message);
    return res.status(400).json({ 
      error: 'Erreur lors de l\'upload', 
      details: err.message 
    });
  }
  
  next();
};

// Routes publiques (lecture seule)
router.get('/', teamController.getAllTeamMembers); // Accepte ?public=true
router.get('/:id', teamController.getTeamMemberById);

// Routes protégées (ADMIN uniquement)
router.post('/:id/upload-avatar', 
  requireAuth, 
  requireAdmin, 
  (req, res, next) => {
    avatarUpload.single('avatar')(req, res, (err) => {
      if (err) {
        return handleMulterError(err, req, res, next);
      }
      next();
    });
  },
  teamController.uploadTeamAvatar
); // Avant /:id pour éviter conflit
router.post('/', requireAuth, requireAdmin, teamController.createTeamMember);
router.put('/:id', requireAuth, requireAdmin, teamController.updateTeamMember);
router.delete('/:id', requireAuth, requireAdmin, teamController.deleteTeamMember);
router.post('/reorder', requireAuth, requireAdmin, teamController.reorderTeamMembers);

export default router;
