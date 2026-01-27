import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/subventions - Lister toutes les campagnes de subvention
 */
router.get('/', async (req, res) => {
  try {
    const { status, organization } = req.query;
    
    const where = {};
    if (status) where.status = status;
    if (organization) where.organization = { contains: organization, mode: 'insensitive' };

    const campaigns = await prisma.subventionCampaign.findMany({
      where,
      orderBy: { deadline: 'asc' }
    });

    res.json(campaigns);
  } catch (error) {
    console.error('Erreur GET /api/subventions:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

/**
 * GET /api/subventions/stats/summary - Récupérer les statistiques globales des campagnes
 */
router.get('/stats/summary', async (req, res) => {
  try {
    const campaigns = await prisma.subventionCampaign.findMany({
      include: { SubventionExpense: true }
    });

    const expenses = await prisma.subventionExpense.findMany();

    const stats = {
      campaigns: {
        total: campaigns.length,
        active: campaigns.filter(c => c.status === 'ACTIVE' && new Date(c.deadline) > new Date()).length,
        expired: campaigns.filter(c => new Date(c.deadline) <= new Date()).length,
        totalBudget: campaigns.reduce((sum, c) => sum + (c.maxAmount || 0), 0),
        minBudgetAvailable: campaigns.reduce((sum, c) => sum + (c.minAmount || 0), 0)
      },
      expenses: {
        total: expenses.reduce((sum, e) => sum + e.amount, 0),
        count: expenses.length,
        approved: expenses.filter(e => e.status === 'APPROVED').reduce((sum, e) => sum + e.amount, 0),
        approvedCount: expenses.filter(e => e.status === 'APPROVED').length,
        pending: expenses.filter(e => e.status === 'SUBMITTED').reduce((sum, e) => sum + e.amount, 0),
        pendingCount: expenses.filter(e => e.status === 'SUBMITTED').length,
        rejected: expenses.filter(e => e.status === 'REJECTED').reduce((sum, e) => sum + e.amount, 0),
        rejectedCount: expenses.filter(e => e.status === 'REJECTED').length,
        byCategory: {}
      },
      kpis: {
        budgetUtilization: campaigns.length > 0 
          ? ((expenses.reduce((sum, e) => sum + e.amount, 0) / campaigns.reduce((sum, c) => sum + (c.maxAmount || 0), 0)) * 100).toFixed(2)
          : 0,
        expenseApprovalRate: expenses.length > 0
          ? ((expenses.filter(e => e.status === 'APPROVED').length / expenses.length) * 100).toFixed(2)
          : 0,
        averageExpenseAmount: expenses.length > 0
          ? (expenses.reduce((sum, e) => sum + e.amount, 0) / expenses.length).toFixed(2)
          : 0,
        nextDeadline: campaigns.length > 0 
          ? campaigns
              .filter(c => c.status === 'ACTIVE' && new Date(c.deadline) > new Date())
              .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))[0]?.deadline || null
          : null
      }
    };

    // Grouper les dépenses par catégorie
    expenses.forEach(e => {
      if (!stats.expenses.byCategory[e.category]) {
        stats.expenses.byCategory[e.category] = {
          count: 0,
          total: 0,
          approved: 0,
          pending: 0
        };
      }
      stats.expenses.byCategory[e.category].count += 1;
      stats.expenses.byCategory[e.category].total += e.amount;
      if (e.status === 'APPROVED') stats.expenses.byCategory[e.category].approved += e.amount;
      if (e.status === 'SUBMITTED') stats.expenses.byCategory[e.category].pending += e.amount;
    });

    res.json(stats);
  } catch (error) {
    console.error('Erreur GET /api/subventions/stats/summary:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

/**
 * GET /api/subventions/:id - Récupérer une campagne spécifique
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const campaign = await prisma.subventionCampaign.findUnique({
      where: { id },
      include: { SubventionExpense: { orderBy: { date: 'desc' } } }
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campagne non trouvée' });
    }

    // Parser les champs JSON
    const parsed = {
      ...campaign,
      requiredDocuments: campaign.requiredDocuments ? JSON.parse(campaign.requiredDocuments) : [],
      criteria: campaign.criteria ? JSON.parse(campaign.criteria) : []
    };

    res.json(parsed);
  } catch (error) {
    console.error('Erreur GET /api/subventions/:id:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

/**
 * GET /api/subventions/filter/active - Récupérer uniquement les campagnes actives
 */
router.get('/filter/active', async (req, res) => {
  try {
    const campaigns = await prisma.subventionCampaign.findMany({
      where: {
        status: 'ACTIVE',
        deadline: {
          gte: new Date()
        }
      },
      orderBy: { deadline: 'asc' }
    });

    res.json(campaigns);
  } catch (error) {
    console.error('Erreur GET /api/subventions/filter/active:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

/**
 * POST /api/subventions - Créer une nouvelle campagne (ADMIN only)
 */
router.post('/', async (req, res) => {
  try {
    const { 
      title, 
      organization, 
      description, 
      minAmount, 
      maxAmount, 
      deadline, 
      status,
      category,
      requiredDocuments,
      criteria,
      contactEmail,
      contactPhone,
      websiteUrl,
      notes,
      createdBy
    } = req.body;

    // Validation
    if (!title || !organization || !deadline) {
      return res.status(400).json({ 
        error: 'Champs requis manquants: title, organization, deadline' 
      });
    }

    const campaign = await prisma.subventionCampaign.create({
      data: {
        title,
        organization,
        description: description || null,
        minAmount: minAmount ? parseFloat(minAmount) : null,
        maxAmount: maxAmount ? parseFloat(maxAmount) : null,
        deadline: new Date(deadline),
        status: status || 'ACTIVE',
        category: category || null,
        requiredDocuments: requiredDocuments ? JSON.stringify(requiredDocuments) : null,
        criteria: criteria ? JSON.stringify(criteria) : null,
        contactEmail: contactEmail || null,
        contactPhone: contactPhone || null,
        websiteUrl: websiteUrl || null,
        notes: notes || null,
        createdBy: createdBy || null
      }
    });

    res.status(201).json(campaign);
  } catch (error) {
    console.error('Erreur POST /api/subventions:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

/**
 * PUT /api/subventions/:id - Mettre à jour une campagne (ADMIN only)
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      organization,
      description,
      minAmount,
      maxAmount,
      deadline,
      status,
      category,
      requiredDocuments,
      criteria,
      contactEmail,
      contactPhone,
      websiteUrl,
      notes
    } = req.body;

    const campaign = await prisma.subventionCampaign.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(organization && { organization }),
        ...(description !== undefined && { description }),
        ...(minAmount !== undefined && { minAmount: minAmount ? parseFloat(minAmount) : null }),
        ...(maxAmount !== undefined && { maxAmount: maxAmount ? parseFloat(maxAmount) : null }),
        ...(deadline && { deadline: new Date(deadline) }),
        ...(status && { status }),
        ...(category !== undefined && { category }),
        ...(requiredDocuments !== undefined && { requiredDocuments: requiredDocuments ? JSON.stringify(requiredDocuments) : null }),
        ...(criteria !== undefined && { criteria: criteria ? JSON.stringify(criteria) : null }),
        ...(contactEmail !== undefined && { contactEmail }),
        ...(contactPhone !== undefined && { contactPhone }),
        ...(websiteUrl !== undefined && { websiteUrl }),
        ...(notes !== undefined && { notes })
      }
    });

    res.json(campaign);
  } catch (error) {
    console.error('Erreur PUT /api/subventions/:id:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Campagne non trouvée' });
    }
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

/**
 * DELETE /api/subventions/:id - Supprimer une campagne (ADMIN only)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.subventionCampaign.delete({
      where: { id }
    });

    res.json({ message: 'Campagne supprimée avec succès' });
  } catch (error) {
    console.error('Erreur DELETE /api/subventions/:id:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Campagne non trouvée' });
    }
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// ============================================
// EXPENSES ROUTES
// ============================================

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
 * GET /api/subventions/:campaignId/expenses/:expenseId - Récupérer une dépense
 */
router.get('/:campaignId/expenses/:expenseId', async (req, res) => {
  try {
    const { campaignId, expenseId } = req.params;
    
    const expense = await prisma.subventionExpense.findUnique({
      where: { id: expenseId }
    });

    if (!expense || expense.campaignId !== campaignId) {
      return res.status(404).json({ error: 'Dépense non trouvée' });
    }

    res.json(expense);
  } catch (error) {
    console.error('Erreur GET /api/subventions/:campaignId/expenses/:expenseId:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

/**
 * GET /api/subventions/:campaignId/expenses-summary - Résumé des dépenses
 */
router.get('/:campaignId/expenses-summary', async (req, res) => {
  try {
    const { campaignId } = req.params;
    
    const expenses = await prisma.subventionExpense.findMany({
      where: { campaignId }
    });

    const summary = {
      total: expenses.reduce((sum, e) => sum + e.amount, 0),
      count: expenses.length,
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
        summary.byCategory[e.category] = { count: 0, amount: 0 };
      }
      summary.byCategory[e.category].count += 1;
      summary.byCategory[e.category].amount += e.amount;
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
 * PUT /api/subventions/:campaignId/expenses/:expenseId - Mettre à jour une dépense
 */
router.put('/:campaignId/expenses/:expenseId', async (req, res) => {
  try {
    const { campaignId, expenseId } = req.params;
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
      approvedBy
    } = req.body;

    // Vérifier que la dépense existe et appartient à la campagne
    const existing = await prisma.subventionExpense.findUnique({
      where: { id: expenseId }
    });

    if (!existing || existing.campaignId !== campaignId) {
      return res.status(404).json({ error: 'Dépense non trouvée' });
    }

    const expense = await prisma.subventionExpense.update({
      where: { id: expenseId },
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
        ...(status === 'APPROVED' && { approvedAt: new Date() })
      }
    });

    res.json(expense);
  } catch (error) {
    console.error('Erreur PUT /api/subventions/:campaignId/expenses/:expenseId:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

/**
 * DELETE /api/subventions/:campaignId/expenses/:expenseId - Supprimer une dépense
 */
router.delete('/:campaignId/expenses/:expenseId', async (req, res) => {
  try {
    const { campaignId, expenseId } = req.params;

    // Vérifier que la dépense existe et appartient à la campagne
    const existing = await prisma.subventionExpense.findUnique({
      where: { id: expenseId }
    });

    if (!existing || existing.campaignId !== campaignId) {
      return res.status(404).json({ error: 'Dépense non trouvée' });
    }

    await prisma.subventionExpense.delete({
      where: { id: expenseId }
    });

    res.json({ message: 'Dépense supprimée avec succès' });
  } catch (error) {
    console.error('Erreur DELETE /api/subventions/:campaignId/expenses/:expenseId:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

export default router;
