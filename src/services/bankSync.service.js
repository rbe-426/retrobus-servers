import NordigenClient from 'nordigen-node';

const client = new NordigenClient({
  secretId: process.env.NORDIGEN_SECRET_ID,
  secretKey: process.env.NORDIGEN_SECRET_KEY
});

export const bankSyncService = {
  // Générer un token
  async getToken() {
    return await client.generateToken();
  },

  // Lister les banques disponibles
  async listBanks(country = 'FR') {
    await this.getToken();
    return await client.institution.getInstitutions({ country });
  },

  // Créer un lien de connexion bancaire
  async createBankLink(institutionId, userId) {
    await this.getToken();
    
    const init = await client.initSession({
      redirectUrl: `${process.env.FRONTEND_URL}/finance/bank-callback`,
      institutionId: institutionId,
      referenceId: userId
    });

    return {
      link: init.link,
      requisitionId: init.id
    };
  },

  // Récupérer les comptes connectés
  async getAccounts(requisitionId) {
    await this.getToken();
    const requisition = await client.requisition.getRequisitionById(requisitionId);
    return requisition.accounts;
  },

  // Récupérer les transactions d'un compte
  async getTransactions(accountId, daysBack = 90) {
    await this.getToken();
    const account = client.account(accountId);
    
    const [details, transactions] = await Promise.all([
      account.getDetails(),
      account.getTransactions({ dateFrom: this.getDateFrom(daysBack) })
    ]);

    return {
      accountName: details.account?.name || details.account?.ownerName || 'Compte bancaire',
      iban: details.account?.iban,
      transactions: (transactions.transactions?.booked || []).map(tx => ({
        date: tx.bookingDate || tx.valueDate,
        amount: parseFloat(tx.transactionAmount.amount),
        currency: tx.transactionAmount.currency,
        description: tx.remittanceInformationUnstructured || tx.creditorName || tx.debtorName || 'Transaction',
        reference: tx.transactionId,
        creditor: tx.creditorName,
        debtor: tx.debtorName
      }))
    };
  },

  // Helper pour calculer la date de début
  getDateFrom(daysBack) {
    const date = new Date();
    date.setDate(date.getDate() - daysBack);
    return date.toISOString().split('T')[0];
  }
};
