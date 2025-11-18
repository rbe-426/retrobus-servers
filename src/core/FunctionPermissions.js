/**
 * MATRICE DES AUTORISATIONS INDIVIDUELLES PAR FONCTION (Frontend)
 * Miroir de la configuration backend pour une cohérence garantie
 */

export const FUNCTIONS = {
  // ========== VÉHICULES ==========
  VEHICLES_VIEW: 'vehicles.view',
  VEHICLES_CREATE: 'vehicles.create',
  VEHICLES_EDIT: 'vehicles.edit',
  VEHICLES_DELETE: 'vehicles.delete',
  VEHICLES_MAINTENANCE: 'vehicles.maintenance',
  VEHICLES_USAGE: 'vehicles.usage',

  // ========== PLANNING/CALENDRIER ==========
  PLANNING_VIEW: 'planning.view',
  PLANNING_CREATE: 'planning.create',
  PLANNING_EDIT: 'planning.edit',
  PLANNING_DELETE: 'planning.delete',
  PLANNING_ASSIGN: 'planning.assign',

  // ========== TICKETS/RETRO-DEMANDES ==========
  TICKETS_VIEW: 'tickets.view',
  TICKETS_CREATE: 'tickets.create',
  TICKETS_RESPOND: 'tickets.respond',
  TICKETS_CLOSE: 'tickets.close',
  TICKETS_MANAGE: 'tickets.manage',

  // ========== DEMANDES ==========
  RETRODEMANDES_VIEW: 'retrodemandes.view',
  RETRODEMANDES_CREATE: 'retrodemandes.create',
  RETRODEMANDES_EDIT: 'retrodemandes.edit',
  RETRODEMANDES_APPROVE: 'retrodemandes.approve',
  RETRODEMANDES_RECAP: 'retrodemandes.recap',

  // ========== RETROMAIL ==========
  RETROMAIL_VIEW: 'retromail.view',
  RETROMAIL_SEND: 'retromail.send',
  RETROMAIL_READ: 'retromail.read',
  RETROMAIL_DELETE: 'retromail.delete',

  // ========== FINANCES ==========
  FINANCE_VIEW: 'finance.view',
  FINANCE_CREATE: 'finance.create',
  FINANCE_EDIT: 'finance.edit',
  FINANCE_DELETE: 'finance.delete',
  FINANCE_REPORT: 'finance.report',

  // ========== ÉVÉNEMENTS ==========
  EVENTS_VIEW: 'events.view',
  EVENTS_CREATE: 'events.create',
  EVENTS_EDIT: 'events.edit',
  EVENTS_DELETE: 'events.delete',
  EVENTS_PARTICIPANTS: 'events.participants',

  // ========== ADHÉSIONS/MEMBRES ==========
  MEMBERS_VIEW: 'members.view',
  MEMBERS_CREATE: 'members.create',
  MEMBERS_EDIT: 'members.edit',
  MEMBERS_DELETE: 'members.delete',
  MEMBERS_PAYMENTS: 'members.payments',
  MEMBERS_DOCUMENTS: 'members.documents',

  // ========== STOCKS ==========
  STOCK_VIEW: 'stock.view',
  STOCK_CREATE: 'stock.create',
  STOCK_EDIT: 'stock.edit',
  STOCK_DELETE: 'stock.delete',
  STOCK_TRANSFER: 'stock.transfer',

  // ========== NEWSLETTER ==========
  NEWSLETTER_VIEW: 'newsletter.view',
  NEWSLETTER_CREATE: 'newsletter.create',
  NEWSLETTER_SEND: 'newsletter.send',
  NEWSLETTER_SUBSCRIBERS: 'newsletter.subscribers',

  // ========== GESTION DU SITE ==========
  SITE_VIEW: 'site.view',
  SITE_EDIT: 'site.edit',
  SITE_CONFIG: 'site.config',
  SITE_CHANGELOG: 'site.changelog',

  // ========== GESTION DES PERMISSIONS ==========
  PERMISSIONS_VIEW: 'permissions.view',
  PERMISSIONS_EDIT: 'permissions.edit',
  PERMISSIONS_ADMIN: 'permissions.admin',

  // ========== RAPPORTS ET STATISTIQUES ==========
  REPORTS_VIEW: 'reports.view',
  REPORTS_GENERATE: 'reports.generate',
  REPORTS_EXPORT: 'reports.export',

  // ========== SUPPORT ==========
  SUPPORT_VIEW: 'support.view',
  SUPPORT_RESPOND: 'support.respond',
  SUPPORT_MANAGE: 'support.manage',
};

export const FUNCTION_GROUPS = {
  GROUPE_ADMIN: Object.values(FUNCTIONS),

  GROUPE_MANAGER: [
    FUNCTIONS.VEHICLES_VIEW,
    FUNCTIONS.VEHICLES_EDIT,
    FUNCTIONS.VEHICLES_MAINTENANCE,
    FUNCTIONS.PLANNING_VIEW,
    FUNCTIONS.PLANNING_CREATE,
    FUNCTIONS.PLANNING_EDIT,
    FUNCTIONS.PLANNING_ASSIGN,
    FUNCTIONS.TICKETS_MANAGE,
    FUNCTIONS.RETRODEMANDES_VIEW,
    FUNCTIONS.RETRODEMANDES_APPROVE,
    FUNCTIONS.FINANCE_VIEW,
    FUNCTIONS.FINANCE_CREATE,
    FUNCTIONS.EVENTS_VIEW,
    FUNCTIONS.EVENTS_CREATE,
    FUNCTIONS.EVENTS_EDIT,
    FUNCTIONS.MEMBERS_VIEW,
    FUNCTIONS.MEMBERS_EDIT,
    FUNCTIONS.STOCK_VIEW,
    FUNCTIONS.NEWSLETTER_VIEW,
    FUNCTIONS.REPORTS_VIEW,
  ],

  GROUPE_OPERATEUR: [
    FUNCTIONS.VEHICLES_VIEW,
    FUNCTIONS.VEHICLES_CREATE,
    FUNCTIONS.VEHICLES_USAGE,
    FUNCTIONS.PLANNING_VIEW,
    FUNCTIONS.PLANNING_CREATE,
    FUNCTIONS.TICKETS_VIEW,
    FUNCTIONS.TICKETS_CREATE,
    FUNCTIONS.TICKETS_RESPOND,
    FUNCTIONS.RETRODEMANDES_VIEW,
    FUNCTIONS.RETRODEMANDES_CREATE,
    FUNCTIONS.EVENTS_VIEW,
    FUNCTIONS.STOCK_VIEW,
    FUNCTIONS.RETROMAIL_VIEW,
    FUNCTIONS.RETROMAIL_SEND,
  ],

  GROUPE_VOLUNTEER: [
    FUNCTIONS.VEHICLES_VIEW,
    FUNCTIONS.PLANNING_VIEW,
    FUNCTIONS.EVENTS_VIEW,
    FUNCTIONS.MEMBERS_VIEW,
    FUNCTIONS.STOCK_VIEW,
    FUNCTIONS.RETROMAIL_VIEW,
    FUNCTIONS.RETROMAIL_READ,
  ],

  GROUPE_CLIENT: [
    FUNCTIONS.RETRODEMANDES_VIEW,
    FUNCTIONS.RETRODEMANDES_CREATE,
    FUNCTIONS.RETRODEMANDES_EDIT,
    FUNCTIONS.TICKETS_VIEW,
    FUNCTIONS.TICKETS_CREATE,
    FUNCTIONS.TICKETS_RESPOND,
  ],

  GROUPE_PARTENAIRE: [],
};

export const FUNCTION_DESCRIPTIONS = {
  // Véhicules
  [FUNCTIONS.VEHICLES_VIEW]: { module: 'Véhicules', name: 'Voir', description: 'Voir les véhicules' },
  [FUNCTIONS.VEHICLES_CREATE]: { module: 'Véhicules', name: 'Créer', description: 'Créer un véhicule' },
  [FUNCTIONS.VEHICLES_EDIT]: { module: 'Véhicules', name: 'Modifier', description: 'Modifier un véhicule' },
  [FUNCTIONS.VEHICLES_DELETE]: { module: 'Véhicules', name: 'Supprimer', description: 'Supprimer un véhicule' },
  [FUNCTIONS.VEHICLES_MAINTENANCE]: { module: 'Véhicules', name: 'Maintenance', description: 'Gérer la maintenance' },
  [FUNCTIONS.VEHICLES_USAGE]: { module: 'Véhicules', name: 'Usages', description: 'Enregistrer les usages' },

  // Planning
  [FUNCTIONS.PLANNING_VIEW]: { module: 'Planning', name: 'Voir', description: 'Voir le planning' },
  [FUNCTIONS.PLANNING_CREATE]: { module: 'Planning', name: 'Créer', description: 'Créer un événement' },
  [FUNCTIONS.PLANNING_EDIT]: { module: 'Planning', name: 'Modifier', description: 'Modifier un événement' },
  [FUNCTIONS.PLANNING_DELETE]: { module: 'Planning', name: 'Supprimer', description: 'Supprimer un événement' },
  [FUNCTIONS.PLANNING_ASSIGN]: { module: 'Planning', name: 'Assigner', description: 'Assigner des ressources' },

  // Tickets
  [FUNCTIONS.TICKETS_VIEW]: { module: 'Tickets', name: 'Voir', description: 'Voir les tickets' },
  [FUNCTIONS.TICKETS_CREATE]: { module: 'Tickets', name: 'Créer', description: 'Créer un ticket' },
  [FUNCTIONS.TICKETS_RESPOND]: { module: 'Tickets', name: 'Répondre', description: 'Répondre aux tickets' },
  [FUNCTIONS.TICKETS_CLOSE]: { module: 'Tickets', name: 'Fermer', description: 'Fermer un ticket' },
  [FUNCTIONS.TICKETS_MANAGE]: { module: 'Tickets', name: 'Gérer', description: 'Gérer tous les tickets' },

  // Demandes
  [FUNCTIONS.RETRODEMANDES_VIEW]: { module: 'Demandes', name: 'Voir', description: 'Voir les demandes' },
  [FUNCTIONS.RETRODEMANDES_CREATE]: { module: 'Demandes', name: 'Créer', description: 'Créer une demande' },
  [FUNCTIONS.RETRODEMANDES_EDIT]: { module: 'Demandes', name: 'Modifier', description: 'Modifier une demande' },
  [FUNCTIONS.RETRODEMANDES_APPROVE]: { module: 'Demandes', name: 'Approuver', description: 'Approuver une demande' },
  [FUNCTIONS.RETRODEMANDES_RECAP]: { module: 'Demandes', name: 'Récap', description: 'Voir le récapitulatif' },

  // RetroMail
  [FUNCTIONS.RETROMAIL_VIEW]: { module: 'RetroMail', name: 'Accès', description: 'Accéder à RetroMail' },
  [FUNCTIONS.RETROMAIL_SEND]: { module: 'RetroMail', name: 'Envoyer', description: 'Envoyer des messages' },
  [FUNCTIONS.RETROMAIL_READ]: { module: 'RetroMail', name: 'Lire', description: 'Lire les messages' },
  [FUNCTIONS.RETROMAIL_DELETE]: { module: 'RetroMail', name: 'Supprimer', description: 'Supprimer les messages' },

  // Finances
  [FUNCTIONS.FINANCE_VIEW]: { module: 'Finances', name: 'Voir', description: 'Voir les finances' },
  [FUNCTIONS.FINANCE_CREATE]: { module: 'Finances', name: 'Créer', description: 'Créer une transaction' },
  [FUNCTIONS.FINANCE_EDIT]: { module: 'Finances', name: 'Modifier', description: 'Modifier une transaction' },
  [FUNCTIONS.FINANCE_DELETE]: { module: 'Finances', name: 'Supprimer', description: 'Supprimer une transaction' },
  [FUNCTIONS.FINANCE_REPORT]: { module: 'Finances', name: 'Rapports', description: 'Générer des rapports' },

  // Événements
  [FUNCTIONS.EVENTS_VIEW]: { module: 'Événements', name: 'Voir', description: 'Voir les événements' },
  [FUNCTIONS.EVENTS_CREATE]: { module: 'Événements', name: 'Créer', description: 'Créer un événement' },
  [FUNCTIONS.EVENTS_EDIT]: { module: 'Événements', name: 'Modifier', description: 'Modifier un événement' },
  [FUNCTIONS.EVENTS_DELETE]: { module: 'Événements', name: 'Supprimer', description: 'Supprimer un événement' },
  [FUNCTIONS.EVENTS_PARTICIPANTS]: { module: 'Événements', name: 'Participants', description: 'Gérer les participants' },

  // Membres
  [FUNCTIONS.MEMBERS_VIEW]: { module: 'Membres', name: 'Voir', description: 'Voir les membres' },
  [FUNCTIONS.MEMBERS_CREATE]: { module: 'Membres', name: 'Créer', description: 'Créer un membre' },
  [FUNCTIONS.MEMBERS_EDIT]: { module: 'Membres', name: 'Modifier', description: 'Modifier un membre' },
  [FUNCTIONS.MEMBERS_DELETE]: { module: 'Membres', name: 'Supprimer', description: 'Supprimer un membre' },
  [FUNCTIONS.MEMBERS_PAYMENTS]: { module: 'Membres', name: 'Cotisations', description: 'Gérer les cotisations' },
  [FUNCTIONS.MEMBERS_DOCUMENTS]: { module: 'Membres', name: 'Documents', description: 'Gérer les documents' },

  // Stocks
  [FUNCTIONS.STOCK_VIEW]: { module: 'Stocks', name: 'Voir', description: 'Voir les stocks' },
  [FUNCTIONS.STOCK_CREATE]: { module: 'Stocks', name: 'Créer', description: 'Ajouter du stock' },
  [FUNCTIONS.STOCK_EDIT]: { module: 'Stocks', name: 'Modifier', description: 'Modifier le stock' },
  [FUNCTIONS.STOCK_DELETE]: { module: 'Stocks', name: 'Supprimer', description: 'Supprimer du stock' },
  [FUNCTIONS.STOCK_TRANSFER]: { module: 'Stocks', name: 'Transférer', description: 'Transférer le stock' },

  // Newsletter
  [FUNCTIONS.NEWSLETTER_VIEW]: { module: 'Newsletter', name: 'Voir', description: 'Voir les newsletters' },
  [FUNCTIONS.NEWSLETTER_CREATE]: { module: 'Newsletter', name: 'Créer', description: 'Créer une newsletter' },
  [FUNCTIONS.NEWSLETTER_SEND]: { module: 'Newsletter', name: 'Envoyer', description: 'Envoyer une newsletter' },
  [FUNCTIONS.NEWSLETTER_SUBSCRIBERS]: { module: 'Newsletter', name: 'Abonnés', description: 'Gérer les abonnés' },

  // Site
  [FUNCTIONS.SITE_VIEW]: { module: 'Site', name: 'Voir', description: 'Voir la gestion du site' },
  [FUNCTIONS.SITE_EDIT]: { module: 'Site', name: 'Modifier', description: 'Modifier le contenu' },
  [FUNCTIONS.SITE_CONFIG]: { module: 'Site', name: 'Config', description: 'Configurer le site' },
  [FUNCTIONS.SITE_CHANGELOG]: { module: 'Site', name: 'Changelog', description: 'Gérer le changelog' },

  // Permissions
  [FUNCTIONS.PERMISSIONS_VIEW]: { module: 'Permissions', name: 'Voir', description: 'Voir les permissions' },
  [FUNCTIONS.PERMISSIONS_EDIT]: { module: 'Permissions', name: 'Modifier', description: 'Modifier les permissions' },
  [FUNCTIONS.PERMISSIONS_ADMIN]: { module: 'Permissions', name: 'Admin', description: 'Accès admin complet' },

  // Rapports
  [FUNCTIONS.REPORTS_VIEW]: { module: 'Rapports', name: 'Voir', description: 'Voir les rapports' },
  [FUNCTIONS.REPORTS_GENERATE]: { module: 'Rapports', name: 'Générer', description: 'Générer des rapports' },
  [FUNCTIONS.REPORTS_EXPORT]: { module: 'Rapports', name: 'Exporter', description: 'Exporter les données' },

  // Support
  [FUNCTIONS.SUPPORT_VIEW]: { module: 'Support', name: 'Voir', description: 'Voir le support' },
  [FUNCTIONS.SUPPORT_RESPOND]: { module: 'Support', name: 'Répondre', description: 'Répondre aux tickets' },
  [FUNCTIONS.SUPPORT_MANAGE]: { module: 'Support', name: 'Gérer', description: 'Gérer le support' },
};

export const ROLE_FUNCTION_DEFAULTS = {
  'ADMIN': FUNCTION_GROUPS.GROUPE_ADMIN,
  'MANAGER': FUNCTION_GROUPS.GROUPE_MANAGER,
  'OPERATOR': FUNCTION_GROUPS.GROUPE_OPERATEUR,
  'VOLUNTEER': FUNCTION_GROUPS.GROUPE_VOLUNTEER,
  'CLIENT': FUNCTION_GROUPS.GROUPE_CLIENT,
  'PARTENAIRE': FUNCTION_GROUPS.GROUPE_PARTENAIRE,
};
