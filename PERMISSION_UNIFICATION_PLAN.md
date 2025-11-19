# 🎯 PLAN D'UNIFICATION DU SYSTÈME DE PERMISSIONS

**Status**: En préparation  
**Impact**: CRITIQUE - Affecte toute l'app  
**Effort**: 3-4 jours de dev  

---

## 🔍 ANALYSE DES 3 SYSTÈMES INCOMPATIBLES

### Système 1: `src/lib/permissions.js`
```javascript
RESOURCES = {
  SITE_MANAGEMENT: 'site:management',
  VEHICLES: 'vehicles:list',
  VEHICLE_VIEW: 'vehicles:view',
  // 40+ ressources avec format "type:action"
}

ROLE_PERMISSIONS = {
  ADMIN: { [RESOURCES.SITE_MANAGEMENT]: ['access', 'view', 'edit'], ... }
  // Complet avec hiérarchie ADMIN → MEMBER
}

PERMISSION_TYPES = { ACCESS, VIEW, EDIT }
```

**Fichiers**: `src/lib/permissions.js` (528 lines)  
**Utilisé par**: 
- `src/hooks/usePermissions.js`
- `src/components/PermissionGate.jsx`
- `src/components/PermissionProtectedRoute.jsx`

**Problème**: Hardcodé au frontend, pas de source de vérité au backend

---

### Système 2: `src/lib/permissionUtils.js`
```javascript
RESOURCES = {
  VEHICLES: 'VEHICLES',
  PLANNING: 'PLANNING',
  // 13 ressources, format UPPERCASE
}

ACTIONS = { READ, CREATE, EDIT, DELETE }

ROLES = { ADMIN, MANAGER, OPERATOR, VOLUNTEER, CLIENT, PARTENAIRE }

Functions: canUserAccess(), hasAnyAccess(), getResourceActions()
```

**Utilisé par**: Quelques composants seulement  
**Problème**: Incohérent avec `permissions.js`

---

### Système 3: `api/src/permissions-api.js`
```javascript
RESOURCES = {
  SITE_MANAGEMENT: 'SITE_MANAGEMENT',
  VEHICLES: 'VEHICLES',
  // 11 ressources, format UPPERCASE
}

ACTIONS = ['CREATE', 'READ', 'UPDATE', 'DELETE', 'APPROVE', 'MANAGE']

ROLE_PERMISSIONS = {
  ADMIN: { resources: [...all], actions: [...all] },
  MANAGER: { resources: [...], actions: [...] },
  PRESIDENT: { resources: [], actions: [] },  // ❌ VIDE!
  // 7 autres rôles
}
```

**Structure DB**:
```javascript
UserPermission {
  id, userId, resource, actions (JSON), 
  expiresAt, grantedAt, grantedBy, reason
}
```

**Endpoints**: 
- `GET /api/permissions/resources` 
- `GET /api/permissions/my-permissions`
- `GET /api/admin/users/:userId/permissions`
- `POST /api/admin/users/:userId/permissions`
- `PUT /api/admin/users/:userId/permissions/:permId`
- `DELETE /api/admin/users/:userId/permissions/:permId`

---

## ❌ LES 6 INCOMPATIBILITÉS CRITIQUES

| Aspect | System1 (Frontend) | System2 (Frontend) | System3 (Backend) |
|--------|-------------------|-------------------|------------------|
| **Format Ressources** | `site:management` | `SITE_MANAGEMENT` | `SITE_MANAGEMENT` |
| **Count Ressources** | 40+ | 13 | 11 |
| **Permission Types** | access/view/edit | READ/CREATE/EDIT/DELETE | READ/UPDATE/DELETE/CREATE/APPROVE |
| **Rôles définis** | 11 rôles + hiérarchie | 6 rôles | 9 rôles (rôles métier VIDES) |
| **Source Vérité** | Frontend localStorage | API | API + UserPermission |
| **Expiration** | Pas gérée | Pas implémentée | Implémentée mais PAS dans schema |

---

## 🎪 PLAN D'UNIFICATION EN 3 ÉTAPES

### **ÉTAPE 1: Créer une source unique centralisée au backend** (2 jours)

#### Fichier: `api/src/core/PermissionCore.js` (NOUVELLE SOURCE DE VÉRITÉ)

```javascript
// Ressources définies UNE SEULE FOIS
export const RESOURCES = {
  // Gestion du site
  SITE_MANAGEMENT: 'SITE_MANAGEMENT',
  SITE_USERS: 'SITE_USERS',
  SITE_CONFIG: 'SITE_CONFIG',
  SITE_CONTENT: 'SITE_CONTENT',
  
  // Véhicules (consolidated)
  VEHICLES: 'VEHICLES',  // Remplace vehicles:list, vehicles:view, etc.
  
  // Événements
  EVENTS: 'EVENTS',
  
  // Finances
  FINANCE: 'FINANCE',
  
  // Membres
  MEMBERS: 'MEMBERS',
  
  // Stocks
  STOCK: 'STOCK',
  
  // Communications
  NEWSLETTER: 'NEWSLETTER',
  RETROMAIL: 'RETROMAIL',
  
  // Planification
  RETROPLANNING: 'RETROPLANNING',
  
  // Support
  RETROSUPPORT: 'RETROSUPPORT',
  
  // Demandes
  RETRODEMANDES: 'RETRODEMANDES',
  
  // Permissions
  PERMISSIONS_MANAGEMENT: 'PERMISSIONS_MANAGEMENT',
  
  // Dashboard personnel
  MYRBE: 'MYRBE',
  
  // Administration
  ADMIN_PANEL: 'ADMIN_PANEL',
  ADMIN_LOGS: 'ADMIN_LOGS',
  ADMIN_SETTINGS: 'ADMIN_SETTINGS'
};

// Actions UNE SEULE FOIS
export const ACTIONS = ['CREATE', 'READ', 'UPDATE', 'DELETE', 'APPROVE'];

// Rôles avec hiérarchie claire
export const ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  PRESIDENT: 'PRESIDENT',
  VICE_PRESIDENT: 'VICE_PRESIDENT',
  TRESORIER: 'TRESORIER',
  SECRETAIRE_GENERAL: 'SECRETAIRE_GENERAL',
  MEMBER: 'MEMBER',
  PRESTATAIRE: 'PRESTATAIRE',
  CLIENT: 'CLIENT'
};

// Permissions PAR RÔLE (source de vérité)
export const ROLE_PERMISSIONS = {
  ADMIN: {
    allResources: true,  // Accès complet
    actions: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'APPROVE']
  },
  
  MANAGER: {
    resources: [
      'SITE_MANAGEMENT',
      'SITE_USERS',
      'VEHICLES',
      'EVENTS',
      'FINANCE',
      'MEMBERS',
      'RETROPLANNING',
      'RETROSUPPORT',
      'RETRODEMANDES'
    ],
    actions: ['READ', 'UPDATE', 'APPROVE']
  },
  
  PRESIDENT: {
    resources: [
      'MEMBERS',
      'VEHICLES',
      'FINANCE',
      'EVENTS',
      'RETROPLANNING',
      'RETRODEMANDES'
    ],
    actions: ['READ', 'UPDATE']  // Lire et approuver, pas créer
  },
  
  VICE_PRESIDENT: {
    resources: ['EVENTS', 'RETROPLANNING', 'MEMBERS'],
    actions: ['READ', 'UPDATE']
  },
  
  TRESORIER: {
    resources: ['FINANCE', 'MEMBERS'],
    actions: ['READ', 'UPDATE', 'CREATE']
  },
  
  SECRETAIRE_GENERAL: {
    resources: [
      'MEMBERS',
      'RETROPLANNING',
      'RETROMAIL',
      'NEWSLETTER',
      'SITE_CONFIG'
    ],
    actions: ['READ', 'UPDATE', 'CREATE']
  },
  
  MEMBER: {
    resources: [
      'MYRBE',
      'EVENTS',
      'RETROPLANNING',
      'RETRODEMANDES',
      'RETROSUPPORT'
    ],
    actions: ['READ', 'CREATE']
  },
  
  PRESTATAIRE: {
    resources: [
      'RETRODEMANDES',
      'MYRBE',
      'RETROSUPPORT'
    ],
    actions: ['READ', 'UPDATE']
  },
  
  CLIENT: {
    resources: ['RETRODEMANDES', 'RETROSUPPORT'],
    actions: ['READ', 'CREATE']
  }
};

// Fonctions utilitaires
export function getPermissionsForRole(role) {
  return ROLE_PERMISSIONS[role] || { resources: [], actions: [] };
}

export function canRoleAccess(role, resource, action = 'READ') {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  
  const hasResource = perms.allResources || 
                     (Array.isArray(perms.resources) && perms.resources.includes(resource));
  const hasAction = Array.isArray(perms.actions) && perms.actions.includes(action);
  
  return hasResource && hasAction;
}

export function getAllPermissionsForRole(role) {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return [];
  
  const resources = perms.allResources ? 
    Object.values(RESOURCES) : 
    (Array.isArray(perms.resources) ? perms.resources : []);
  
  return resources.map(resource => ({
    resource,
    actions: perms.actions
  }));
}
```

---

### **ÉTAPE 2: Exposer une API cohérente** (1 jour)

#### Endpoint: `GET /api/permissions/definitions` (NOUVEAU)

```json
{
  "resources": { "SITE_MANAGEMENT": "SITE_MANAGEMENT", ... },
  "actions": ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE"],
  "roles": { "ADMIN": "ADMIN", ... },
  "rolePermissions": {
    "ADMIN": { allResources: true, actions: [...] },
    ...
  }
}
```

#### Endpoint: `GET /api/permissions/my-permissions` (MODIFIER)

```json
{
  "userId": "...",
  "role": "MEMBER",
  "defaultPermissions": [
    { "resource": "MYRBE", "actions": ["READ", "CREATE"] },
    ...
  ],
  "customPermissions": [
    { 
      "resource": "VEHICLES", 
      "actions": ["UPDATE"], 
      "expiresAt": "2025-01-15",
      "grantedBy": "admin_id",
      "reason": "Maintenance exceptionnelle"
    }
  ],
  "effectivePermissions": [ "MYRBE:READ", "MYRBE:CREATE", "VEHICLES:UPDATE", ... ]
}
```

---

### **ÉTAPE 3: Refactoriser le frontend** (1 jour)

#### Remplacer tous les imports:

**AVANT**:
```javascript
import { RESOURCES, ROLE_PERMISSIONS } from '../lib/permissions.js';
import { canUserAccess } from '../lib/permissionUtils.js';
import { usePermissions } from '../hooks/usePermissions.js';
```

**APRÈS**:
```javascript
// Le frontend ne définit PLUS rien
// Il consomme UNIQUEMENT de l'API
import { useEffectivePermissions } from '../hooks/useEffectivePermissions.js';
```

#### Nouveau hook: `hooks/useEffectivePermissions.js`

```javascript
export function useEffectivePermissions() {
  const { user } = useContext(UserContext);
  const [perms, setPerms] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Cache 30 secondes
    const cached = sessionStorage.getItem('perms_cache');
    if (cached && Date.now() - JSON.parse(cached).timestamp < 30000) {
      setPerms(JSON.parse(cached).data);
      setLoading(false);
      return;
    }
    
    // Sinon fetch de l'API
    apiClient.get('/api/permissions/my-permissions')
      .then(res => {
        sessionStorage.setItem('perms_cache', JSON.stringify({
          data: res.data,
          timestamp: Date.now()
        }));
        setPerms(res.data);
      })
      .finally(() => setLoading(false));
  }, [user?.id]);
  
  const canAccess = (resource, action = 'READ') => {
    if (!perms) return false;
    return perms.effectivePermissions.includes(`${resource}:${action}`);
  };
  
  return { perms, loading, canAccess };
}
```

---

## 📝 FICHIERS À MODIFIER

| Fichier | Action | Détail |
|---------|--------|--------|
| `api/src/core/PermissionCore.js` | CREATE | Nouvelle source unique |
| `api/src/permissions-api.js` | REFACTOR | Utiliser PermissionCore |
| `api/src/user-permissions.js` | DELETE | Fusionner dans permissions-api |
| `api/src/member-permissions.js` | DELETE | Fusionner dans permissions-api |
| `api/src/middleware/permission-check.js` | UPDATE | Utiliser PermissionCore |
| `src/lib/permissions.js` | DELETE | Remplacer par API |
| `src/lib/permissionUtils.js` | DELETE | Remplacer par API |
| `src/hooks/usePermissions.js` | REFACTOR | Utiliser nouvelle API |
| `src/hooks/useEffectivePermissions.js` | CREATE | Nouveau hook unifié |
| `src/components/PermissionGate.jsx` | UPDATE | Utiliser nouveau hook |
| `src/components/PermissionsManager.jsx` | UPDATE | Utiliser nouvelle API |
| `src/components/RolePermissionsManager.jsx` | UPDATE | UI pour gérer rôles |
| Toutes les routes | UPDATE | Protéger avec middleware |

---

## 🛠️ PRISMA SCHEMA FIXES

```prisma
model UserPermission {
  id String @id @default(cuid())
  
  // Relation
  user SiteUser @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId String
  
  // Permission
  resource String  // Ex: "VEHICLES", "FINANCE"
  actions String   // JSON array: ["READ", "UPDATE"]
  
  // Metadata
  expiresAt DateTime?
  grantedAt DateTime @default(now())
  grantedBy String   // userId de qui a accordé
  reason String?
  
  // Unique: Un user ne peut avoir qu'une permission par ressource
  @@unique([userId, resource])
}

model SiteUser {
  // ... autres champs
  permissions UserPermission[]
  accessLogs AccessLog[]
}
```

---

## 📊 RÉSUMÉ DES CHANGEMENTS

**Avant**: 3 systèmes incompatibles, permissions définies partout  
**Après**: 1 système unique, source de vérité au backend

**Avantages**:
- ✅ Source unique de vérité
- ✅ Cohérence frontend/backend
- ✅ Permissions expirables et personnalisables
- ✅ Audit trail (grantedBy, grantedAt)
- ✅ Facile à étendre
- ✅ Middleware peut protéger toutes les routes
- ✅ Admin peut changer rôle → impact immédiat

**Temps**: ~3-4 jours de dev complet  
**Tests**: ~1 jour complet (tous les rôles, expirations, middleware)  

---

## 🚀 PHASE 1 DE DÉPLOIEMENT

1. Créer `PermissionCore.js` ✅
2. Refactoriser `permissions-api.js` ✅
3. Ajouter nouveau endpoint `GET /api/permissions/definitions`
4. Créer `useEffectivePermissions.js` hook
5. Test local avec 1 rôle (ADMIN)
6. Deploy progressif: ADMIN → MANAGER → autres rôles
7. Valider chaque rôle en production
8. Nettoyer anciens fichiers

