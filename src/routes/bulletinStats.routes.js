/**
 * Routes pour le suivi des bulletins d'adhésion
 * Stats, notifications, et monitoring
 */

import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/bulletin-stats - Statistiques des bulletins
 * Retourne le nombre de bulletins par statut
 */
router.get('/stats', async (req, res) => {
  try {
    const now = new Date();
    
    // Compter les bulletins par statut
    const stats = await prisma.$queryRaw`
      SELECT 
        status,
        COUNT(*)::int as count
      FROM "BulletinFlowToken"
      WHERE "expiresAt" > ${now}
      GROUP BY status
    `;

    // Formater les résultats
    const formatted = {
      pending: 0,      // En attente (pas encore commencé)
      in_progress: 0,  // En cours (étapes commencées mais pas finies)
      completed: 0,    // Complété et signé
      expired: 0,      // Expiré
      total: 0
    };

    stats.forEach(row => {
      formatted[row.status] = row.count;
      formatted.total += row.count;
    });

    // Compter les bulletins en cours d'édition (pending ou in_progress)
    formatted.active = formatted.pending + formatted.in_progress;

    res.json({
      success: true,
      stats: formatted
    });
  } catch (error) {
    console.error('❌ Erreur stats bulletins:', error);
    res.status(500).json({ error: 'Erreur récupération stats', details: error.message });
  }
});

/**
 * GET /api/bulletin-stats/recent-completions - Bulletins récemment complétés
 * Retourne les bulletins signés dans les dernières 24h
 */
router.get('/recent-completions', async (req, res) => {
  try {
    const since = req.query.since ? new Date(req.query.since) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const completions = await prisma.bulletinFlowToken.findMany({
      where: {
        status: 'completed',
        signedAt: {
          gte: since
        }
      },
      orderBy: {
        signedAt: 'desc'
      },
      select: {
        token: true,
        memberData: true,
        signedAt: true,
        createdAt: true
      }
    });

    const formatted = completions.map(c => ({
      token: c.token,
      memberName: `${c.memberData.firstName || ''} ${c.memberData.lastName || ''}`.trim(),
      memberEmail: c.memberData.email,
      signedAt: c.signedAt,
      createdAt: c.createdAt,
      duration: c.signedAt && c.createdAt 
        ? Math.round((new Date(c.signedAt) - new Date(c.createdAt)) / 1000 / 60) // minutes
        : null
    }));

    res.json({
      success: true,
      completions: formatted,
      count: formatted.length
    });
  } catch (error) {
    console.error('❌ Erreur bulletins récents:', error);
    res.status(500).json({ error: 'Erreur récupération bulletins récents', details: error.message });
  }
});

/**
 * GET /api/bulletin-stats/pending - Liste des bulletins en attente
 * Détails des bulletins non complétés
 */
router.get('/pending', async (req, res) => {
  try {
    const now = new Date();
    
    const pending = await prisma.bulletinFlowToken.findMany({
      where: {
        status: {
          in: ['pending', 'in_progress']
        },
        expiresAt: {
          gt: now
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        token: true,
        memberData: true,
        status: true,
        steps: true,
        createdAt: true,
        expiresAt: true
      }
    });

    const formatted = pending.map(p => ({
      token: p.token.substring(0, 12) + '...', // Masquer le token complet
      memberName: `${p.memberData.firstName || ''} ${p.memberData.lastName || ''}`.trim(),
      memberEmail: p.memberData.email,
      status: p.status,
      progress: calculateProgress(p.steps),
      createdAt: p.createdAt,
      expiresAt: p.expiresAt,
      daysLeft: Math.ceil((new Date(p.expiresAt) - now) / 1000 / 60 / 60 / 24)
    }));

    res.json({
      success: true,
      pending: formatted,
      count: formatted.length
    });
  } catch (error) {
    console.error('❌ Erreur bulletins en attente:', error);
    res.status(500).json({ error: 'Erreur récupération bulletins en attente', details: error.message });
  }
});

/**
 * Calcule le pourcentage de progression d'un bulletin
 */
function calculateProgress(steps) {
  if (!steps) return 0;
  
  const stepNames = ['welcome', 'verification', 'additional_info', 'signature', 'confirmation'];
  const completed = stepNames.filter(s => steps[s] === true).length;
  
  return Math.round((completed / stepNames.length) * 100);
}

export default router;
