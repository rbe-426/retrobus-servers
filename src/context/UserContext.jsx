import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { normalizeRole as normRole } from '../lib/roles';
import ForcePasswordChange from '../components/ForcePasswordChange';
import { tokenManager, StorageManager, validateSession } from '../api/authService.js';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  // Hydrate depuis authService qui lui-même lit depuis localStorage
  const [token, setToken] = useState(() => {
    tokenManager.hydrate();
    return tokenManager.getToken() || '';
  });
  
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  });
  
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const isAuthenticated = !!token;

  // Member profile (self)
  const [member, setMember] = useState(null);
  const [memberLoading, setMemberLoading] = useState(false);
  const [memberError, setMemberError] = useState(null);
  const [memberApiBase, setMemberApiBase] = useState(null);
  const lastMemberFetchRef = useRef(0);

  // Individual permissions
  const [customPermissions, setCustomPermissions] = useState(null);
  const [permissionsLoading, setPermissionsLoading] = useState(false);

  // ✅ Synchroniser le state local avec authService
  useEffect(() => {
    const unsub = tokenManager.subscribe((newToken) => {
      setToken(newToken || '');
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (user) localStorage.setItem('user', JSON.stringify(user));
    else localStorage.removeItem('user');
  }, [user]);

  // ✅ Wrapper pour setToken qui met aussi à jour authService
  const updateToken = (newToken) => {
    tokenManager.setToken(newToken);
    setToken(newToken || '');
  };

  const logout = () => {
    tokenManager.setToken(null);
    setToken('');
    setUser(null);
    setMember(null);
    setMemberError(null);
    setMemberApiBase(null);
    localStorage.removeItem('user');
    StorageManager.clearAppCache();
  };

  // ✅ Valider la session via authService
  const ensureSession = async () => {
    if (!token) {
      setUser(null);
      setSessionChecked(true);
      return false;
    }

    const isValid = await validateSession(token);
    setSessionChecked(true);

    if (!isValid) {
      logout();
      return false;
    }

    return true;
  };

  const apiCandidates = () => {
    const base = (import.meta?.env?.VITE_API_URL || '').replace(/\/+$/, '');
    const arr = [];
    if (base) arr.push(base);
    arr.push(''); // same-origin
    return arr;
  };

  const refreshMember = async (force = false) => {
    if (!token) { setMember(null); setMemberError('no-token'); return null; }
    // simple throttle to avoid spamming
    const now = Date.now();
    if (!force && (now - lastMemberFetchRef.current < 500)) {
      return member;
    }
    lastMemberFetchRef.current = now;

    setMemberLoading(true);
    setMemberError(null);
    try {
      const candidates = apiCandidates();
      let ok = false;
      let lastStatus = null;
      let data = null;
      for (const base of candidates) {
        try {
          const res = await fetch(`${base}/api/members/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          lastStatus = res.status;
          if (res.ok) {
            data = await res.json();
            setMember(data);
            setMemberApiBase(base || null);
            ok = true;
            break;
          }
        } catch (e) {
          lastStatus = 'network';
          continue;
        }
      }
      if (!ok) {
        setMember(null);
        setMemberError(lastStatus);
        return null;
      }
      return data;  // ✅ Retourner `data` au lieu de `member` (qui n'est pas encore mis à jour)
    } finally {
      setMemberLoading(false);
    }
  };

  // Load individual user permissions from backend
  const refreshPermissions = async () => {
    if (!user?.id || !token) {
      setCustomPermissions(null);
      return null;
    }

    setPermissionsLoading(true);
    try {
      const candidates = apiCandidates();
      for (const base of candidates) {
        try {
          const res = await fetch(`${base}/api/admin/users/${user.id}/permissions`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            // New API returns { permissions: [...] } array format
            const perms = (data.permissions && Array.isArray(data.permissions) && data.permissions.length > 0) 
              ? data.permissions 
              : null;
            setCustomPermissions(perms);
            return perms;
          }
        } catch (e) {
          continue;
        }
      }
      setCustomPermissions(null);
      return null;
    } finally {
      setPermissionsLoading(false);
    }
  };

  // Revalidation au chargement
  useEffect(() => {
    // On ne bloque pas le démarrage si pas de token
    ensureSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Revalidation quand le token change
  useEffect(() => {
    if (token) {
      ensureSession().then((ok) => {
        if (ok) {
          refreshMember();
          refreshPermissions();
        }
      });
    } else {
      setSessionChecked(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Revalidation: à chaque regain de focus et périodiquement
  useEffect(() => {
    const onFocus = () => ensureSession();
    window.addEventListener('focus', onFocus);
    const id = setInterval(() => ensureSession(), 5 * 60 * 1000); // toutes les 5 min
    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const username = user?.username || '';
  const prenom = user?.prenom || '';
  const nom = user?.nom || '';
  const roles = (user?.roles || []).map(r => normRole(r));
  const isAdmin = roles.includes('ADMIN') || roles.includes('PRESIDENT') || roles.includes('VICE_PRESIDENT') || roles.includes('TRESORIER') || roles.includes('SECRETAIRE_GENERAL');
  const isVolunteer = roles.includes('VOLUNTEER');
  const isDriver = roles.includes('DRIVER');
  const isMember = roles.includes('MEMBER');
  const matricule = user?.username || '';

  const value = useMemo(
    () => ({
      token,
      setToken: updateToken,
      user,
      setUser,
      isAuthenticated,
      username,
      prenom,
      nom,
      roles,
      isAdmin,
  isVolunteer,
  isDriver,
  isMember,
      matricule,
      logout,
      // NEW: exposer le statut de session et l’action
      sessionChecked,
      ensureSession,
      // Member self profile
      member,
      memberLoading,
      memberError,
      memberApiBase,
      refreshMember,
      // Individual permissions
      customPermissions,
      permissionsLoading,
      refreshPermissions,
    }),
    [token, user, isAuthenticated, username, prenom, nom, roles, isAdmin, isVolunteer, isDriver, isMember, matricule, sessionChecked, member, memberLoading, memberError, memberApiBase, customPermissions, permissionsLoading]
  );

  return (
    <UserContext.Provider value={value}>
      {children}
      <ForcePasswordChange
        isOpen={mustChangePassword}
        onPasswordChanged={() => {
          setMustChangePassword(false);
          if (token) ensureSession();
        }}
      />
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}