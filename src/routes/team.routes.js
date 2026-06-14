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

// Créer le dossier temp pour multer s'il n'existe pas
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tempDir = path.join(__dirname, '../../uploads/temp');

if (!fs.existsSync(tempDir)) {
  console.log('📁 Création du dossier temp:', tempDir);
  fs.mkdirSync(tempDir, { recursive: true });
}

// Configuration multer pour upload d'avatars
const avatarUpload = multer({
  dest: tempDir,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    console.log('📎 Fichier reçu:', file.originalname, file.mimetype);
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      console.error('❌ Type de fichier rejeté:', file.mimetype);
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
router.post('/:id/upload-avatar', requireAuth, requireAdmin, avatarUpload.single('avatar'), teamController.uploadTeamAvatar); // Avant /:id pour éviter conflit
router.post('/', requireAuth, requireAdmin, teamController.createTeamMember);
router.put('/:id', requireAuth, requireAdmin, teamController.updateTeamMember);
router.delete('/:id', requireAuth, requireAdmin, teamController.deleteTeamMember);
router.post('/reorder', requireAuth, requireAdmin, teamController.reorderTeamMembers);

export default router;
