import React, { createContext, useContext } from 'react';
import { usePermissions } from '../hooks/usePermissions';

/**
 * Context pour les permissions
 * Fournit accès unifié aux permissions dans l'app
 */
const PermissionsContext = createContext(null);

/**
 * Provider pour les permissions
 * À mettre en haut de l'app, après l'authentification
 */
export function PermissionsProvider({ userId, children }) {
  const permissions = usePermissions(userId);

  return (
    <PermissionsContext.Provider value={permissions}>
      {children}
    </PermissionsContext.Provider>
  );
}

/**
 * Hook pour accéder au contexte des permissions
 * 
 * Usage dans un composant:
 * const { hasPermission, permissions, loading } = usePermissionsContext();
 */
export function usePermissionsContext() {
  const context = useContext(PermissionsContext);
  
  if (!context) {
    console.warn('usePermissionsContext must be used within PermissionsProvider');
    return {
      permissions: [],
      loading: false,
      error: null,
      hasPermission: () => false,
      hasResourceAccess: () => false,
      invalidateCache: () => {},
      checkPermissionDirect: async () => false
    };
  }
  
  return context;
}

export default PermissionsContext;
