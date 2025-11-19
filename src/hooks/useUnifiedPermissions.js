/**
 * Hook React unifié pour les permissions
 * Consomme L'API UNIFIÉE /api/permissions/
 * 
 * Usage:
 * const { permissions, canAccess, loading } = useUnifiedPermissions();
 * if (canAccess('vehicles.view')) { ... }
 */

import { useContext, useEffect, useState, useCallback } from 'react';
import { UserContext } from '../context/UserContext';
import apiClient from '../api/client';

// Durée du cache en ms (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

// Singleton pour cache global
let permissionCache = {
  data: null,
  timestamp: 0,
  userId: null
};

export function useUnifiedPermissions() {
  const { user } = useContext(UserContext);
  const [permissions, setPermissions] = useState(null);
  const [definitions, setDefinitions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Vérifier si les permissions sont en cache
  const isCacheValid = useCallback(() => {
    if (!permissionCache.data || !user?.id) return false;
    if (permissionCache.userId !== user.id) return false;
    return Date.now() - permissionCache.timestamp < CACHE_DURATION;
  }, [user?.id]);

  // Charger les permissions
  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    // Vérifier le cache d'abord
    if (isCacheValid()) {
      setPermissions(permissionCache.data);
      setLoading(false);
      return;
    }

    // Sinon fetch depuis l'API
    const fetchPermissions = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await apiClient.get('/api/permissions/my-permissions');
        
        // Cacher les permissions
        permissionCache.data = response.data;
        permissionCache.timestamp = Date.now();
        permissionCache.userId = user.id;

        setPermissions(response.data);
      } catch (err) {
        console.error('Error loading permissions:', err);
        setError(err?.response?.data?.error || 'Erreur de chargement des permissions');
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [user?.id, isCacheValid]);

  // Charger les définitions (une seule fois)
  useEffect(() => {
    if (definitions) return;

    const fetchDefinitions = async () => {
      try {
        const response = await apiClient.get('/api/permissions/definitions');
        setDefinitions(response.data);
      } catch (err) {
        console.warn('Error loading permission definitions:', err);
      }
    };

    fetchDefinitions();
  }, [definitions]);

  // Vérifier si l'utilisateur peut accéder à une fonction
  const canAccess = useCallback((functionId) => {
    if (!permissions) return false;
    return permissions.effectivePermissions.functions.includes(functionId);
  }, [permissions]);

  // Vérifier si l'utilisateur a au moins une des fonctions
  const canAccessAny = useCallback((functionIds) => {
    if (!permissions) return false;
    return functionIds.some(fn => permissions.effectivePermissions.functions.includes(fn));
  }, [permissions]);

  // Vérifier si l'utilisateur a TOUTES les fonctions
  const canAccessAll = useCallback((functionIds) => {
    if (!permissions) return false;
    return functionIds.every(fn => permissions.effectivePermissions.functions.includes(fn));
  }, [permissions]);

  // Obtenir la description d'une fonction
  const getFunctionDescription = useCallback((functionId) => {
    if (!definitions) return null;
    return definitions.functionDescriptions?.[functionId];
  }, [definitions]);

  // Rafraîchir les permissions manuellement (ex: après logout)
  const refresh = useCallback(() => {
    permissionCache.data = null;
    permissionCache.timestamp = 0;
    permissionCache.userId = null;
    setPermissions(null);
  }, []);

  return {
    // État
    permissions,
    definitions,
    loading,
    error,
    
    // Vérifications
    canAccess,
    canAccessAny,
    canAccessAll,
    
    // Utilitaires
    getFunctionDescription,
    refresh,
    
    // Stats
    totalFunctions: permissions?.effectivePermissions.count || 0,
    isAdmin: permissions?.info.isAdmin || false,
    isManager: permissions?.info.isManager || false,
    role: permissions?.role || null,
    
    // Données brutes
    rolePermissions: permissions?.rolePermissions.functions || [],
    customPermissions: permissions?.customPermissions.list || [],
    effectiveFunctions: permissions?.effectivePermissions.functions || []
  };
}

/**
 * Hook pour vérifier une permission spécifique (usage simple)
 */
export function useHasPermission(functionId) {
  const { canAccess, loading } = useUnifiedPermissions();
  return { can: canAccess(functionId), loading };
}

/**
 * Hook pour checker plusieurs permissions
 */
export function useHasAnyPermission(functionIds = []) {
  const { canAccessAny, loading } = useUnifiedPermissions();
  return { can: canAccessAny(functionIds), loading };
}

/**
 * Hook pour checker ALL permissions
 */
export function useHasAllPermissions(functionIds = []) {
  const { canAccessAll, loading } = useUnifiedPermissions();
  return { can: canAccessAll(functionIds), loading };
}

export default useUnifiedPermissions;
