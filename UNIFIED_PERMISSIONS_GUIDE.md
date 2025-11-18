# 🔐 Système Unifié de Permissions

## Vue d'ensemble

Le système de permissions a été unifié en un seul noyau centralisé pour éviter les bugs et les incohérences.

### Architecture

```
┌─────────────────────────────────────────┐
│         PermissionCore.js (Backend)    │
│     Source unique de vérité             │
│  - Logique de vérification centralisée  │
│  - Toutes les ressources et rôles      │
└──────────────────┬──────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
    ┌────────────┐    ┌──────────────┐
    │ API Routes │    │  Middleware  │
    │    /api/   │    │ requirePerm  │
    └─────┬──────┘    └──────┬───────┘
          │                   │
    ┌─────┴───────────────────┴─────┐
    │   Express Endpoints Protected │
    └─────────────────────────────────┘
          │
    ┌─────┴──────────────────────┐
    │                            │
┌─────────────────────┐  ┌──────────────────┐
│  Frontend Hooks     │  │  Admin Panel     │
│  usePermissions()   │  │  Check perms     │
│  useCanAccess()     │  │  via API         │
└─────────────────────┘  └──────────────────┘
```

## Backend

### PermissionCore.js

Source unique de vérité pour toutes les permissions.

**Fonctions principales:**

- `checkPermission(userId, resource, action, userRole)` - Vérifier UNE permission
- `getUserPermissions(userId, userRole)` - Obtenir TOUTES les permissions d'un user
- `requirePermissionCheck(resource, action)` - Middleware Express

**Logique:**
1. Admin bypass automatique
2. Vérifier permission individuelle en BD (priorité haute)
3. Utiliser defaults du rôle si pas de permission individuelle
4. Retourner false si rien ne match

### API Endpoint: `/api/permissions-check`

```javascript
// POST /api/permissions-check/check
// Vérifier une permission
{
  userId: "cmhrpbmf60000m6ns8yilynsv",
  resource: "VEHICLES",
  action: "READ"
}

// GET /api/permissions-check/user/:userId
// Obtenir toutes les permissions d'un utilisateur
```

## Frontend

### Hook: `usePermissions(userId)`

```javascript
import { usePermissions } from '../hooks/usePermissions';

function MyComponent() {
  const { 
    permissions,      // Array de permissions
    loading,         // Boolean
    error,          // String | null
    hasPermission,  // (resource, action) => boolean
    hasResourceAccess, // (resource) => boolean
    invalidateCache,   // () => void
    checkPermissionDirect // (resource, action) => Promise<boolean>
  } = usePermissions(userId);

  if (loading) return <div>Chargement...</div>;
  
  if (hasPermission('VEHICLES', 'CREATE')) {
    // Afficher formulaire création véhicule
  }
}
```

### Utils: `permissionUtils.js`

```javascript
import { 
  canUserAccess,
  hasAnyAccess,
  getResourceActions,
  RESOURCES,
  ACTIONS
} from '../lib/permissionUtils';

// Utilisation simple
const canDelete = canUserAccess(permissions, RESOURCES.VEHICLES, ACTIONS.DELETE);

// Vérifier accès à plusieurs ressources
const canManage = hasAnyAccess(permissions, [
  RESOURCES.VEHICLES,
  RESOURCES.PLANNING
]);

// Obtenir les actions disponibles
const vehicleActions = getResourceActions(permissions, RESOURCES.VEHICLES);
```

### Context: `PermissionsContext`

```javascript
import { PermissionsProvider, usePermissionsContext } from '../context/PermissionsContext';

// En haut de l'app
function App() {
  return (
    <PermissionsProvider userId={user.id}>
      <MainApp />
    </PermissionsProvider>
  );
}

// Dans n'importe quel composant
function MyComponent() {
  const { hasPermission, permissions } = usePermissionsContext();
  
  return hasPermission('VEHICLES', 'READ') && (
    <div>Afficher les véhicules</div>
  );
}
```

## Migration des anciens systèmes

### ❌ À SUPPRIMER

1. **`permissions.js`** - Ancien système local
   ```javascript
   // AVANT (❌ Ne plus utiliser)
   import { canAccess, ROLE_PERMISSIONS } from '../lib/permissions';
   ```

2. **`roles.js`** - Deprecated
   ```javascript
   // AVANT (❌ Ne plus utiliser)
   import { canCreateVehicle } from '../lib/roles';
   ```

### ✅ À REMPLACER PAR

```javascript
// APRÈS (✅ Utiliser le nouveau système)
import { usePermissions } from '../hooks/usePermissions';
import { canUserAccess, RESOURCES } from '../lib/permissionUtils';

function MyComponent() {
  const { permissions } = usePermissions(userId);
  
  // Vérifier permission
  if (canUserAccess(permissions, RESOURCES.VEHICLES, 'CREATE')) {
    // Afficher
  }
}
```

## Migration pas à pas

### 1. Remplacer les imports

```javascript
// ❌ AVANT
import { canAccess } from '../lib/permissions';
import { useUserPermissions } from '../hooks/useUserPermissions';

// ✅ APRÈS
import { usePermissions } from '../hooks/usePermissions';
import { canUserAccess, RESOURCES } from '../lib/permissionUtils';
```

### 2. Remplacer les vérifications dans les composants

```javascript
// ❌ AVANT
const { permissions } = useUserPermissions(userId);
const hasAccess = permissions.some(p => p.resource === 'VEHICLES');

// ✅ APRÈS
const { permissions, hasPermission } = usePermissions(userId);
const hasAccess = hasPermission(RESOURCES.VEHICLES, ACTIONS.READ);
```

### 3. Remplacer les vérifications dans les routes

```javascript
// ❌ AVANT
app.get('/vehicles', requireAuth, requirePermission('VEHICLES'), handler);

// ✅ APRÈS (utilise aussi requirePermission mais avec le nouveau core)
app.get('/vehicles', requireAuth, requirePermissionCheck(RESOURCES.VEHICLES, ACTIONS.READ), handler);
```

## Ressources disponibles

Toutes synchronisées entre backend et frontend:

```javascript
const RESOURCES = {
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
```

## Rôles et Defaults

### Admin
- ✅ Accès à TOUT
- ✅ Toutes les actions (READ, CREATE, EDIT, DELETE)

### Manager
- ✅ Accès à tout sauf PERMISSIONS_MANAGEMENT
- ✅ Toutes les actions

### Operator
- ✅ VEHICLES, PLANNING, EVENTS, RETROMAIL, RETROSUPPORT
- ✅ Actions: READ, CREATE, EDIT

### Volunteer
- ✅ VEHICLES, PLANNING, EVENTS
- ✅ Action: READ seulement

### Client
- ❌ Pas d'accès par défaut
- ✅ Accord individuel requis

### Partenaire
- ❌ Pas d'accès par défaut
- ✅ Accord individuel requis

## Cache local

Le frontend cache les permissions en localStorage pour performance:

```javascript
// Cache expire après 5 minutes
// Forcer refresh: permissions.invalidateCache()
```

## Debugging

### Logs du backend

```
✅ [PermissionCore] ADMIN bypass: userId -> resource.action
✅ [PermissionCore] Individual permission granted: userId -> resource.action
✅ [PermissionCore] Role default access granted: userId -> resource.action
❌ [PermissionCore] Access denied for role: userId -> resource.action
```

### Logs du frontend

```
✅ [usePermissions] Cache hit for userId
📡 [usePermissions] Fetching from API for userId
✅ [usePermissions] Loaded N permissions for userId
```

## Checklist de migration

- [ ] Remplacer `useUserPermissions` par `usePermissions`
- [ ] Remplacer imports de `permissions.js` par `permissionUtils.js`
- [ ] Supprimer utilisation de `roles.js`
- [ ] Tester avec usePermissionsContext en admin panel
- [ ] Tester avec usePermissions dans les composants
- [ ] Tester permission denial (403 responses)
- [ ] Supprimer les anciens fichiers une fois tout testé
- [ ] Documenter les endpoints spécifiques qui requièrent permissions
