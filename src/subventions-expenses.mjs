import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/subventions/:campaignId/expenses - Lister les dépenses d'une campagne
 */
router.get('/:campaignId/expenses', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { status } = req.query;
    
    const where = { campaignId };
    if (status) where.status = status;

    const expenses = await prisma.subventionExpense.findMany({
      where,
      orderBy: { date: 'desc' }
    });

    res.json(expenses);
  } catch (error) {
    console.error('Erreur GET /api/subventions/:campaignId/expenses:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

/**
 * GET /api/subventions/:campaignId/expenses/:id - Récupérer une dépense
 */
router.get('/:campaignId/expenses/:id', async (req, res) => {
  try {
    const { campaignId, id } = req.params;
    
    const expense = await prisma.subventionExpense.findUnique({
      where: { id }
    });

    if (!expense || expense.campaignId !== campaignId) {
      return res.status(404).json({ error: 'Dépense non trouvée' });
    }

    res.json(expense);
  } catch (error) {
    console.error('Erreur GET /api/subventions/:campaignId/expenses/:id:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

/**
 * GET /api/subventions/:campaignId/expenses/summary - Résumé des dépenses
 */
router.get('/:campaignId/expenses-summary', async (req, res) => {
  try {
    const { campaignId } = req.params;
    
    const expenses = await prisma.subventionExpense.findMany({
      where: { campaignId }
    });

    const summary = {
      total: expenses.reduce((sum, e) => sum + e.amount, 0),
      byStatus: {
        SUBMITTED: expenses.filter(e => e.status === 'SUBMITTED').length,
        APPROVED: expenses.filter(e => e.status === 'APPROVED').length,
        REJECTED: expenses.filter(e => e.status === 'REJECTED').length
      },
      byCategory: {}
    };

    // Grouper par catégorie
    expenses.forEach(e => {
      if (!summary.byCategory[e.category]) {
        summary.byCategory[e.category] = 0;
      }
      summary.byCategory[e.category] += e.amount;
    });

    res.json(summary);
  } catch (error) {
    console.error('Erreur GET /api/subventions/:campaignId/expenses-summary:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

/**
 * POST /api/subventions/:campaignId/expenses - Créer une dépense
 */
router.post('/:campaignId/expenses', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const {
      description,
      amount,
      category,
      date,
      receipt,
      receiptFileName,
      receiptFileSize,
      receiptMimeType,
      notes,
      createdBy
    } = req.body;

    // Validation
    if (!description || amount === undefined) {
      return res.status(400).json({
        error: 'Champs requis manquants: description, amount'
      });
    }

    // Vérifier que la campagne existe
    const campaign = await prisma.subventionCampaign.findUnique({
      where: { id: campaignId }
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campagne non trouvée' });
    }

    const expense = await prisma.subventionExpense.create({
      data: {
        campaignId,
        description,
        amount: parseFloat(amount),
        category: category || 'OTHER',
        date: date ? new Date(date) : new Date(),
        receipt: receipt || null,
        receiptFileName: receiptFileName || null,
        receiptFileSize: receiptFileSize || null,
        receiptMimeType: receiptMimeType || null,
        notes: notes || null,
        createdBy: createdBy || null
      }
    });

    res.status(201).json(expense);
  } catch (error) {
    console.error('Erreur POST /api/subventions/:campaignId/expenses:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

/**
 * PUT /api/subventions/:campaignId/expenses/:id - Mettre à jour une dépense
 */
router.put('/:campaignId/expenses/:id', async (req, res) => {
  try {
    const { campaignId, id } = req.params;
    const {
      description,
      amount,
      category,
      date,
      receipt,
      receiptFileName,
      receiptFileSize,
      receiptMimeType,
      notes,
      status,
      approvedBy,
      approvedAt
    } = req.body;

    // Vérifier que la dépense existe et appartient à la campagne
    const existing = await prisma.subventionExpense.findUnique({
      where: { id }
    });

    if (!existing || existing.campaignId !== campaignId) {
      return res.status(404).json({ error: 'Dépense non trouvée' });
    }

    const expense = await prisma.subventionExpense.update({
      where: { id },
      data: {
        ...(description && { description }),
        ...(amount !== undefined && { amount: parseFloat(amount) }),
        ...(category && { category }),
        ...(date && { date: new Date(date) }),
        ...(receipt !== undefined && { receipt }),
        ...(receiptFileName !== undefined && { receiptFileName }),
        ...(receiptFileSize !== undefined && { receiptFileSize }),
        ...(receiptMimeType !== undefined && { receiptMimeType }),
        ...(notes !== undefined && { notes }),
        ...(status && { status }),
        ...(approvedBy !== undefined && { approvedBy }),
        ...(approvedAt !== undefined && { approvedAt: approvedAt ? new Date(approvedAt) : null })
      }
    });

    res.json(expense);
  } catch (error) {
    console.error('Erreur PUT /api/subventions/:campaignId/expenses/:id:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

/**
 * DELETE /api/subventions/:campaignId/expenses/:id - Supprimer une dépense
 */
router.delete('/:campaignId/expenses/:id', async (req, res) => {
  try {
    const { campaignId, id } = req.params;

    // Vérifier que la dépense existe et appartient à la campagne
    const existing = await prisma.subventionExpense.findUnique({
      where: { id }
    });

    if (!existing || existing.campaignId !== campaignId) {
      return res.status(404).json({ error: 'Dépense non trouvée' });
    }

    await prisma.subventionExpense.delete({
      where: { id }
    });

    res.json({ message: 'Dépense supprimée avec succès' });
  } catch (error) {
    console.error('Erreur DELETE /api/subventions/:campaignId/expenses/:id:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

export default router;
