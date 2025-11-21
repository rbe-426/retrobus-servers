import React from "react";
import {
  FiDollarSign,
  FiTrendingUp,
  FiBarChart,
  FiCalendar,
  FiCreditCard,
  FiSettings,
  FiFileText
} from "react-icons/fi";

import WorkspaceLayout from "../components/Layout/WorkspaceLayout";
import FinanceDashboard from "../components/Finance/Dashboard";
import FinanceTransactions from "../components/Finance/Transactions";
import FinanceScheduledOps from "../components/Finance/ScheduledOperations";
import FinanceQuotes from "../components/Finance/Quotes";
import FinanceInvoicing from "../components/Finance/Invoicing";
import FinanceReports from "../components/Finance/Reports";
import FinanceSettings from "../components/Finance/Settings";

/**
 * FinanceNew - Nouvelle page Finance avec sidebar navigation
 * Architecture modulaire pour meilleure organisation
 */
const FinanceNew = () => {
  const sections = [
    { id: "dashboard", label: "Tableau de bord", icon: FiBarChart, render: () => <FinanceDashboard /> },
    { id: "transactions", label: "Transactions", icon: FiCreditCard, render: () => <FinanceTransactions /> },
    { id: "scheduled", label: "Opérations programmées", icon: FiCalendar, render: () => <FinanceScheduledOps /> },
    { id: "invoicing", label: "Facturation", icon: FiFileText, render: () => <FinanceInvoicing /> },
    { id: "reports", label: "Rapports & KPI", icon: FiTrendingUp, render: () => <FinanceReports /> },
    { id: "settings", label: "Paramètres", icon: FiSettings, render: () => <FinanceSettings /> }
  ];

  return (
    <WorkspaceLayout
      title="Gestion financière"
      subtitle="Recettes, dépenses, devis et factures"
      sections={sections}
      defaultSectionId="dashboard"
      sidebarTitle="Finances"
      sidebarSubtitle="Pilotage budgétaire"
      sidebarTitleIcon={FiDollarSign}
      versionLabel="Finance v2"
    />
  );
};

export default FinanceNew;
