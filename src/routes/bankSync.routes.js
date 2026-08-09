import express from 'express';
import { bankSyncService } from '../services/bankSync.service.js';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Middleware d'authentification (à adapter selon ton système)
const requireAuth = (req, res, next) => {
  // TODO: Vérifier l'authentification
  // Pour l'instant, on simule un user.id
  req.user = { id: 'test-user' };
  next();
};

// Lister les banques disponibles
router.get('/banks', requireAuth, async (req, res) => {
  try {
    const banks = await bankSyncService.listBanks('FR');
    res.json(banks);
  } catch (error) {
    console.error('Error listing banks:', error);
    res.status(500).json({ error: error.message });
  }
});

// Initier une connexion bancaire
router.post('/connect-bank', requireAuth, async (req, res) => {
  try {
    const { bankId } = req.body;
    
    if (!bankId) {
      return res.status(400).json({ error: 'bankId requis' });
    }
    
    const result = await bankSyncService.createBankLink(bankId, req.user.id);
    
    // TODO: Sauvegarder le requisitionId en base
    // await prisma.bank_connections.create({
    //   data: {
    //     userId: req.user.id,
    //     requisitionId: result.requisitionId,
    //     bankId: bankId,
    //     status: 'PENDING'
    //   }
    // });
    
    res.json({ 
      linkUrl: result.link,
      requisitionId: result.requisitionId 
    });
  } catch (error) {
    console.error('Error connecting bank:', error);
    res.status(500).json({ error: error.message });
  }
});

// Callback après connexion bancaire
router.get('/bank-callback', async (req, res) => {
  try {
    const { ref: requisitionId } = req.query;
    
    if (!requisitionId) {
      return res.redirect(`${process.env.FRONTEND_URL}/finance?error=no_requisition`);
    }
    
    // Récupérer les comptes
    const accountIds = await bankSyncService.getAccounts(requisitionId);
    
    let totalImported = 0;
    
    // Importer les transactions de chaque compte
    for (const accountId of accountIds) {
      const { accountName, transactions } = await bankSyncService.getTransactions(accountId);
      
      console.log(`Importing ${transactions.length} transactions from ${accountName}`);
      
      // Sauvegarder les transactions
      const result = await prisma.finance_transactions.createMany({
        data: transactions.map(tx => ({
          amount: tx.amount,
          description: tx.description,
          transactionDate: new Date(tx.date),
          type: tx.amount > 0 ? 'INCOME' : 'EXPENSE',
          categoryId: null, // À catégoriser manuellement ou automatiquement
          notes: `Importé depuis ${accountName} (${tx.currency})`,
          createdAt: new Date(),
          updatedAt: new Date()
        })),
        skipDuplicates: true
      });
      
      totalImported += result.count;
    }
    
    res.redirect(`${process.env.FRONTEND_URL}/finance?success=bank_connected&imported=${totalImported}`);
  } catch (error) {
    console.error('Bank callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/finance?error=sync_failed`);
  }
});

// Synchroniser manuellement (à implémenter plus tard)
router.post('/sync-bank', requireAuth, async (req, res) => {
  try {
    // TODO: Implémenter la synchronisation manuelle
    res.status(501).json({ error: 'À implémenter' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
