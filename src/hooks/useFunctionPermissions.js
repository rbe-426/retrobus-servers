import { useState, useEffect, useCallback } from 'react';
import { fetchJson } from '../apiClient';
import { FUNCTIONS } from '../lib/functionUtils';

/**
 * Hook pour gérer les permissions individuelles par fonction
 * Source unique: API backend
 * Cache local: localStorage
 */
export function useFunctionPermissions(userId) {
  const [functions, setFunctions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const cacheKey = `function_perms_${userId}`;
  const cacheExpiry = 5 * 60 * 1000; // 5 minutes

  useEffect(() => {
    if (!userId) {
      setFunctions([]);
      return;
    }

    const loadPermissions = async () => {
      try {
        setLoading(true);
        setError(null);

        // Vérifier le cache
        const cached = localStorage.getItem(cacheKey);
        const timestamp = localStorage.getItem(`${cacheKey}_timestamp`);

        if (cached && timestamp) {
          const age = Date.now() - parseInt(timestamp);
          if (age < cacheExpiry) {
            console.log(`✅ [useFunctionPermissions] Cache hit for ${userId}`);
            setFunctions(JSON.parse(cached));
            setLastUpdated(new Date(parseInt(timestamp)));
            setLoading(false);
            return;
          }
        }

        // Fetch depuis l'API
        console.log(`📡 [useFunctionPermissions] Fetching from API for ${userId}`);
        const data = await fetchJson(`/api/functions/user/${userId}`);

        if (data.success) {
          setFunctions(data.functions || []);

          // Sauvegarder en cache
          localStorage.setItem(cacheKey, JSON.stringify(data.functions || []));
          localStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString());
          setLastUpdated(new Date());

          console.log(`✅ [useFunctionPermissions] Loaded ${data.functions?.length || 0} functions for ${userId}`);
        } else {
          setError(data.error || 'Failed to load functions');
          setFunctions([]);
        }
      } catch (err) {
        console.error('❌ [useFunctionPermissions] Error:', err);
        setError(err.message);
        setFunctions([]);
      } finally {
        setLoading(false);
      }
    };

    loadPermissions();
  }, [userId, cacheKey, cacheExpiry]);

  /**
   * Vérifier si l'utilisateur a accès à une fonction
   */
  const hasFunction = useCallback((functionId) => {
    return functions.includes(functionId);
  }, [functions]);

  /**
   * Vérifier si l'utilisateur a accès à au moins une fonction d'une liste
   */
  const hasAnyFunction = useCallback((functionIds) => {
    return functionIds.some(fid => functions.includes(fid));
  }, [functions]);

  /**
   * Vérifier si l'utilisateur a accès à toutes les fonctions d'une liste
   */
  const hasAllFunctions = useCallback((functionIds) => {
    return functionIds.every(fid => functions.includes(fid));
  }, [functions]);

  /**
   * Invalider le cache
   */
  const invalidateCache = useCallback(() => {
    localStorage.removeItem(cacheKey);
    localStorage.removeItem(`${cacheKey}_timestamp`);
    setFunctions([]);
    setLastUpdated(null);
  }, [cacheKey]);

  /**
   * Vérifier dynamiquement via l'API (sans cache)
   */
  const checkFunctionDirect = useCallback(async (functionId) => {
    try {
      const response = await fetchJson('/api/functions/check', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          functionId
        })
      });

      return response.success && response.allowed;
    } catch (err) {
      console.error('❌ Direct function check failed:', err);
      return false;
    }
  }, [userId]);

  return {
    functions,
    loading,
    error,
    lastUpdated,
    hasFunction,
    hasAnyFunction,
    hasAllFunctions,
    invalidateCache,
    checkFunctionDirect
  };
}

/**
 * Hook simple pour vérifier une fonction spécifique
 */
export function useCanAccessFunction(userId, functionId) {
  const { hasFunction, loading, error } = useFunctionPermissions(userId);
  
  return {
    canAccess: hasFunction(functionId),
    loading,
    error
  };
}

/**
 * Hook pour l'admin: gérer les permissions des utilisateurs
 */
export function useFunctionManagement() {
  const [functions, setFunctions] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [functionsData, groupsData] = await Promise.all([
          fetchJson('/api/functions'),
          fetchJson('/api/functions/groups')
        ]);

        if (functionsData.success) {
          setFunctions(functionsData.functions || []);
        }
        if (groupsData.success) {
          setGroups(groupsData.groups || []);
        }
      } catch (err) {
        console.error('❌ Error loading function data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  /**
   * Accorder une fonction à un utilisateur
   */
  const grantFunction = useCallback(async (userId, functionId, reason, expiresAt) => {
    try {
      const response = await fetchJson('/api/functions/grant', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          functionId,
          reason,
          expiresAt
        })
      });

      if (response.success) {
        console.log(`✅ Function granted: ${userId} <- ${functionId}`);
      }

      return response;
    } catch (err) {
      console.error('❌ Error granting function:', err);
      throw err;
    }
  }, []);

  /**
   * Révoquer une fonction
   */
  const revokeFunction = useCallback(async (userId, functionId) => {
    try {
      const response = await fetchJson('/api/functions/revoke', {
        method: 'DELETE',
        body: JSON.stringify({
          userId,
          functionId
        })
      });

      if (response.success) {
        console.log(`✅ Function revoked: ${userId} -> ${functionId}`);
      }

      return response;
    } catch (err) {
      console.error('❌ Error revoking function:', err);
      throw err;
    }
  }, []);

  /**
   * Accorder un groupe de fonctions
   */
  const grantGroup = useCallback(async (userId, groupName) => {
    try {
      const response = await fetchJson('/api/functions/grant-group', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          groupName
        })
      });

      if (response.success) {
        console.log(`✅ Group granted: ${userId} <- ${groupName}`);
      }

      return response;
    } catch (err) {
      console.error('❌ Error granting group:', err);
      throw err;
    }
  }, []);

  return {
    functions,
    groups,
    loading,
    error,
    grantFunction,
    revokeFunction,
    grantGroup
  };
}
