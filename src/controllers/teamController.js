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
      // Si pas d'image, générer un avatar avec initiales
      else if (!transformed.image) {
        const initials = member.name
          .split(' ')
          .map(n => n[0])
          .join('')
          .toUpperCase();
        transformed.image = `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&size=300&background=random&bold=true`;
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
    
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    const member = await prisma.teamMember.findUnique({ where: { id } });
    if (!member) {
      return res.status(404).json({ error: 'Membre non trouvé' });
    }

    // Supprimer l'ancien avatar
    if (member.image && member.image.startsWith('/uploads/team-avatars/')) {
      const oldPath = path.join(__dirname, '../../', member.image);
      try {
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      } catch (e) {}
    }

    const imageUrl = `/uploads/team-avatars/${req.file.filename}`;
    
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

