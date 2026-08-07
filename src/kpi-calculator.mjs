// 📊 Module de calcul des KPI financiers avec support des périodes historiques
// Permet de calculer les KPI pour n'importe quel mois/année

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Calcule les KPI financiers pour une période donnée
 * @param {number} year - Année (ex: 2025)
 * @param {number} month - Mois (1-12)
 * @returns {Promise<Object>} KPI de la période
 */
export async function calculateMonthlyKPIs(year, month) {
  // Dates de début et fin de période
  const startDate = new Date(year, month - 1, 1); // 1er du mois
  const endDate = new Date(year, month, 0, 23, 59, 59); // Dernier jour du mois

  console.log(`📊 Calcul KPI pour ${month}/${year} (${startDate.toISOString()} → ${endDate.toISOString()})`);

  // 1. Transactions de la période
  const transactions = await prisma.finance_transactions.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate
      }
    }
  });

  // 2. Calcul des totaux
  const credits = transactions
    .filter(t => t.type === 'CREDIT')
    .reduce((sum, t) => sum + t.amount, 0);

  const debits = transactions
    .filter(t => t.type === 'DEBIT')
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = credits - debits;

  // 3. Rapports de dépenses de la période
  const expenseReports = await prisma.finance_expense_reports.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate
      }
    }
  });

  const expenseReportsStats = {
    total: expenseReports.length,
    pending: expenseReports.filter(r => r.status === 'SUBMITTED').length,
    approved: expenseReports.filter(r => r.status === 'APPROVED').length,
    paid: expenseReports.filter(r => r.status === 'PAID').length,
    totalAmount: expenseReports.reduce((sum, r) => sum + r.amount, 0),
    pendingAmount: expenseReports.filter(r => r.status === 'SUBMITTED').reduce((sum, r) => sum + r.amount, 0)
  };

  // 4. Documents financiers de la période
  const financialDocs = await prisma.financial_documents.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate
      }
    }
  });

  const quotesCount = financialDocs.filter(d => d.type === 'QUOTE').length;
  const invoicesCount = financialDocs.filter(d => d.type === 'INVOICE').length;
  const quotesAmount = financialDocs.filter(d => d.type === 'QUOTE').reduce((sum, d) => sum + d.amount, 0);
  const invoicesAmount = financialDocs.filter(d => d.type === 'INVOICE').reduce((sum, d) => sum + d.amount, 0);

  // 5. Subventions de la période
  const subventionExpenses = await prisma.subventionExpense.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate
      }
    }
  });

  const subventionStats = {
    total: subventionExpenses.reduce((sum, e) => sum + e.amount, 0),
    count: subventionExpenses.length,
    approved: subventionExpenses.filter(e => e.status === 'APPROVED').reduce((sum, e) => sum + e.amount, 0),
    approvedCount: subventionExpenses.filter(e => e.status === 'APPROVED').length,
    pending: subventionExpenses.filter(e => e.status === 'SUBMITTED').reduce((sum, e) => sum + e.amount, 0),
    pendingCount: subventionExpenses.filter(e => e.status === 'SUBMITTED').length
  };

  // 6. Calcul du solde cumulé jusqu'à cette date
  const cumulativeBalance = await calculateCumulativeBalance(endDate);

  const kpis = {
    period: {
      year,
      month,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      label: startDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    },
    transactions: {
      count: transactions.length,
      credits,
      debits,
      balance
    },
    expenseReports: expenseReportsStats,
    documents: {
      quotes: { count: quotesCount, amount: quotesAmount },
      invoices: { count: invoicesCount, amount: invoicesAmount }
    },
    subventions: subventionStats,
    cumulativeBalance // Solde total jusqu'à la fin de cette période
  };

  console.log(`✅ KPI calculés pour ${month}/${year}:`, {
    transactions: transactions.length,
    balance: balance.toFixed(2),
    cumulativeBalance: cumulativeBalance.toFixed(2)
  });

  return kpis;
}

/**
 * Calcule le solde cumulé jusqu'à une date donnée
 * @param {Date} endDate - Date de fin
 * @returns {Promise<number>} Solde cumulé
 */
async function calculateCumulativeBalance(endDate) {
  const allTransactions = await prisma.finance_transactions.findMany({
    where: {
      date: {
        lte: endDate
      }
    }
  });

  const credits = allTransactions
    .filter(t => t.type === 'CREDIT')
    .reduce((sum, t) => sum + t.amount, 0);

  const debits = allTransactions
    .filter(t => t.type === 'DEBIT')
    .reduce((sum, t) => sum + t.amount, 0);

  return credits - debits;
}

/**
 * Calcule les KPI pour une année complète (12 mois)
 * @param {number} year - Année
 * @returns {Promise<Array>} KPI de chaque mois
 */
export async function calculateYearlyKPIs(year) {
  const monthlyKPIs = [];

  for (let month = 1; month <= 12; month++) {
    const kpis = await calculateMonthlyKPIs(year, month);
    monthlyKPIs.push(kpis);
  }

  // Calcul des totaux annuels
  const yearlyTotals = {
    credits: monthlyKPIs.reduce((sum, m) => sum + m.transactions.credits, 0),
    debits: monthlyKPIs.reduce((sum, m) => sum + m.transactions.debits, 0),
    balance: monthlyKPIs.reduce((sum, m) => sum + m.transactions.balance, 0),
    transactionsCount: monthlyKPIs.reduce((sum, m) => sum + m.transactions.count, 0),
    expenseReportsCount: monthlyKPIs.reduce((sum, m) => sum + m.expenseReports.total, 0),
    quotesCount: monthlyKPIs.reduce((sum, m) => sum + m.documents.quotes.count, 0),
    invoicesCount: monthlyKPIs.reduce((sum, m) => sum + m.documents.invoices.count, 0)
  };

  return {
    year,
    monthly: monthlyKPIs,
    totals: yearlyTotals
  };
}

/**
 * Compare les KPI de deux périodes
 * @param {number} year1 - Année 1
 * @param {number} month1 - Mois 1
 * @param {number} year2 - Année 2
 * @param {number} month2 - Mois 2
 * @returns {Promise<Object>} Comparaison
 */
export async function comparePeriodsKPIs(year1, month1, year2, month2) {
  const [kpis1, kpis2] = await Promise.all([
    calculateMonthlyKPIs(year1, month1),
    calculateMonthlyKPIs(year2, month2)
  ]);

  const comparison = {
    period1: kpis1.period,
    period2: kpis2.period,
    changes: {
      transactions: {
        count: kpis2.transactions.count - kpis1.transactions.count,
        countPercent: kpis1.transactions.count > 0
          ? ((kpis2.transactions.count - kpis1.transactions.count) / kpis1.transactions.count * 100).toFixed(2)
          : 0,
        credits: kpis2.transactions.credits - kpis1.transactions.credits,
        debits: kpis2.transactions.debits - kpis1.transactions.debits,
        balance: kpis2.transactions.balance - kpis1.transactions.balance
      },
      expenseReports: {
        count: kpis2.expenseReports.total - kpis1.expenseReports.total,
        amount: kpis2.expenseReports.totalAmount - kpis1.expenseReports.totalAmount
      }
    }
  };

  return comparison;
}

/**
 * Obtient un résumé des derniers mois (historique)
 * @param {number} monthsCount - Nombre de mois à récupérer
 * @returns {Promise<Array>} KPI des derniers mois
 */
export async function getRecentMonthsKPIs(monthsCount = 6) {
  const now = new Date();
  const kpis = [];

  for (let i = 0; i < monthsCount; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKPIs = await calculateMonthlyKPIs(date.getFullYear(), date.getMonth() + 1);
    kpis.push(monthKPIs);
  }

  return kpis.reverse(); // Ordre chronologique
}

/**
 * Détecte automatiquement la plage de dates des transactions
 * @returns {Promise<Object>} { minDate, maxDate, totalMonths }
 */
export async function getDataRange() {
  const dates = await prisma.finance_transactions.aggregate({
    _min: { date: true },
    _max: { date: true }
  });

  if (!dates._min.date || !dates._max.date) {
    return null;
  }

  const minDate = new Date(dates._min.date);
  const maxDate = new Date(dates._max.date);

  // Calculer le nombre de mois entre les deux dates
  const totalMonths = (maxDate.getFullYear() - minDate.getFullYear()) * 12 
    + (maxDate.getMonth() - minDate.getMonth()) + 1;

  return {
    minDate,
    maxDate,
    minYear: minDate.getFullYear(),
    minMonth: minDate.getMonth() + 1,
    maxYear: maxDate.getFullYear(),
    maxMonth: maxDate.getMonth() + 1,
    totalMonths
  };
}

/**
 * Obtient les KPI de tous les mois avec des données
 * @returns {Promise<Array>} KPI de tous les mois
 */
export async function getAllPeriodsKPIs() {
  const range = await getDataRange();
  
  if (!range) {
    return [];
  }

  const kpis = [];
  let currentDate = new Date(range.minYear, range.minMonth - 1, 1);
  const endDate = new Date(range.maxYear, range.maxMonth - 1, 1);

  while (currentDate <= endDate) {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    
    const monthKPIs = await calculateMonthlyKPIs(year, month);
    kpis.push(monthKPIs);

    // Passer au mois suivant
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
  }

  return kpis;
}
