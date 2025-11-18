import { useState, useEffect, useCallback } from 'react';
import { fetchJson } from '../apiClient';

/**
 * Hook unifié pour gérer les permissions
 * Source unique de vérité: API backend
 * Local cache: localStorage pour performance
 */
export function usePermissions(userId) {
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Clé de cache locale
  const cacheKey = `permissions_${userId}`;
  const cacheExpiry = 5 * 60 * 1000; // 5 minutes

  useEffect(() => {
    if (!userId) {
      setPermissions([]);
      return;
    }

    const loadPermissions = async () => {
      try {
        setLoading(true);
        setError(null);

        // Vérifier le cache local
        const cached = localStorage.getItem(cacheKey);
        const timestamp = localStorage.getItem(`${cacheKey}_timestamp`);

        if (cached && timestamp) {
          const age = Date.now() - parseInt(timestamp);
          if (age < cacheExpiry) {
            console.log(`✅ [usePermissions] Cache hit for ${userId}`);
            setPermissions(JSON.parse(cached));
            setLastUpdated(new Date(parseInt(timestamp)));
            setLoading(false);
            return;
          }
        }

        // Fetch depuis l'API backend
        console.log(`📡 [usePermissions] Fetching from API for ${userId}`);
        const data = await fetchJson(`/api/permissions-check/user/${userId}`);

        if (data.success) {
          // Normaliser les permissions
          const normalized = (data.permissions || []).map(p => ({
            resource: p.resource,
            actions: Array.isArray(p.actions) ? p.actions : JSON.parse(p.actions || '[]'),
            isDefault: p.isDefault || false,
            source: p.source || 'unknown'
          }));

          setPermissions(normalized);

          // Sauvegarder en cache
          localStorage.setItem(cacheKey, JSON.stringify(normalized));
          localStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString());
          setLastUpdated(new Date());

          console.log(`✅ [usePermissions] Loaded ${normalized.length} permissions for ${userId}`);
        } else {
          setError(data.error || 'Failed to load permissions');
          setPermissions([]);
        }
      } catch (err) {
        console.error('❌ [usePermissions] Error:', err);
        setError(err.message);
        setPermissions([]);
      } finally {
        setLoading(false);
      }
    };

    loadPermissions();
  }, [userId, cacheKey, cacheExpiry]);

  /**
   * Vérifier si l'utilisateur a accès à une ressource avec une action
   */
  const hasPermission = useCallback((resource, action = 'READ') => {
    const perm = permissions.find(p => p.resource === resource);
    return perm && perm.actions.includes(action);
  }, [permissions]);

  /**
   * Vérifier si l'utilisateur a accès à une ressource (n'importe quelle action)
   */
  const hasResourceAccess = useCallback((resource) => {
    return permissions.some(p => p.resource === resource);
  }, [permissions]);

  /**
   * Invalider le cache
   */
  const invalidateCache = useCallback(() => {
    localStorage.removeItem(cacheKey);
    localStorage.removeItem(`${cacheKey}_timestamp`);
    setPermissions([]);
    setLastUpdated(null);
  }, [cacheKey]);

  /**
   * Vérifier dynamiquement via l'API (sans cache)
   */
  const checkPermissionDirect = useCallback(async (resource, action = 'READ') => {
    try {
      const response = await fetchJson('/api/permissions-check/check', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          resource,
          action
        })
      });

      return response.success && response.allowed;
    } catch (err) {
      console.error('❌ Direct permission check failed:', err);
      return false;
    }
  }, [userId]);

  return {
    permissions,
    loading,
    error,
    lastUpdated,
    hasPermission,
    hasResourceAccess,
    invalidateCache,
    checkPermissionDirect
  };
}

/**
 * Hook pour vérifier une permission spécifique (simpler)
 */
export function useCanAccess(userId, resource, action = 'READ') {
  const { hasPermission, loading, error } = usePermissions(userId);
  
  return {
    canAccess: hasPermission(resource, action),
    loading,
    error
  };
}
