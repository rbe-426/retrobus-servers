/**
 * Utilitaires unifiés pour vérifier les permissions
 * À utiliser partout dans l'app à la place de permissions.js ou roles.js
 */

/**
 * Toutes les ressources disponibles
 * Doit correspondre exactement avec le backend PermissionCore.js
 */
export const RESOURCES = {
  VEHICLES: 'VEHICLES',
  PLANNING: 'PLANNING',
  RETRODEMANDES: 'RETRODEMANDES',
  RETRODEMANDES_RECAP: 'RETRODEMANDES_RECAP',
  RETROMAIL: 'RETROMAIL',
  RETROSUPPORT: 'RETROSUPPORT',
  FINANCE: 'FINANCE',
  EVENTS: 'EVENTS',
  MEMBERS: 'MEMBERS',
  STOCK: 'STOCK',
  NEWSLETTER: 'NEWSLETTER',
  SITE_MANAGEMENT: 'SITE_MANAGEMENT',
  PERMISSIONS_MANAGEMENT: 'PERMISSIONS_MANAGEMENT'
};

export const ACTIONS = {
  READ: 'READ',
  CREATE: 'CREATE',
  EDIT: 'EDIT',
  DELETE: 'DELETE'
};

export const ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  OPERATOR: 'OPERATOR',
  VOLUNTEER: 'VOLUNTEER',
  CLIENT: 'CLIENT',
  PARTENAIRE: 'PARTENAIRE'
};

/**
 * Helper pour vérifier les permissions dans les composants
 * 
 * Usage:
 * const canDelete = canUserAccess(permissions, 'VEHICLES', 'DELETE');
 */
export function canUserAccess(permissions, resource, action = 'READ') {
  if (!Array.isArray(permissions)) return false;
  
  const perm = permissions.find(p => p.resource === resource);
  if (!perm) return false;
  
  const actions = Array.isArray(perm.actions) ? perm.actions : [];
  return actions.includes(action);
}

/**
 * Helper pour vérifier si l'utilisateur a accès à au moins une des ressources
 * 
 * Usage:
 * const canManageData = hasAnyAccess(permissions, ['VEHICLES', 'PLANNING']);
 */
export function hasAnyAccess(permissions, resources) {
  if (!Array.isArray(permissions)) return false;
  return resources.some(resource => 
    permissions.some(p => p.resource === resource)
  );
}

/**
 * Helper pour obtenir les actions d'une ressource
 * 
 * Usage:
 * const actions = getResourceActions(permissions, 'VEHICLES');
 */
export function getResourceActions(permissions, resource) {
  if (!Array.isArray(permissions)) return [];
  
  const perm = permissions.find(p => p.resource === resource);
  return perm ? (Array.isArray(perm.actions) ? perm.actions : []) : [];
}

/**
 * Helper pour lister toutes les ressources accessibles
 * 
 * Usage:
 * const accessible = getAccessibleResources(permissions);
 */
export function getAccessibleResources(permissions) {
  if (!Array.isArray(permissions)) return [];
  return permissions.map(p => p.resource);
}

/**
 * Helper pour vérifier si c'est un admin
 */
export function isAdmin(user) {
  return user?.role === ROLES.ADMIN || user?.roles?.includes(ROLES.ADMIN);
}

/**
 * Helper pour vérifier si c'est un partenaire
 */
export function isPartner(user) {
  return user?.role === ROLES.PARTENAIRE;
}

/**
 * Helper pour vérifier si c'est un client
 */
export function isClient(user) {
  return user?.role === ROLES.CLIENT;
}

export default {
  RESOURCES,
  ACTIONS,
  ROLES,
  canUserAccess,
  hasAnyAccess,
  getResourceActions,
  getAccessibleResources,
  isAdmin,
  isPartner,
  isClient
};
