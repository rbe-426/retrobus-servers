/**
 * Team Controller - Gestion des membres de l'équipe
 * Synchronisation entre interne (avec contacts) et externe (sans contacts)
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

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

    // Si mode public, masquer les contacts
    if (isPublic === 'true') {
      const publicMembers = members.map(({ email, phone, ...member }) => member);
      return res.json(publicMembers);
    }

    res.json(members);
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

    res.json(member);
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
