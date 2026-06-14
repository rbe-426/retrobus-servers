/**
 * Team Controller - Gestion des membres de l'équipe
 * Synchronisation entre interne (avec contacts) et externe (sans contacts)
 */

import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '../../uploads/team-avatars');

// Créer le dossier uploads/team-avatars s'il n'existe pas
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

/**
 * GET /api/team - Récupère tous les membres de l'équipe
 * Query params:
 * - public=true : Masque les contacts (email/phone) pour affichage externe
 */
export const getAllTeamMembers = async (req, res) => {
  try {
    const { public: isPublic } = req.query;

    const members = await prisma.teamMember.findMany({
      where: { isActive: true },
      orderBy: [
        { hierarchy: 'asc' },
        { hierarchy2: 'asc' },
        { order: 'asc' }
      ]
    });

    // Déterminer l'URL de base pour les images
    const baseUrl = process.env.PUBLIC_API_BASE || 
                    process.env.VITE_API_URL || 
                    `${req.protocol}://${req.get('host')}`;

    // Transformer les membres
    const transformedMembers = members.map(member => {
      const transformed = { ...member };
      
      // Si l'image est un chemin relatif, le transformer en URL complète
      if (transformed.image && transformed.image.startsWith('/uploads/')) {
        transformed.image = `${baseUrl}${transformed.image}`;
      }
      
      // Si mode public, supprimer les contacts
      if (isPublic === 'true') {
        delete transformed.email;
        delete transformed.phone;
      }
      
      return transformed;
    });

    res.json(transformedMembers);
  } catch (error) {
    console.error('Erreur récupération équipe:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

/**
 * GET /api/team/:id - Récupère un membre par ID
 */
export const getTeamMemberById = async (req, res) => {
  try {
    const { id } = req.params;

    const member = await prisma.teamMember.findUnique({
      where: { id }
    });

    if (!member) {
      return res.status(404).json({ error: 'Membre non trouvé' });
    }

    // Transformer l'URL de l'image si nécessaire
    const baseUrl = process.env.PUBLIC_API_BASE || 
                    process.env.VITE_API_URL || 
                    `${req.protocol}://${req.get('host')}`;
    
    const transformed = { ...member };
    if (transformed.image && transformed.image.startsWith('/uploads/')) {
      transformed.image = `${baseUrl}${transformed.image}`;
    }

    res.json(transformed);
  } catch (error) {
    console.error('Erreur récupération membre:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

/**
 * POST /api/team - Crée un nouveau membre
 * Body: { name, role, roleColor, hierarchy, joinDate, memberType, catchphrase, image, email, phone, expertise }
 */
export const createTeamMember = async (req, res) => {
  try {
    const { name, role, roleColor, hierarchy, hierarchy2, joinDate, memberType, catchphrase, image, email, phone, expertise } = req.body;

    // Validation
    if (!name || !role || !joinDate) {
      return res.status(400).json({ error: 'name, role et joinDate requis' });
    }

    // Récupérer le dernier ordre pour ce niveau de hiérarchie
    const lastMember = await prisma.teamMember.findFirst({
      where: { hierarchy: hierarchy || 4 },
      orderBy: { order: 'desc' }
    });

    const newOrder = lastMember ? lastMember.order + 1 : 0;

    const newMember = await prisma.teamMember.create({
      data: {
        name,
        role,
        roleColor: roleColor || 'blue',
        hierarchy: hierarchy || 4,
        hierarchy2: hierarchy2 || 2,
        joinDate,
        memberType: memberType || 'Membre',
        catchphrase,
        image,
        email,
        phone,
        expertise: expertise || [],
        order: newOrder
      }
    });

    res.status(201).json(newMember);
  } catch (error) {
    console.error('Erreur création membre:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

/**
 * PUT /api/team/:id - Met à jour un membre
 */
export const updateTeamMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, roleColor, hierarchy, hierarchy2, joinDate, memberType, catchphrase, image, email, phone, expertise, order, isActive } = req.body;

    const updatedMember = await prisma.teamMember.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(role && { role }),
        ...(roleColor && { roleColor }),
        ...(hierarchy !== undefined && { hierarchy }),
        ...(hierarchy2 !== undefined && { hierarchy2 }),
        ...(joinDate && { joinDate }),
        ...(memberType && { memberType }),
        ...(catchphrase !== undefined && { catchphrase }),
        ...(image !== undefined && { image }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(expertise !== undefined && { expertise }),
        ...(order !== undefined && { order }),
        ...(isActive !== undefined && { isActive })
      }
    });

    res.json(updatedMember);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Membre non trouvé' });
    }
    console.error('Erreur mise à jour membre:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

/**
 * DELETE /api/team/:id - Supprime (désactive) un membre
 */
export const deleteTeamMember = async (req, res) => {
  try {
    const { id } = req.params;

    // Soft delete (désactiver au lieu de supprimer)
    await prisma.teamMember.update({
      where: { id },
      data: { isActive: false }
    });

    res.json({ message: 'Membre désactivé avec succès' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Membre non trouvé' });
    }
    console.error('Erreur suppression membre:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

/**
 * POST /api/team/reorder - Réordonne les membres
 * Body: { members: [{ id, order }] }
 */
export const reorderTeamMembers = async (req, res) => {
  try {
    const { members } = req.body;

    if (!Array.isArray(members)) {
      return res.status(400).json({ error: 'Format invalide' });
    }

    // Mise à jour en transaction
    await prisma.$transaction(
      members.map(({ id, order }) =>
        prisma.teamMember.update({
          where: { id },
          data: { order }
        })
      )
    );

    res.json({ message: 'Ordre mis à jour avec succès' });
  } catch (error) {
    console.error('Erreur réordonnancement:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

/**
 * POST /api/team/:id/upload-avatar - Upload photo de profil
 * Multipart form: file (image)
 */
export const uploadTeamAvatar = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('📤 Upload avatar demandé pour:', id);
    console.log('📂 Fichier reçu:', req.file ? req.file.originalname : 'AUCUN');
    
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    // Vérifier que le membre existe
    const member = await prisma.teamMember.findUnique({
      where: { id }
    });

    if (!member) {
      console.error('❌ Membre non trouvé:', id);
      // Supprimer le fichier uploadé si membre inexistant
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (cleanupError) {
        console.error('⚠️ Erreur nettoyage fichier temp:', cleanupError);
      }
      return res.status(404).json({ error: 'Membre non trouvé' });
    }

    // S'assurer que le dossier uploadsDir existe
    if (!fs.existsSync(uploadsDir)) {
      console.log('📁 Création du dossier:', uploadsDir);
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Générer un nom de fichier unique
    const ext = path.extname(req.file.originalname);
    const filename = `${id}-${Date.now()}${ext}`;
    const filepath = path.join(uploadsDir, filename);

    console.log('💾 Déplacement fichier:', req.file.path, '->', filepath);

    // Déplacer le fichier uploadé (utiliser copyFile + unlink pour éviter les problèmes de permissions)
    try {
      fs.copyFileSync(req.file.path, filepath);
      fs.unlinkSync(req.file.path);
      console.log('✅ Fichier déplacé avec succès');
    } catch (moveError) {
      console.error('❌ Erreur déplacement fichier:', moveError);
      throw new Error(`Impossible de déplacer le fichier: ${moveError.message}`);
    }

    // Supprimer l'ancien avatar si existe
    if (member.image && member.image.startsWith('/uploads/team-avatars/')) {
      const oldPath = path.join(__dirname, '../../', member.image);
      console.log('🗑️ Suppression ancien avatar:', oldPath);
      try {
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
          console.log('✅ Ancien avatar supprimé');
        }
      } catch (deleteError) {
        console.warn('⚠️ Impossible de supprimer l\'ancien avatar:', deleteError);
        // Non bloquant, on continue
      }
    }

    // Mettre à jour le chemin de l'image dans la DB
    const imageUrl = `/uploads/team-avatars/${filename}`;
    console.log('💾 Mise à jour DB avec imageUrl:', imageUrl);
    
    await prisma.teamMember.update({
      where: { id },
      data: { image: imageUrl }
    });

    console.log('✅ Avatar uploadé avec succès pour', member.name);

    res.json({ 
      message: 'Avatar uploadé avec succès',
      imageUrl 
    });
  } catch (error) {
    console.error('❌ Erreur upload avatar:', error);
    console.error('Stack:', error.stack);
    
    // Nettoyer le fichier en cas d'erreur
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
        console.log('🗑️ Fichier temp nettoyé après erreur');
      } catch (cleanupError) {
        console.error('⚠️ Impossible de nettoyer le fichier temp:', cleanupError);
      }
    }
    
    res.status(500).json({ 
      error: 'Erreur serveur lors de l\'upload',
      details: error.message 
    });
  }
};

