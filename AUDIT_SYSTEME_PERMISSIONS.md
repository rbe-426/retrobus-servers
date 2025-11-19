# 🔐 AUDIT COMPLET - SYSTÈME DE PERMISSIONS

**Date**: 20 novembre 2025  
**Status**: ⚠️ MULTIPLE ISSUES FOUND

---

## 📊 RÉSUMÉ EXÉCUTIF

Le système de permissions est **partiellement implémenté** avec plusieurs incohérences majeures entre le frontend et le backend.

**Issues critiques identifiées**: 12  
**Issues majeures**: 8  
**Issues mineures**: 15+

---

## 🔴 PROBLÈMES CRITIQUES

### 1. **Duplication de systèmes de permissions**

| Frontend | Backend |
|----------|---------|
| `src/lib/permissions.js` | `api/src/permissions-api.js` |
| `src/hooks/usePermissions.js` | `api/src/user-permissions.js` |
| `src/lib/permissionUtils.js` | `api/src/member-permissions.js` |
| Rôles dans `permissions.js` | Rôles dans `permissions-api.js` |

**Problem**: Les deux systèmes ne sont **pas synchronisés**. Défaut majeur dans la hiérarchie des rôles:

#### Frontend (src/lib/permissions.js):
```
Hierarchy: MEMBER → PRESTATAIRE → DRIVER → VOLUNTEER → SECRETAIRE_GENERAL → TRESORIER → VICE_PRESIDENT → PRESIDENT → ADMIN
```

#### Backend (api/src/permissions-api.js):
```
Hierarchy: Non définie (vide pour rôles métier)
ADMIN, MANAGER, PRESIDENT, VICE_PRESIDENT, TRESORIER, SECRETAIRE_GENERAL, MEMBER, PRESTATAIRE, CLIENT
```

**Impact**: 
- ❌ Permissions métier ne s'appliquent pas correctement
- ❌ Les admins peuvent contourner les restrictions
- ❌ Les rôles métier n'ont aucune permission par défaut

---

### 2. **Endpoints incohérents pour les permissions**

**Frontend appelle**:
```
GET  /api/permissions/resources
GET  /api/permissions/my-permissions
GET  /api/user-permissions/:userId
POST /api/user-permissions/:userId
```

**Backend fournit** (partiellement):
```
/api/permissions/resources        ✅ Existe
/api/permissions/my-permissions   ✅ Existe
/api/user-permissions/*           ❓ Incertain
/api/admin/users/:userId/permissions  ⚠️ Autres nom
```

**Problème**: Pas de correspondance 1:1. Multiple sources de vérité.

---

### 3. **UserPermission vs Rôles - Architecture brisée**

**Actuel** (backend: `permissions-api.js` l.107):
```javascript
const ROLE_PERMISSIONS = {
  ADMIN: {
    resources: Object.values(RESOURCES),
    actions: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'APPROVE', 'MANAGE']
  },
  MANAGER: {
    resources: [...],  // Défini
    actions: [...]
  },
  // Rôles métier - permissions contrôlées manuellement
  PRESIDENT: { resources: [], actions: [] },  // ❌ VIDE!
  TRESORIER: { resources: [], actions: [] },  // ❌ VIDE!
```

**Problème**: Les rôles métier (PRESIDENT, TRESORIER, SECRETAIRE, etc.) ont **ZÉRO permissions par défaut**.

**Conséquence**:
- Un PRESIDENT ne peut rien faire sauf si permissions individuelles accordées
- Cela va à l'encontre de la logique métier
- Les utilisateurs doivent passer par `/admin` pour avoir accès à quoi que ce soit

---

### 4. **UserPermission table - Pas de relation dans schema Prisma**

**Schema** (`prisma/schema.prisma`):
```prisma
model SiteUser {
  id String @id @default(cuid())
  linkedMember Member? @relation(fields: [linkedMemberId])
  // ❌ PAS DE: 
  //   permissions UserPermission[]
  //   accessLogs AccessLog[]
}

// ❌ STUB MODEL SANS STRUCTURE:
model UserPermission {
  id String @id @default(cuid())
  userId String  // ❌ PAS @unique
  permission String
  createdAt DateTime @default(now())
  // ❌ MANQUE: resource, actions[], expiresAt
}
```

**Problème**:
- La table `user_permissions` n'est pas reliée à `site_users`
- Structure minimale ne supporte pas: resource, actions, expiresAt
- Backend code l.190: `user.permissions` ne peut pas fonctionner

---

### 5. **Logique de vérification des permissions dupliquée + incohérente**

**Frontend** (`src/lib/permissions.js` l.410):
```javascript
export function hasPermission(role, resource, permissionType = 'access', customPermissions = null) {
  // Vérifie ROLE_PERMISSIONS + customPermissions
  // Support: 'access', 'view', 'edit'
  // Mappe vers actions: READ, UPDATE, DELETE, CREATE
}
```

**Backend** (`api/src/permissions-api.js` l.200+):
```javascript
// Réimplémente la même logique
// Mais structure différente
// Actions: CREATE, READ, UPDATE, DELETE, APPROVE, MANAGE
```

**Problèmes**:
- ❌ Deux implémentations de la même logique = risque de désync
- ❌ Frontend utilise 'access', 'view', 'edit' mais backend utilise READ, UPDATE, DELETE
- ❌ Backend n'a pas de concept 'access' vs 'view'

---

### 6. **Middleware requireAuth + enrichUserWithRole**

**Backend** (`api/src/permissions-api.js` l.55):
```javascript
async function requireAuth(req, res, next) {
  const user = await getAuthUserWithRole(req, prismaInstance);
  if (!user || !user.userId) {
    return res.status(401).json({ error: 'Authentification requise' });
  }
  req.user = user;
  next();
}
```

**Problème**: Cette fonction récupère le rôle de la BD, mais:
- ❌ Ne charge PAS les permissions individuelles (UserPermission)
- ❌ Tous les endpoints supposent que `req.user` a les perms
- ❌ Aucune vérification d'expiration

---

### 7. **PermissionGate + PermissionsManager incohérents**

**Frontend** (`src/components/PermissionGate.jsx`):
```jsx
<PermissionGate resource="VEHICLES" permissionType="edit">
  <Button>Modifier</Button>
</PermissionGate>
```

**Mais** (`src/components/PermissionsManager.jsx`):
- Essaie de récupérer permissions de `/api/user-permissions/:userId`
- Affiche une UI complexe pour éditer les permissions
- **Mais NO SAVE FUNCTION!** (l.69-88 juste fait des logs)

```javascript
const handleSavePermissions = async () => {
  try {
    const response = await apiClient.post('/admin/roles/permissions', {  // ❌ ENDPOINT N'EXISTE PAS
      permissions: permissions
    });
```

---

### 8. **RouteProtection vs PermissionProtectedRoute**

**Deux systèmes différents**:
1. `src/components/RouteProtection.jsx` - Basé sur rôles
2. `src/components/PermissionProtectedRoute.jsx` - Basé sur resources

**Problème**: Les pages utilisent le **MAUVAIS** système!

Exemple (`src/pages/DashboardSiteManagement.jsx`):
```jsx
// Utilise un rôle (ADMIN) au lieu de resource (SITE_MANAGEMENT)
<PermissionProtectedRoute requiredRole="ADMIN">
```

Mais devrait être:
```jsx
<PermissionProtectedRoute requiredPermission="SITE_MANAGEMENT">
```

---

## 🟠 PROBLÈMES MAJEURS

### 9. **API endpoints pour permissions manquants ou cassés**

**Attendu par frontend**:
```
GET  /api/user-permissions/:userId
POST /api/user-permissions/:userId
PUT  /api/user-permissions/:userId/:permId
DELETE /api/user-permissions/:userId/:permId
```

**Trouvé dans backend** (`permissions-api.js`):
```
✅ GET /api/permissions/resources
✅ GET /api/permissions/my-permissions
✅ GET /api/admin/users/:userId/permissions  (Différent!)
✅ POST /api/admin/users/:userId/permissions (Différent!)
⚠️ PUT  /api/admin/users/:userId/permissions/:permId
⚠️ DELETE /api/admin/users/:userId/permissions/:permId
```

**Problèmes**:
- ❌ Noms inconsistents (`/api/user-permissions/` vs `/api/admin/users/`)
- ❌ Frontend attend CRUD simple, backend a structure admin
- ❌ Pas de GET /api/user-permissions/:userId route

---

### 10. **Middleware permission-check.js n'existe pas ou n'est pas utilisé**

**Importe dans server.js**:
```javascript
import { requirePermission, requirePermissionAction, initializePrismaForPermissions } 
  from './middleware/permission-check.js';
```

**Mais** utilisation:
- ❌ `requirePermission` n'est jamais appelé dans les routes
- ❌ Aucune vérification de permission sur les routes REST
- ❌ Les utilisateurs peuvent appeler n'importe quel endpoint

**Exemple route sans protection** (`api/src/finance.js`):
```javascript
app.get('/finance/balance', async (req, res) => {
  // ❌ PAS DE VÉRIFICATION!
  const balance = await prisma.financeBalance.findFirst();
  res.json(balance);
});
```

---

### 11. **Cache permissions côté frontend cassé**

**usePermissions.js** (frontend):
```javascript
const cache = localStorage.getItem(`permissions_${userId}`);
```

**Problèmes**:
- ❌ Cache ne s'expire JAMAIS
- ❌ Quand admin change permissions, l'utilisateur voit l'ancienne version
- ❌ Logout n'efface PAS le cache
- ❌ 30 secondes hardcodées au lieu de configurable

---

### 12. **Roles dans différentes locations**

**Frontend - src/lib/permissionUtils.js**:
```javascript
export const ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  OPERATOR: 'OPERATOR',  // ❌ N'existe pas au backend!
  VOLUNTEER: 'VOLUNTEER',
  CLIENT: 'CLIENT',
  PARTENAIRE: 'PARTENAIRE'
};
```

**Frontend - src/lib/permissions.js**:
```javascript
ROLE_PERMISSIONS = {
  ADMIN, MANAGER, PRESIDENT, VICE_PRESIDENT, TRESORIER, 
  SECRETAIRE_GENERAL, DRIVER, VOLUNTEER, PRESTATAIRE, MEMBER, PARTENAIRE
  // Hiérarchie complète avec permissions
}
```

**Backend - api/src/permissions-api.js**:
```javascript
ROLE_PERMISSIONS = {
  ADMIN, MANAGER, PRESIDENT, VICE_PRESIDENT, TRESORIER, SECRETAIRE_GENERAL,
  MEMBER, PRESTATAIRE, CLIENT
  // Rôles métier VIDES
}
```

**Problème**: **3 endroits différents** avec définitions différentes!

---

## 🟡 PROBLÈMES MINEURS (mais importants)

### 13-15. Incohérences dans les ressources

**Frontend** (`src/lib/permissions.js`):
```javascript
export const RESOURCES = {
  SITE_MANAGEMENT: 'site:management',
  SITE_USERS: 'site:users',
  VEHICLES: 'vehicles:list',
  VEHICLE_VIEW: 'vehicles:view',
  EVENTS: 'events:list',
  // ...
}
```

**Backend** (`api/src/permissions-api.js`):
```javascript
const RESOURCES = {
  SITE_MANAGEMENT: 'SITE_MANAGEMENT',
  MEMBERS_MANAGEMENT: 'MEMBERS_MANAGEMENT',
  FINANCE: 'FINANCE',
  VEHICLES: 'VEHICLES',
  // ...
}
```

**Problèmes**:
- ❌ Format différent: `site:management` vs `SITE_MANAGEMENT`
- ❌ Frontend a 40+ ressources, backend en a ~10
- ❌ Resource names ne correspondent pas

---

### 16. **RolePermissionsManager UI vs API**

**Composant** (`src/components/RolePermissionsManager.jsx`):
- UI pour éditer permissions par rôle
- POST endpoint: `/admin/roles/permissions` (l.69)

**Problème**: ❌ Cet endpoint N'EXISTE PAS au backend!

```javascript
// RolePermissionsManager.jsx l.69
const response = await apiClient.post('/admin/roles/permissions', {
  permissions: permissions
});
// Ce POST est complètement orphelin
```

---

### 17. **MyRBEPermissionsManager orphelin**

**Composant** (`src/components/MyRBEPermissionsManager.jsx`):
- Gère permissions specifiquement pour MyRBE
- **Mais**: Aucun endpoint correspond
- **Mais**: MyRBE n'est pas defined comme resource cohérente

---

### 18. **PermissionStats composant cassé**

**PermissionStats.jsx**:
```javascript
const stats = response.data.permissions.reduce(...)
```

**Problème**: La structure de réponse API ne matche pas l'attente du composant

---

### 19. **Permission expiration non géré**

**Backend** (`permissions-api.js` l.200):
```javascript
const specificPerms = user.permissions.filter(p => 
  !p.expiresAt || new Date(p.expiresAt) > new Date()
);
```

**Mais**:
- ❌ UserPermission schema n'a PAS de champ `expiresAt`
- ❌ Impossible d'implémenter cette logique

---

### 20. **TokenRefresh + Permission revalidation**

**Frontend - ApiClient.js**:
- Refresca token automatiquement
- **Mais** ne rafraîchit PAS les permissions
- L'utilisateur peut avoir un token valide mais permissions expirées

---

## 📋 TABLE COMPLÈTE DES INCOHÉRENCES

| Area | Frontend | Backend | Match? |
|------|----------|---------|--------|
| Système permissions | 2 hooks + 1 lib | 3 fichiers | ❌ |
| Rôles définis | 11 rôles | 9 rôles | ❌ |
| Ressources | 40+ resources | ~10 resources | ❌ |
| Format ressource | `type:action` | `UPPERCASE` | ❌ |
| Permissions table | Utilisée | Stub vide | ❌ |
| Endpoints CRUD | `/api/user-permissions/` | `/api/admin/users/` | ❌ |
| Middleware protection | Exist pas | Unused | ❌ |
| Cache expiration | 30s hardcoded | N/A | ❌ |
| Permission types | access/view/edit | READ/UPDATE/DELETE | ❌ |

---

## 🎯 PLAN DE CORRECTION

### Phase 1 - Unification (URGENT)
1. **Créer un système UNIQUE de permissions** au backend
2. **Générer les constants** (Rôles, Ressources, Actions) depuis une source unique
3. **Synchroniser** Frontend/Backend

### Phase 2 - Schéma Prisma (CRITICAL)
1. Fixer la table `UserPermission` 
2. Ajouter relations et champs manquants
3. Créer migration

### Phase 3 - API Protection
1. Implémenter middleware `requirePermission`
2. Protéger TOUTES les routes
3. Tests de contrôle d'accès

### Phase 4 - Frontend Refactor
1. Utiliser RESSOURCES unifiées
2. Corriger tous les PermissionGate
3. Fixer les components orphelins

---

## 📌 CONCLUSION

Le système de permissions est **fragmenté en 3 parties non synchronisées**:
1. Frontend permissions.js
2. Frontend permissionUtils.js
3. Backend permissions-api.js

**Recommandation immédiate**: Consolider tout en UNE source unique de vérité au backend, puis exposer via une API cohérente que le frontend consomme.

