/**
 * Notifications Controller
 * Gère la logique métier pour les notifications système
 */

export async function getAllNotifications(req, res, next) {
  try {
    const { prisma } = req.app.locals;
    const { active } = req.query;

    // Construire le filtre
    const where = {};
    if (active === 'true') {
      where.active = true;
    } else if (active === 'false') {
      where.active = false;
    }

    // Récupérer toutes les notifications avec filtrage optionnel
    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return res.status(200).json(notifications || []);
  } catch (error) {
    console.error('❌ Erreur getAllNotifications:', error.message);
    return res.status(500).json({
      error: 'Impossible de récupérer les notifications',
      details: error.message,
    });
  }
}

export async function createNotification(req, res, next) {
  try {
    const { prisma } = req.app.locals;
    const { title, message, type = 'info', priority = 'normal', active = true, expiresAt, targetedTo = 'all' } = req.body;

    // Validation
    if (!title || !message) {
      return res.status(400).json({
        error: 'Validation',
        message: 'Les champs "title" et "message" sont obligatoires',
      });
    }

    if (!['info', 'warning', 'success', 'error'].includes(type)) {
      return res.status(400).json({
        error: 'Validation',
        message: 'Type invalide. Doit être: info, warning, success ou error',
      });
    }

    if (!['low', 'normal', 'high'].includes(priority)) {
      return res.status(400).json({
        error: 'Validation',
        message: 'Priorité invalide. Doit être: low, normal ou high',
      });
    }

    if (!['all', 'admins', 'members'].includes(targetedTo)) {
      return res.status(400).json({
        error: 'Validation',
        message: 'targetedTo invalide. Doit être: all, admins ou members',
      });
    }

    // Créer la notification
    const notification = await prisma.notification.create({
      data: {
        title: title.trim(),
        message: message.trim(),
        type,
        priority,
        active: Boolean(active),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        targetedTo,
        createdBy: req.user?.id || 'SYSTEM',
      },
    });

    console.log('✅ Notification créée:', notification.id);
    return res.status(201).json(notification);
  } catch (error) {
    console.error('❌ Erreur createNotification:', error.message);
    return res.status(500).json({
      error: 'Impossible de créer la notification',
      details: error.message,
    });
  }
}

export async function updateNotification(req, res, next) {
  try {
    const { prisma } = req.app.locals;
    const { id } = req.params;
    const { title, message, type, priority, active, expiresAt, targetedTo } = req.body;

    // Vérifier que la notification existe
    const existing = await prisma.notification.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({
        error: 'Non trouvée',
        message: 'Notification introuvable',
      });
    }

    // Construire l'objet de mise à jour
    const updateData = {};

    if (title !== undefined) {
      if (!title.trim()) {
        return res.status(400).json({
          error: 'Validation',
          message: 'Le titre ne peut pas être vide',
        });
      }
      updateData.title = title.trim();
    }

    if (message !== undefined) {
      if (!message.trim()) {
        return res.status(400).json({
          error: 'Validation',
          message: 'Le message ne peut pas être vide',
        });
      }
      updateData.message = message.trim();
    }

    if (type !== undefined) {
      if (!['info', 'warning', 'success', 'error'].includes(type)) {
        return res.status(400).json({
          error: 'Validation',
          message: 'Type invalide',
        });
      }
      updateData.type = type;
    }

    if (priority !== undefined) {
      if (!['low', 'normal', 'high'].includes(priority)) {
        return res.status(400).json({
          error: 'Validation',
          message: 'Priorité invalide',
        });
      }
      updateData.priority = priority;
    }

    if (active !== undefined) {
      updateData.active = Boolean(active);
    }

    if (expiresAt !== undefined) {
      updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
    }

    if (targetedTo !== undefined) {
      if (!['all', 'admins', 'members'].includes(targetedTo)) {
        return res.status(400).json({
          error: 'Validation',
          message: 'targetedTo invalide',
        });
      }
      updateData.targetedTo = targetedTo;
    }

    updateData.updatedAt = new Date();

    // Mettre à jour
    const updated = await prisma.notification.update({
      where: { id },
      data: updateData,
    });

    console.log('✅ Notification mise à jour:', id);
    return res.status(200).json(updated);
  } catch (error) {
    console.error('❌ Erreur updateNotification:', error.message);
    return res.status(500).json({
      error: 'Impossible de mettre à jour la notification',
      details: error.message,
    });
  }
}

export async function deleteNotification(req, res, next) {
  try {
    const { prisma } = req.app.locals;
    const { id } = req.params;

    // Vérifier que la notification existe
    const existing = await prisma.notification.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({
        error: 'Non trouvée',
        message: 'Notification introuvable',
      });
    }

    // Supprimer
    await prisma.notification.delete({
      where: { id },
    });

    console.log('✅ Notification supprimée:', id);
    return res.status(200).json({ success: true, id });
  } catch (error) {
    console.error('❌ Erreur deleteNotification:', error.message);
    return res.status(500).json({
      error: 'Impossible de supprimer la notification',
      details: error.message,
    });
  }
}

export async function getUserNotifications(req, res, next) {
  try {
    const { prisma } = req.app.locals;
    const { limit = 20 } = req.query;
    const userId = req.user?.role || 'USER';

    const now = new Date();

    // Récupérer les notifications visibles pour l'utilisateur
    const notifications = await prisma.notification.findMany({
      where: {
        active: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
        OR: [
          { targetedTo: 'all' },
          // Filter for admins
          ...(userId === 'ADMIN' || userId.includes('ADMIN')
            ? [{ targetedTo: 'admins' }]
            : []),
          // Filter for members
          { targetedTo: 'members' },
        ],
      },
      orderBy: [
        { priority: 'desc' }, // High priority first
        { createdAt: 'desc' },
      ],
      take: parseInt(limit),
    });

    console.log(`✅ ${notifications.length} notification(s) trouvée(s) pour l'utilisateur`);
    return res.status(200).json(notifications || []);
  } catch (error) {
    console.error('❌ Erreur getUserNotifications:', error.message);
    return res.status(500).json({
      error: 'Impossible de récupérer vos notifications',
      details: error.message,
    });
  }
}

export async function markAsRead(req, res, next) {
  try {
    const { prisma } = req.app.locals;
    const { id } = req.params;

    // Vérifier que la notification existe
    const existing = await prisma.notification.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({
        error: 'Non trouvée',
        message: 'Notification introuvable',
      });
    }

    // Au lieu de mettre à jour la notification elle-même,
    // on pourrait tracker la lecture par utilisateur avec une table séparée
    // Pour maintenant, on retourne juste un succès
    console.log('✅ Notification marquée comme lue:', id);
    return res.status(200).json({ success: true, id });
  } catch (error) {
    console.error('❌ Erreur markAsRead:', error.message);
    return res.status(500).json({
      error: 'Impossible de marquer la notification comme lue',
      details: error.message,
    });
  }
}
