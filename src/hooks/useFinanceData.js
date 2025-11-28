/**
 * Logique partagée Finance
 * Centralise tous les hooks et appels API pour les composants Finance
 * AVEC TOUTES LES RÈGLES MÉTIER de l'ancien AdminFinance
 */

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@chakra-ui/react";
import {
  validateTransaction,
  validateDocument,
  validateScheduledOperation,
  validateTransactionAllocations,
  calculateFinancialStats,
  calculateTTC,
  canModifyBalance,
  canApprovePayments
} from "../utils/financeBusinessRules";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

export const useFinanceData = (currentUser = null) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  // Récupérer le rôle depuis l'utilisateur courant ou depuis localStorage
  const [userRole, setUserRole] = useState(() => {
    try {
      const user = currentUser || (() => {
        const userStr = localStorage.getItem("user");
        return userStr ? JSON.parse(userStr) : null;
      })();
      
      if (user && typeof getPrimaryRole === "function") {
        return getPrimaryRole(user);
      } else if (user?.roles && Array.isArray(user.roles) && user.roles.length > 0) {
        return user.roles[0];
      } else if (user?.role) {
        return user.role;
      }
    } catch (e) {
      console.warn("Erreur lecture userRole:", e.message);
    }
    return "MEMBER";
  });

  // État transactions
  const [transactions, setTransactions] = useState([]);
  const [newTransaction, setNewTransaction] = useState({
    type: "CREDIT",
    amount: "",
    description: "",
    category: "ADHESION",
    date: new Date().toISOString().split("T")[0]
  });

  // État documents (Devis & Factures)
  const [documents, setDocuments] = useState([]);
  const [editingDocument, setEditingDocument] = useState(null);
  const [docForm, setDocForm] = useState({
    type: "QUOTE",
    number: "",
    title: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
    dueDate: "",
    amountExcludingTax: "",
    taxRate: 20,
    taxAmount: 0,
    amount: "",
    status: "DRAFT",
    eventId: ""
  });

  // État opérations programmées (Échéanciers & Paiements)
  const [scheduledOperations, setScheduledOperations] = useState([]);
  const [newScheduled, setNewScheduled] = useState({
    type: "SCHEDULED_PAYMENT",
    amount: "",
    description: "",
    frequency: "MONTHLY",
    nextDate: new Date().toISOString().split("T")[0],
    totalAmount: ""
  });

  // État notes de frais
  const [expenseReports, setExpenseReports] = useState([]);
  const [newExpenseReport, setNewExpenseReport] = useState({
    description: "",
    amount: "",
    date: new Date().toISOString().split("T")[0]
  });

  // État simulations
  const [simulationData, setSimulationData] = useState({
    scenarios: [],
    activeScenario: null,
    projectionMonths: 12
  });

  // État rapports
  const currentYear = new Date().getFullYear();
  const [reportYear, setReportYear] = useState(currentYear);
  const [reportData, setReportData] = useState(null);

  // État configuration
  const [balance, setBalance] = useState(0);
  const [isBalanceLocked, setIsBalanceLocked] = useState(true);
  const [stats, setStats] = useState({
    totalCredits: 0,
    totalDebits: 0,
    monthlyBalance: 0,
    scheduledMonthlyImpact: 0,
    scheduledCount: 0
  });

  // Charger les données initiales
  const loadFinanceData = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");

      // Charger les transactions
      try {
        const transRes = await fetch(`${API_BASE}/api/finance/transactions`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (transRes.ok) {
          const data = await transRes.json();
          setTransactions(data.transactions || []);
          // Calculer les stats depuis les transactions
          if (data.transactions && data.transactions.length > 0) {
            const stats = calculateFinancialStats(data.transactions, []);
            setStats(stats);
          }
        }
      } catch (err) {
        console.warn("⚠️ Erreur chargement transactions:", err.message);
      }

      // Charger les documents (Devis & Factures)
      try {
        const docsRes = await fetch(`${API_BASE}/api/finance/documents`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (docsRes.ok) {
          const data = await docsRes.json();
          const rawDocs = Array.isArray(data) ? data : (data.documents || []);
          
          // Normaliser les documents: ajouter un champ "status" unifié
          const normalizedDocs = rawDocs.map(doc => ({
            ...doc,
            status: doc.type === 'QUOTE' ? doc.quoteStatus : doc.invoiceStatus
          }));
          
          setDocuments(normalizedDocs);
        }
      } catch (err) {
        console.warn("⚠️ Erreur chargement documents:", err.message);
      }

      // Charger les opérations programmées (endpoint: /scheduled-operations)
      try {
        const schedRes = await fetch(`${API_BASE}/api/finance/scheduled-operations`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (schedRes.ok) {
          const data = await schedRes.json();
          setScheduledOperations(data.operations || []);
        }
      } catch (err) {
        console.warn("⚠️ Erreur chargement opérations programmées:", err.message);
      }

      // Charger les notes de frais (endpoint: /expense-reports)
      try {
        const expenseRes = await fetch(`${API_BASE}/api/finance/expense-reports`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (expenseRes.ok) {
          const data = await expenseRes.json();
          setExpenseReports(data.reports || []);
        }
      } catch (err) {
        console.warn("⚠️ Erreur chargement notes de frais:", err.message);
      }

      // Charger le solde
      try {
        const balRes = await fetch(`${API_BASE}/api/finance/balance`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (balRes.ok) {
          const data = await balRes.json();
          setBalance(data.balance || 0);
        }
      } catch (err) {
        console.warn("⚠️ Erreur chargement solde:", err.message);
      }
    } catch (error) {
      console.error("❌ Erreur chargement données finance:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données financières",
        status: "error",
        duration: 5000
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Créer une transaction
  const addTransaction = useCallback(
    async (transaction, allocations = []) => {
      try {
        // VALIDATION MÉTIER: Vérifier les champs obligatoires
        const validation = validateTransaction(transaction);
        if (!validation.isValid) {
          toast({
            title: "Erreur de validation",
            description: validation.errors.join(", "),
            status: "warning",
            duration: 5000
          });
          return null;
        }

        // VALIDATION MÉTIER: Si allocations, vérifier le total
        if (allocations.length > 0) {
          const allocValidation = validateTransactionAllocations(
            allocations,
            parseFloat(transaction.amount)
          );
          if (!allocValidation.isValid) {
            toast({
              title: "Erreur allocation",
              description: allocValidation.errors.join(", "),
              status: "warning",
              duration: 5000
            });
            return null;
          }
        }

        setLoading(true);

        const res = await fetch(`${API_BASE}/api/finance/transactions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`
          },
          body: JSON.stringify({
            ...transaction,
            amount: parseFloat(transaction.amount)
          })
        });

        if (!res.ok) throw new Error("Erreur creation transaction");

        const data = await res.json();
        
        // MÉTIER: Sauvegarder les allocations si présentes
        if (allocations.length > 0) {
          try {
            await fetch(`${API_BASE}/api/finance/transactions/${data.id}/allocations`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem("token")}`
              },
              body: JSON.stringify({ allocations })
            });
          } catch (e) {
            console.warn("Erreur sauvegarde allocations:", e);
          }
        }

        setTransactions([...transactions, data]);
        toast({
          title: "Succes",
          description: allocations.length > 0 
            ? `Transaction creee avec ${allocations.length} allocation(s)`
            : "Transaction creee",
          status: "success"
        });
        // Recharger les données pour synchroniser avec le serveur
        await loadFinanceData();
        return data;
      } catch (error) {
        toast({
          title: "Erreur",
          description: error.message,
          status: "error"
        });
        return null;
      } finally {
        setLoading(false);
      }
    },
    [transactions, toast]
  );

  // Supprimer une transaction
  const deleteTransaction = useCallback(
    async (id) => {
      try {
        const res = await fetch(`${API_BASE}/api/finance/transactions/${id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`
          }
        });

        if (!res.ok) throw new Error("Erreur suppression");

        setTransactions(transactions.filter(t => t.id !== id));
        toast({
          title: "Succès",
          description: "Transaction supprimée",
          status: "success"
        });
        // Recharger les données pour synchroniser avec le serveur
        await loadFinanceData();
      } catch (error) {
        toast({
          title: "Erreur",
          description: error.message,
          status: "error"
        });
      }
    },
    [transactions, toast]
  );

  // Créer un document (Devis/Facture)
  const addDocument = useCallback(
    async (document) => {
      try {
        // VALIDATION MÉTIER: Vérifier les champs obligatoires
        const validation = validateDocument(document);
        if (!validation.isValid) {
          toast({
            title: "Erreur de validation",
            description: validation.errors.join(", "),
            status: "warning",
            duration: 5000
          });
          return null;
        }

        // MÉTIER: Calculer TTC si HT fourni
        let finalDoc = { ...document };
        if (document.amountExcludingTax) {
          const { taxAmount, totalAmount } = calculateTTC(
            document.amountExcludingTax,
            document.taxRate
          );
          finalDoc = {
            ...finalDoc,
            taxAmount,
            amount: totalAmount
          };
        }

        setLoading(true);

        // ÉDITION ou CRÉATION ?
        let res;
        if (document.id) {
          // Mode édition: PUT
          res = await fetch(`${API_BASE}/api/finance/documents/${document.id}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token")}`
            },
            body: JSON.stringify(finalDoc)
          });
        } else {
          // Mode création: POST
          res = await fetch(`${API_BASE}/api/finance/documents`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token")}`
            },
            body: JSON.stringify(finalDoc)
          });
        }

        if (!res.ok) throw new Error("Erreur creation document");

        const data = await res.json();
        console.log("📦 addDocument retournant:", data);
        
        toast({
          title: "Succes",
          description: "Document cree",
          status: "success"
        });
        
        // Recharger les données pour synchroniser avec le serveur
        await loadFinanceData();
        
        // Retourner le document avec l'ID pour utilisation immédiate
        return {
          ...data,
          id: data.id || data?.document?.id || data?.data?.id
        };
      } catch (error) {
        toast({
          title: "Erreur",
          description: error.message,
          status: "error"
        });
        return null;
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  // Supprimer un document
  const deleteDocument = useCallback(
    async (id) => {
      try {
        const res = await fetch(`${API_BASE}/api/finance/documents/${id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`
          }
        });

        if (!res.ok) throw new Error("Erreur suppression");

        setDocuments(documents.filter(d => d.id !== id));
        toast({
          title: "Succès",
          description: "Document supprimé",
          status: "success"
        });
        // Recharger les données pour synchroniser avec le serveur
        await loadFinanceData();
      } catch (error) {
        toast({
          title: "Erreur",
          description: error.message,
          status: "error"
        });
      }
    },
    [documents, toast]
  );

  // Charger les données au montage
  useEffect(() => {
    loadFinanceData();
  }, []);

  // Mettre à jour le solde (avec permissions)
  const updateBalance = useCallback(
    async (newBalanceValue, reason = "") => {
      // MÉTIER: Vérifier les permissions
      if (!canModifyBalance(userRole)) {
        toast({
          title: "Permission refusee",
          description: "Vous n'avez pas le droit de modifier le solde",
          status: "error"
        });
        return false;
      }

      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/api/finance/balance`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`
          },
          body: JSON.stringify({
            balance: parseFloat(newBalanceValue),
            reason: reason || "Modification manuelle"
          })
        });

        if (!res.ok) throw new Error("Erreur mise a jour solde");

        setBalance(parseFloat(newBalanceValue));
        toast({
          title: "Succes",
          description: "Solde mis a jour",
          status: "success"
        });
        // Recharger les données pour synchroniser avec le serveur
        await loadFinanceData();
        return true;
      } catch (error) {
        toast({
          title: "Erreur",
          description: error.message,
          status: "error"
        });
        return false;
      } finally {
        setLoading(false);
      }
    },
    [userRole, toast]
  );

  // Approuver une opération programmée
  const approveScheduledOperation = useCallback(
    async (operationId) => {
      // MÉTIER: Vérifier les permissions
      if (!canApprovePayments(userRole)) {
        toast({
          title: "Permission refusee",
          description: "Vous n'avez pas le droit d'approuver",
          status: "error"
        });
        return false;
      }

      try {
        setLoading(true);
        const res = await fetch(
          `${API_BASE}/api/finance/scheduled-operations/${operationId}/approve`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`
            }
          }
        );

        if (!res.ok) throw new Error("Erreur approbation");

        setScheduledOperations(
          scheduledOperations.map(op =>
            op.id === operationId ? { ...op, status: "APPROVED" } : op
          )
        );
        toast({
          title: "Succes",
          description: "Operation approuvee",
          status: "success"
        });
        // Recharger les données pour synchroniser avec le serveur
        await loadFinanceData();
        return true;
      } catch (error) {
        toast({
          title: "Erreur",
          description: error.message,
          status: "error"
        });
        return false;
      } finally {
        setLoading(false);
      }
    },
    [userRole, scheduledOperations, toast]
  );

  // Mettre à jour le statut d'un document
  const updateDocumentStatus = useCallback(
    async (documentId, newStatus) => {
      try {
        const res = await fetch(`${API_BASE}/api/finance/documents/${documentId}/status`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`
          },
          body: JSON.stringify({ status: newStatus })
        });

        if (!res.ok) throw new Error("Erreur mise à jour statut");

        const updatedDoc = await res.json();
        
        // 🔄 Message spécial si transaction auto-créée
        let description = "Statut mis à jour";
        if (updatedDoc.transactionCreated) {
          description = `✅ Statut mis à jour + Transaction créée (${updatedDoc.transactionAmount}€)`;
        } else if (updatedDoc.transactionError) {
          description = `⚠️ Statut mis à jour, mais erreur transaction: ${updatedDoc.transactionError}`;
        }
        
        toast({
          title: "Succès",
          description,
          status: updatedDoc.transactionError ? "warning" : "success"
        });
        // Recharger les données pour synchroniser
        await loadFinanceData();
        return updatedDoc;
      } catch (error) {
        toast({
          title: "Erreur",
          description: error.message,
          status: "error"
        });
        return null;
      }
    },
    [toast]
  );

  // ===== NOTES DE FRAIS =====
  const createExpenseReport = useCallback(
    async (report) => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/api/finance/expense-reports`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`
          },
          body: JSON.stringify(report)
        });

        if (!res.ok) throw new Error("Erreur création");

        const newReport = await res.json();
        setExpenseReports([...expenseReports, newReport]);
        toast({
          title: "Succès",
          description: "Note de frais créée",
          status: "success"
        });
        return newReport;
      } catch (error) {
        toast({
          title: "Erreur",
          description: error.message,
          status: "error"
        });
        return null;
      } finally {
        setLoading(false);
      }
    },
    [expenseReports, toast]
  );

  const updateExpenseReport = useCallback(
    async (id, updates) => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/api/finance/expense-reports/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`
          },
          body: JSON.stringify(updates)
        });

        if (!res.ok) throw new Error("Erreur mise à jour");

        const updated = await res.json();
        setExpenseReports(expenseReports.map(r => r.id === id ? updated : r));
        toast({
          title: "Succès",
          description: "Note de frais mise à jour",
          status: "success"
        });
        return updated;
      } catch (error) {
        toast({
          title: "Erreur",
          description: error.message,
          status: "error"
        });
        return null;
      } finally {
        setLoading(false);
      }
    },
    [expenseReports, toast]
  );

  const deleteExpenseReport = useCallback(
    async (id) => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/api/finance/expense-reports/${id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`
          }
        });

        if (!res.ok) throw new Error("Erreur suppression");

        setExpenseReports(expenseReports.filter(r => r.id !== id));
        toast({
          title: "Succès",
          description: "Note de frais supprimée",
          status: "success"
        });
      } catch (error) {
        toast({
          title: "Erreur",
          description: error.message,
          status: "error"
        });
      } finally {
        setLoading(false);
      }
    },
    [expenseReports, toast]
  );

  // ===== SIMULATIONS =====
  const createSimulationScenario = useCallback(
    async (scenario) => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/api/finance/simulations`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`
          },
          body: JSON.stringify(scenario)
        });

        if (!res.ok) throw new Error("Erreur création simulation");

        const newScenario = await res.json();
        setSimulationData({
          ...simulationData,
          scenarios: [...simulationData.scenarios, newScenario]
        });
        toast({
          title: "Succès",
          description: "Scénario de simulation créé",
          status: "success"
        });
        return newScenario;
      } catch (error) {
        toast({
          title: "Erreur",
          description: error.message,
          status: "error"
        });
        return null;
      } finally {
        setLoading(false);
      }
    },
    [simulationData, toast]
  );

  const runSimulation = useCallback(
    async (scenarioId) => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/api/finance/simulations/${scenarioId}/run`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`
          }
        });

        if (!res.ok) throw new Error("Erreur simulation");

        const results = await res.json();
        setSimulationData({
          ...simulationData,
          activeScenario: scenarioId
        });
        return results;
      } catch (error) {
        toast({
          title: "Erreur",
          description: error.message,
          status: "error"
        });
        return null;
      } finally {
        setLoading(false);
      }
    },
    [simulationData, toast]
  );

  const deleteSimulationScenario = useCallback(
    async (scenarioId) => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/api/finance/simulations/${scenarioId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`
          }
        });

        if (!res.ok) throw new Error("Erreur suppression");

        setSimulationData({
          ...simulationData,
          scenarios: simulationData.scenarios.filter(s => s.id !== scenarioId)
        });
        toast({
          title: "Succès",
          description: "Scénario supprimé",
          status: "success"
        });
      } catch (error) {
        toast({
          title: "Erreur",
          description: error.message,
          status: "error"
        });
      } finally {
        setLoading(false);
      }
    },
    [simulationData, toast]
  );

  // ===== RAPPORTS =====
  const loadReports = useCallback(
    async (year) => {
      try {
        setLoading(true);
        const res = await fetch(
          `${API_BASE}/api/finance/reports?year=${year}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`
            }
          }
        );

        if (!res.ok) throw new Error("Erreur chargement rapports");

        const data = await res.json();
        setReportData(data);
        return data;
      } catch (error) {
        toast({
          title: "Erreur",
          description: error.message,
          status: "error"
        });
        return null;
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  const exportReportPdf = useCallback(
    async (year) => {
      try {
        setLoading(true);
        const res = await fetch(
          `${API_BASE}/api/finance/reports/${year}/export`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`
            }
          }
        );

        if (!res.ok) throw new Error("Erreur export");

        // Créer un blob et télécharger
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `rapport-finance-${year}.pdf`;
        a.click();

        toast({
          title: "Succès",
          description: "Rapport téléchargé",
          status: "success"
        });
      } catch (error) {
        toast({
          title: "Erreur",
          description: error.message,
          status: "error"
        });
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  return {
    loading,
    loadFinanceData,
    // Transactions
    transactions,
    setTransactions,
    newTransaction,
    setNewTransaction,
    addTransaction,
    deleteTransaction,
    // Documents
    documents,
    setDocuments,
    editingDocument,
    setEditingDocument,
    docForm,
    setDocForm,
    addDocument,
    deleteDocument,
    updateDocumentStatus,
    // Opérations programmées
    scheduledOperations,
    setScheduledOperations,
    newScheduled,
    setNewScheduled,
    approveScheduledOperation,
    // Notes de frais
    expenseReports,
    setExpenseReports,
    newExpenseReport,
    setNewExpenseReport,
    createExpenseReport,
    updateExpenseReport,
    deleteExpenseReport,
    // Simulations
    simulationData,
    setSimulationData,
    createSimulationScenario,
    runSimulation,
    deleteSimulationScenario,
    // Rapports
    reportYear,
    setReportYear,
    reportData,
    setReportData,
    loadReports,
    exportReportPdf,
    // Configuration
    balance,
    setBalance,
    updateBalance,
    isBalanceLocked,
    setIsBalanceLocked,
    stats,
    setStats,
    // Permissions
    userRole,
    canModifyBalance: canModifyBalance(userRole),
    canApprovePayments: canApprovePayments(userRole)
  };
};
