import express from 'express';
import { bankSyncService } from '../services/bankSync.service.js';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
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
      
      // The existing finance schema stores the transaction date and category as
      // `date` and `category`; financial allocations are handled separately.
      const result = await prisma.finance_transactions.createMany({
        data: transactions.filter(tx => tx.date && Number.isFinite(tx.amount)).map(tx => ({
          id: crypto.randomUUID(),
          amount: tx.amount,
          description: tx.description,
          date: new Date(tx.date),
          type: tx.amount > 0 ? 'CREDIT' : 'DEBIT',
          category: 'AUTRE'
        })),
        skipDuplicates: false
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
