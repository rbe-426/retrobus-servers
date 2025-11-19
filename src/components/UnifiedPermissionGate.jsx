/**
 * Composant unifié pour contrôler l'accès basé sur les permissions
 * 
 * Usage:
 * <PermissionGate function="vehicles.view">
 *   <button>Voir les véhicules</button>
 * </PermissionGate>
 * 
 * <PermissionGate any={["vehicles.view", "vehicles.edit"]}>
 *   <button>Voir ou modifier</button>
 * </PermissionGate>
 * 
 * <PermissionGate all={["vehicles.create", "vehicles.approve"]}>
 *   <button>Créer et approuver</button>
 * </PermissionGate>
 */

import React from 'react';
import useUnifiedPermissions from '../hooks/useUnifiedPermissions';

/**
 * PermissionGate: Masquer du contenu si l'utilisateur n'a pas les permissions
 */
export function PermissionGate({ 
  function: functionId, 
  any, 
  all,
  fallback = null,
  children 
}) {
  const { canAccess, canAccessAny, canAccessAll, loading } = useUnifiedPermissions();

  if (loading) {
    return fallback;
  }

  let hasPermission = false;

  if (functionId) {
    // Vérifier une seule fonction
    hasPermission = canAccess(functionId);
  } else if (any) {
    // Vérifier au moins une des fonctions
    hasPermission = canAccessAny(any);
  } else if (all) {
    // Vérifier TOUTES les fonctions
    hasPermission = canAccessAll(all);
  }

  return hasPermission ? children : fallback;
}

/**
 * AllPermissionsRequired: Nécessite TOUTES les permissions
 */
export function AllPermissionsRequired({ functions, fallback = null, children }) {
  return (
    <PermissionGate all={functions} fallback={fallback}>
      {children}
    </PermissionGate>
  );
}

/**
 * AnyPermissionRequired: Nécessite AU MOINS une permission
 */
export function AnyPermissionRequired({ functions, fallback = null, children }) {
  return (
    <PermissionGate any={functions} fallback={fallback}>
      {children}
    </PermissionGate>
  );
}

/**
 * PermissionFallback: Afficher quand l'utilisateur n'a pas les permissions
 */
export function PermissionFallback({ message = "Vous n'avez pas les permissions pour accéder à cette ressource" }) {
  return (
    <div className="permission-denied" style={{
      padding: '20px',
      backgroundColor: '#f8f9fa',
      border: '1px solid #dee2e6',
      borderRadius: '4px',
      color: '#6c757d',
      textAlign: 'center'
    }}>
      <p>🔒 {message}</p>
    </div>
  );
}

export default PermissionGate;
