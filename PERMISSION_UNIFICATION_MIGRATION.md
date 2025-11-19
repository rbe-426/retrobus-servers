# 🚀 UNIFICATION DES PERMISSIONS - GUIDE DE MIGRATION

**Date**: 20 novembre 2025  
**Status**: ✅ IMPLÉMENTATION COMPLÈTE  
**Impact**: CRITIQUE - Tous les systèmes de permissions  

---

## 📋 RÉSUMÉ DES CHANGEMENTS

### Backend (API)
1. ✅ **FunctionPermissions.js** - Ajout des rôles métier (PRESIDENT, TRESORIER, SECRETAIRE_GENERAL, VICE_PRESIDENT)
2. ✅ **Prisma Schema** - Fixé le modèle `UserPermission` avec structure complète
3. ✅ **unified-permissions-api.js** - Nouvelle API cohérente pour les permissions
4. ✅ **checkFunctionAccess.js** - Middleware pour protéger les routes
5. ✅ **server.js** - Intégration de la nouvelle API

### Frontend (React)
1. ✅ **useUnifiedPermissions.js** - Hook React pour consommer l'API unifiée
2. ✅ **UnifiedPermissionGate.jsx** - Composant pour contrôler l'accès
3. ⏳ À migrer: Components existants

---

## 🔧 FICHIERS MODIFIÉS

| Fichier | Type | Changement |
|---------|------|-----------|
| `api/src/core/FunctionPermissions.js` | ✅ MODIFIÉ | +4 groupes rôles métier, +4 rôles dans ROLE_FUNCTION_DEFAULTS |
| `api/prisma/schema.prisma` | ✅ MODIFIÉ | UserPermission: structure complète + relation SiteUser |
| `api/src/unified-permissions-api.js` | ✅ CRÉÉ | 6 endpoints d'API unifiée |
| `api/src/middleware/checkFunctionAccess.js` | ✅ CRÉÉ | 3 middlewares de protection |
| `api/src/server.js` | ✅ MODIFIÉ | Import + init de unified-permissions-api |
| `src/hooks/useUnifiedPermissions.js` | ✅ CRÉÉ | Hook React + 3 variantes |
| `src/components/UnifiedPermissionGate.jsx` | ✅ CRÉÉ | Composants React |

---

## 📡 NOUVEAUX ENDPOINTS API

### 1. GET `/api/permissions/definitions`
**Accès**: Public (pas d'auth)  
**Retour**: Définitions complètes des permissions (source unique de vérité)

```bash
curl http://localhost:3000/api/permissions/definitions
```

**Réponse**:
```json
{
  "functions": { "vehicles.view": "vehicles.view", ... },
  "functionGroups": { "GROUPE_ADMIN": [...], ... },
  "roleFunctionDefaults": { "ADMIN": [...], ... },
  "roles": ["ADMIN", "MANAGER", "PRESIDENT", ...],
  "totalFunctions": 54,
  "totalRoles": 10
}
```

### 2. GET `/api/permissions/my-permissions`
**Accès**: Auth requis  
**Retour**: Permissions de l'utilisateur courant

```bash
curl -H "Authorization: Bearer TOKEN" http://localhost:3000/api/permissions/my-permissions
```

**Réponse**:
```json
{
  "userId": "...",
  "role": "MEMBER",
  "rolePermissions": {
    "functions": ["vehicles.view", "planning.view", ...],
    "count": 12
  },
  "customPermissions": {
    "list": [],
    "count": 0
  },
  "effectivePermissions": {
    "functions": ["vehicles.view", ...],
    "count": 12,
    "canAccess": function
  }
}
```

### 3. GET `/api/permissions/user/:userId`
**Accès**: Admin requis  
**Retour**: Permissions d'un utilisateur spécifique

### 4. POST `/api/permissions/grant`
**Accès**: Admin requis  
**Corps**:
```json
{
  "userId": "user_id",
  "function": "vehicles.edit",
  "expiresAt": "2025-12-31",
  "reason": "Maintenance exceptionnelle"
}
```

### 5. DELETE `/api/permissions/:permId`
**Accès**: Admin requis  
**Effet**: Révoque une permission

### 6. GET `/api/permissions/audit`
**Accès**: Admin requis  
**Retour**: Audit trail des permissions accordées

---

## 🎯 NOUVEAUX RÔLES DISPONIBLES

| Rôle | Fonctions Autorisées | Cas d'Usage |
|------|---------------------|-----------|
| **ADMIN** | Toutes | Administrateur système |
| **MANAGER** | Gestion complète (sauf admin) | Chef de projet |
| **PRESIDENT** | Stratégique + approbations | Président de l'association |
| **VICE_PRESIDENT** | Événements, planning | Vice-président |
| **TRESORIER** | Finances, membres | Trésorier |
| **SECRETAIRE_GENERAL** | Admin général, config | Secrétaire général |
| **MEMBER** | Lecture + création limitée | Adhérent |
| **PRESTATAIRE** | Demandes + support | Prestataire |
| **CLIENT** | Consultation/création | Client externe |
| **OPERATOR** | Opérationnel (legacy) | Backward compatibility |

---

## 💻 UTILISATION BACKEND

### Protéger une route

**Avant**:
```javascript
app.get('/api/vehicles', async (req, res) => {
  // ❌ Pas de protection!
  const vehicles = await prisma.vehicle.findMany();
  res.json(vehicles);
});
```

**Après**:
```javascript
import { checkFunctionAccess } from './middleware/checkFunctionAccess.js';

app.get('/api/vehicles', checkFunctionAccess('vehicles.view'), async (req, res) => {
  // ✅ Protégé!
  const vehicles = await prisma.vehicle.findMany();
  res.json(vehicles);
});

app.post('/api/vehicles', checkFunctionAccess('vehicles.create'), async (req, res) => {
  // ✅ Protégé!
  const vehicle = await prisma.vehicle.create({ ... });
  res.json(vehicle);
});
```

---

## 🎨 UTILISATION FRONTEND

### Hook simple

```javascript
import useUnifiedPermissions from '../hooks/useUnifiedPermissions';

function Dashboard() {
  const { canAccess, loading } = useUnifiedPermissions();
  
  if (loading) return <div>Chargement...</div>;
  
  return (
    <div>
      {canAccess('vehicles.view') && <VehiclesList />}
      {canAccess('finance.view') && <FinanceDashboard />}
    </div>
  );
}
```

### Composant PermissionGate

```javascript
import PermissionGate from '../components/UnifiedPermissionGate';

function App() {
  return (
    <>
      <PermissionGate function="vehicles.view">
        <button>Voir les véhicules</button>
      </PermissionGate>
      
      <PermissionGate any={["vehicles.create", "vehicles.edit"]}>
        <button>Créer ou modifier</button>
      </PermissionGate>
      
      <PermissionGate all={["vehicles.create", "vehicles.delete"]}>
        <button>Créer ET supprimer</button>
      </PermissionGate>
    </>
  );
}
```

### Hooks variantes

```javascript
import {
  useHasPermission,
  useHasAnyPermission,
  useHasAllPermissions
} from '../hooks/useUnifiedPermissions';

// Vérifier une seule permission
const { can: canView } = useHasPermission('vehicles.view');

// Vérifier au moins une
const { can: canEdit } = useHasAnyPermission(['vehicles.edit', 'vehicles.create']);

// Vérifier TOUTES
const { can: canManage } = useHasAllPermissions(['vehicles.create', 'vehicles.delete']);
```

---

## 🗂️ MIGRATION PROGRESSIVE

### Phase 1: Validation (FAITE)
- ✅ Fixer FunctionPermissions.js avec rôles métier
- ✅ Fixer schema UserPermission
- ✅ Créer API unifiée
- ✅ Créer hooks/composants frontend

### Phase 2: Test (À FAIRE)
1. Tester API endpoints en local
2. Tester hooks React en local
3. Vérifier cache permissions
4. Tester expiration permissions
5. Vérifier Prisma migration

### Phase 3: Déploiement (À FAIRE)
1. Générer migration Prisma
2. Déployer en prod
3. Tester chaque rôle
4. Monitorer les erreurs
5. Rollback si besoin

### Phase 4: Migration Code (À FAIRE)
1. Remplacer imports dans les pages
2. Migrer PermissionGate existants
3. Protéger les routes REST
4. Supprimer anciennes librairies
5. Tests E2E complets

---

## ⚠️ PROBLÈMES CONNUS & SOLUTIONS

### Prisma Migration
**Problème**: Schema UserPermission a changé  
**Solution**:
```bash
# Dans api/
npx prisma migrate dev --name add_user_permissions_fields
npx prisma generate
```

### Cache Permissions
**Problème**: Utilisateur voit anciennes permissions  
**Solution**: Cache 5 minutes - admin peut forcer refresh via logout  

### Routes Non Protégées
**Problème**: Routes existantes n'ont pas de middleware  
**Solution**: Ajouter `checkFunctionAccess('...')` progressivement  

### Backward Compatibility
**Problème**: Anciennes routes sans permissions  
**Solution**: Les anciennes API restent fonctionnelles (permissions-api.js) jusqu'à migration complète  

---

## 📊 CHECKLIST POST-DÉPLOIEMENT

- [ ] Prisma migration succès
- [ ] API `/api/permissions/definitions` répond
- [ ] API `/api/permissions/my-permissions` répond
- [ ] Hook `useUnifiedPermissions` charge données
- [ ] PermissionGate masque contenu sans perms
- [ ] Admin peut accorder permissions (POST /grant)
- [ ] Permissions expirées sont ignorées
- [ ] Cache permissions fonctionne (5min)
- [ ] Logout clear cache
- [ ] Chaque rôle a ses permissions par défaut
- [ ] Test avec chaque rôle métier
- [ ] Audit trail enregistre les changements

---

## 🎓 DOCUMENTATION SOURCES

**Backend**:
- `api/src/core/FunctionPermissions.js` - Définitions complètes
- `api/src/unified-permissions-api.js` - API endpoints
- `api/src/middleware/checkFunctionAccess.js` - Middlewares

**Frontend**:
- `src/hooks/useUnifiedPermissions.js` - Hook principal
- `src/components/UnifiedPermissionGate.jsx` - Composants UI

**Database**:
- `api/prisma/schema.prisma` - Schema complet

---

## 🔗 SCHÉMA DE FONCTIONNEMENT

```
┌─────────────────────────────────────────────────┐
│           FRONTEND (React)                       │
│  ┌──────────────────────────────────────────┐  │
│  │  PermissionGate / useUnifiedPermissions   │  │
│  │  - Affiche/masque le contenu             │  │
│  │  - Stocke en cache (sessionStorage)      │  │
│  └────────────┬─────────────────────────────┘  │
│               │                                  │
│               ↓ (GET /api/permissions/...)     │
├─────────────────────────────────────────────────┤
│           API BACKEND (Node.js)                 │
│  ┌──────────────────────────────────────────┐  │
│  │  /api/permissions/* endpoints             │  │
│  │  - Vérifie auth (JWT token)              │  │
│  │  - Charge rôle utilisateur               │  │
│  │  - Fusionne permissions (rôle + custom)  │  │
│  │  - Retourne effectivePermissions         │  │
│  └────────────┬─────────────────────────────┘  │
│               │                                  │
│               ↓ (Query DB)                      │
├─────────────────────────────────────────────────┤
│           DATABASE (PostgreSQL)                 │
│  ┌──────────────────────────────────────────┐  │
│  │  Tables:                                  │  │
│  │  - SiteUser (role, permissions relation)  │  │
│  │  - UserPermission (custom permissions)   │  │
│  │                                          │  │
│  │  Données:                                │  │
│  │  - Rôles par défaut: ROLE_FUNCTION_     │  │
│  │    DEFAULTS (en code)                   │  │
│  │  - Permissions custom: UserPermission    │  │
│  │  (peut expirer)                         │  │
│  └──────────────────────────────────────────┘  │
│                                                  │
│  SOURCE UNIQUE DE VÉRITÉ:                      │
│  FunctionPermissions.js (ROLE_FUNCTION_        │
│  DEFAULTS)                                     │
└─────────────────────────────────────────────────┘
```

---

## 🆘 SUPPORT & QUESTIONS

Pour questions sur:
- **API**: Voir `unified-permissions-api.js` + Postman tests
- **Frontend**: Voir `useUnifiedPermissions.js` + exemples d'usage
- **Permissions**: Voir `FunctionPermissions.js` + ROLE_FUNCTION_DEFAULTS
- **Database**: Voir `schema.prisma` model UserPermission

