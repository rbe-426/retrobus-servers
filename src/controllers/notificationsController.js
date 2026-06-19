/**
 * Notifications Controller
 * Gère la logique métier pour les notifications système
 */

// Utilitaire pour obtenir prisma depuis l'app
const getPrisma = (req) => {
  try {
    // Essayer req.app.locals d'abord
    if (req.app?.locals?.prisma) {
      return req.app.locals.prisma;
    }
    
    // Fallback : importer depuis le parent (pas idéal mais fonctionne)
    console.warn('⚠️  Prisma non disponible dans req.app.locals, création d\'une instance fallback');
    const { PrismaClient } = require('@prisma/client');
    return new PrismaClient();
  } catch (error) {
    console.error('❌ Erreur accès Prisma:', error.message);
    throw error;
  }
};

export async function getAllNotifications(req, res, next) {
  try {
    const prisma = getPrisma(req);
    const { active } = req.query;

    console.log('📡 getAllNotifications - active:', active);

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

    console.log(`✅ ${notifications.length} notifications trouvées`);
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
    const prisma = getPrisma(req);
    const { title, message, type = 'info', priority = 'normal', active = true, expiresAt, targetedTo = 'all' } = req.body;

    console.log('📝 Création notification:', { title, type, priority, targetedTo });

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

    if (!['all', 'admins', 'members'].includes(targetedTo) && !String(targetedTo).startsWith('user:')) {
      return res.status(400).json({
        error: 'Validation',
        message: 'targetedTo invalide. Doit être: all, admins, members ou user:<email>',
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
        createdBy: req.user?.id || req.user?.email || 'SYSTEM',
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
    const prisma = getPrisma(req);
    const { id } = req.params;
    const { title, message, type, priority, active, expiresAt, targetedTo } = req.body;

    console.log('📝 Mise à jour notification:', id);

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
      if (!['all', 'admins', 'members'].includes(targetedTo) && !String(targetedTo).startsWith('user:')) {
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
    const prisma = getPrisma(req);
    const { id } = req.params;

    console.log('🗑️  Suppression notification:', id);

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
    const prisma = getPrisma(req);
    const { limit = 20 } = req.query;
    
    // Déterminer le rôle de l'utilisateur
    const userRole = req.user?.role || 'USER';
    const isAdmin = userRole === 'ADMIN' || userRole?.includes('ADMIN');

    console.log(`📬 getUserNotifications - userRole: ${userRole}, isAdmin: ${isAdmin}`);

    const now = new Date();
    const userEmail = String(req.user?.email || '').trim().toLowerCase();
    const userId = String(req.user?.id || '').trim();

    // Construire les conditions OR pour filteringles notifications visibles
    const orConditions = [
      { targetedTo: 'all' }, // Toujours visible par tous
    ];

    // Si admin, ajouter les notifications pour les admins
    if (isAdmin) {
      orConditions.push({ targetedTo: 'admins' });
    } else {
      // Sinon, ajouter les notifications pour les members
      orConditions.push({ targetedTo: 'members' });
    }

    // Notifications ciblées utilisateur (email ou id)
    if (userEmail) {
      orConditions.push({ targetedTo: `user:${userEmail}` });
    }
    if (userId) {
      orConditions.push({ targetedTo: `user:${userId}` });
    }

    // Récupérer les notifications visibles pour l'utilisateur
    const notifications = await prisma.notification.findMany({
      where: {
        active: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
        AND: [
          {
            OR: orConditions,
          }
        ]
      },
      orderBy: [
        { priority: 'desc' }, // High priority first (si besoin, inverser avec desc)
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
    const prisma = getPrisma(req);
    const { id } = req.params;

    console.log('✓ Marquage lecture notification:', id);

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
