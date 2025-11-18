# 🔐 SYSTÈME UNIFIÉ DE PERMISSIONS PAR FONCTION

## Vue d'ensemble

Le système de permissions est basé sur des **fonctions individuelles** que tu peux accorder/révoquer à chaque utilisateur indépendamment.

Chaque utilisateur peut avoir:
- Aucune fonction (pas d'accès) 
- Quelques fonctions spécifiques (accès limité)
- Toutes les fonctions d'un groupe (ex: GROUPE_OPERATEUR)
- Toutes les fonctions (ADMIN)

## Architecture Unifiée

```
┌─────────────────────────────────────┐
│  FunctionPermissions.js             │
│  - Matrice complète des 50+ fonctions│
│  - Descriptions pour l'UI            │
│  - Groupes prédéfinis                │
└────────────────┬────────────────────┘
                 │
      ┌──────────┴──────────┐
      │                     │
┌─────────────────┐   ┌─────────────────────┐
│ PermissionCore │   │ FunctionPermissions │
│ Logic:         │   │ Database:           │
│ - checkAccess()│   │ UserFunctionPerm    │
│ - grant()      │   │ (userId, functionId)│
│ - revoke()     │   │                     │
└────────┬───────┘   └─────────────────────┘
         │
    ┌────┴──────────┐
    │               │
┌──────────────┐  ┌──────────────┐
│ Backend API  │  │  Middleware  │
│ /functions   │  │ requireFunc  │
└──────┬───────┘  └──────┬───────┘
       │                 │
       └────────┬────────┘
                │
      ┌─────────┴─────────┐
      │                   │
  ┌─────────────┐   ┌──────────────┐
  │  Frontend   │   │  Admin Panel  │
  │  Hooks:     │   │  Manage:      │
  │  useFunc    │   │  - Grant      │
  │  Components │   │  - Revoke     │
  │  Show/Hide  │   │  - Groups     │
  └─────────────┘   └──────────────┘
```

## Les 50+ Fonctions

### Véhicules (6 fonctions)
- `vehicles.view` - Voir les véhicules
- `vehicles.create` - Créer un véhicule
- `vehicles.edit` - Modifier
- `vehicles.delete` - Supprimer
- `vehicles.maintenance` - Gérer la maintenance
- `vehicles.usage` - Enregistrer les usages

### Planning (5 fonctions)
- `planning.view` - Voir le planning
- `planning.create` - Créer un événement
- `planning.edit` - Modifier
- `planning.delete` - Supprimer
- `planning.assign` - Assigner les ressources

### Tickets Support (5 fonctions)
- `tickets.view` - Voir les tickets
- `tickets.create` - Créer un ticket
- `tickets.respond` - Répondre
- `tickets.close` - Fermer
- `tickets.manage` - Gestion complète

### RétroDemandes (5 fonctions)
- `retrodemandes.view` - Voir les demandes
- `retrodemandes.create` - Créer
- `retrodemandes.edit` - Modifier ses demandes
- `retrodemandes.approve` - Approuver/rejeter
- `retrodemandes.recap` - Voir le récapitulatif

### RetroMail (4 fonctions)
- `retromail.view` - Accéder à RetroMail
- `retromail.send` - Envoyer des messages
- `retromail.read` - Lire les messages
- `retromail.delete` - Supprimer

### Finances (5 fonctions)
- `finance.view` - Voir les finances
- `finance.create` - Créer une transaction
- `finance.edit` - Modifier
- `finance.delete` - Supprimer
- `finance.report` - Générer des rapports

### Événements (5 fonctions)
- `events.view` - Voir
- `events.create` - Créer
- `events.edit` - Modifier
- `events.delete` - Supprimer
- `events.participants` - Gérer participants

### Membres (6 fonctions)
- `members.view` - Voir
- `members.create` - Créer
- `members.edit` - Modifier
- `members.delete` - Supprimer
- `members.payments` - Cotisations
- `members.documents` - Documents

### Stocks (5 fonctions)
- `stock.view` - Voir
- `stock.create` - Ajouter
- `stock.edit` - Modifier
- `stock.delete` - Supprimer
- `stock.transfer` - Transférer

### Newsletter (4 fonctions)
- `newsletter.view` - Voir
- `newsletter.create` - Créer
- `newsletter.send` - Envoyer
- `newsletter.subscribers` - Gérer abonnés

### Gestion du Site (4 fonctions)
- `site.view` - Voir
- `site.edit` - Modifier contenu
- `site.config` - Configurer
- `site.changelog` - Gérer changelog

### Permissions (3 fonctions)
- `permissions.view` - Voir les permissions
- `permissions.edit` - Modifier
- `permissions.admin` - Admin complet

### Rapports (3 fonctions)
- `reports.view` - Voir
- `reports.generate` - Générer
- `reports.export` - Exporter

### Support (3 fonctions)
- `support.view` - Voir
- `support.respond` - Répondre
- `support.manage` - Gérer

## Groupes Prédéfinis

### ADMIN
- ✅ Toutes les 50+ fonctions
- Bypass automatique

### MANAGER
- ✅ 30+ fonctions (tous les outils de gestion)
- ❌ Pas PERMISSIONS_MANAGEMENT

### OPERATEUR  
- ✅ 15 fonctions (utilisation des outils)
- Véhicules, Planning, Tickets, Demandes, Events, Mail

### VOLUNTEER
- ✅ 6 fonctions (lecture seulement)
- Véhicules, Planning, Événements, Membres, Stocks, Mail (read-only)

### CLIENT
- ❌ Pas d'accès par défaut
- Accord individuel requis

### PARTENAIRE
- ❌ Pas d'accès par défaut
- Accord individuel requis

## Backend: API Endpoints

### GET `/api/functions`
Lister toutes les 50+ fonctions avec descriptions

```bash
curl http://localhost:3001/api/functions
```

Response:
```json
{
  "success": true,
  "count": 56,
  "functions": [
    {
      "id": "vehicles.view",
      "key": "VEHICLES_VIEW",
      "module": "Véhicules",
      "name": "Voir les véhicules",
      "description": "Accès en lecture aux véhicules et détails",
      "icon": "FiTruck"
    }
  ],
  "byModule": { ... }
}
```

### GET `/api/functions/user/:userId`
Obtenir les fonctions d'un utilisateur

```bash
curl -H "Authorization: Bearer token" \
  http://localhost:3001/api/functions/user/cmhrpbmf60000m6ns8yilynsv
```

Response:
```json
{
  "success": true,
  "userId": "cmhrpbmf60000m6ns8yilynsv",
  "functions": [
    "vehicles.view",
    "vehicles.create",
    "planning.view",
    "retrodemandes.view"
  ],
  "count": 4
}
```

### POST `/api/functions/grant`
Accorder une fonction (admin only)

```bash
curl -X POST http://localhost:3001/api/functions/grant \
  -H "Authorization: Bearer admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "cmhrpbmf60000m6ns8yilynsv",
    "functionId": "vehicles.create",
    "reason": "Opérateur véhicules",
    "expiresAt": "2025-12-31T23:59:59Z"
  }'
```

### DELETE `/api/functions/revoke`
Révoquer une fonction (admin only)

```bash
curl -X DELETE http://localhost:3001/api/functions/revoke \
  -H "Authorization: Bearer admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "cmhrpbmf60000m6ns8yilynsv",
    "functionId": "vehicles.create"
  }'
```

### POST `/api/functions/grant-group`
Accorder un groupe de fonctions (admin only)

```bash
curl -X POST http://localhost:3001/api/functions/grant-group \
  -H "Authorization: Bearer admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "cmhrpbmf60000m6ns8yilynsv",
    "groupName": "GROUPE_OPERATEUR"
  }'
```

## Frontend: Hooks

### `useFunctionPermissions(userId)`

```javascript
import { useFunctionPermissions } from '../hooks/useFunctionPermissions';
import { ACCESS } from '../lib/functionUtils';

function MyComponent() {
  const { 
    functions,           // Array de fonctions accordées
    loading,            // Boolean
    error,              // String | null
    hasFunction,        // (functionId) => boolean
    hasAnyFunction,     // (functionIds[]) => boolean
    hasAllFunctions,    // (functionIds[]) => boolean
    invalidateCache,    // () => void
    checkFunctionDirect // (functionId) => Promise<boolean>
  } = useFunctionPermissions(userId);

  if (loading) return <Spinner />;

  return (
    <>
      {hasFunction(ACCESS.VEHICLES_CREATE) && (
        <Button onClick={handleCreate}>Créer un véhicule</Button>
      )}

      {hasAnyFunction([ACCESS.VEHICLES_EDIT, ACCESS.VEHICLES_DELETE]) && (
        <div>Outils de modification</div>
      )}
    </>
  );
}
```

### `useFunctionManagement()` (Admin)

```javascript
import { useFunctionManagement } from '../hooks/useFunctionPermissions';

function AdminPanel() {
  const {
    functions,      // Toutes les 50+ fonctions
    groups,         // Groupes disponibles
    loading,
    grantFunction,  // (userId, functionId, reason, expiresAt) => Promise
    revokeFunction, // (userId, functionId) => Promise
    grantGroup      // (userId, groupName) => Promise
  } = useFunctionManagement();

  const handleGrant = async () => {
    await grantFunction(
      'cmhrpbmf60000m6ns8yilynsv',
      'vehicles.create',
      'Opérateur véhicules'
    );
  };

  const handleGrantGroup = async () => {
    await grantGroup(
      'cmhrpbmf60000m6ns8yilynsv',
      'GROUPE_OPERATEUR'
    );
  };

  return (/* UI for managing */);
}
```

## Frontend: Utilities

### `functionUtils.js`

```javascript
import {
  canAccessFunction,
  hasAnyFunction,
  hasAllFunctions,
  groupFunctionsByModule,
  ACCESS
} from '../lib/functionUtils';

// Vérifier une fonction
if (canAccessFunction(userFunctions, ACCESS.VEHICLES_CREATE)) {
  // Afficher bouton créer
}

// Vérifier plusieurs fonctions
if (hasAnyFunction(userFunctions, [ACCESS.VEHICLES_EDIT, ACCESS.VEHICLES_DELETE])) {
  // Afficher menu modification
}

// Grouper par module
const byModule = groupFunctionsByModule(userFunctions);
console.log(byModule.Véhicules); // Toutes les fonctions "Véhicules" de l'user
```

## Middleware Backend

```javascript
import { requireFunctionAccess } from '../core/PermissionCore';

// Protéger un endpoint
app.post('/api/vehicles', 
  requireAuth, 
  requireFunctionAccess('vehicles.create'),
  handler
);
```

## Logique de Vérification

Pour chaque fonction demandée:

1. **Admin bypass** → ✅ Accès automatique
2. **Permission individuelle en BD** → ✅ Accès si accordée, ❌ Accès si non accordée
3. **Defaults du rôle** → ✅ Accès si dans le groupe du rôle
4. **Rien de match** → ❌ Accès refusé

## Exemples Pratiques

### Admin accorde "Opérateur Véhicules" à Babacar

```javascript
await grantGroup('babacar_id', 'GROUPE_OPERATEUR');
// Babacar reçoit 15 fonctions d'opérateur
```

### Babacar ne peut que voir les tickets, pas les créer

```javascript
await revokeFunction('babacar_id', 'tickets.create');
// Babacar perd le droit de créer des tickets
```

### Admin crée un accès temporaire pour un partenaire

```javascript
const expiresAt = new Date();
expiresAt.setMonth(expiresAt.getMonth() + 1);

await grantFunction(
  'partenaire_id',
  'vehicles.view',
  'Accès temporaire pour audit',
  expiresAt
);
```

### Interface Admin: Matrice d'Autorisations

```javascript
// UI matrix: 
// Lignes = Utilisateurs
// Colonnes = Fonctions (50+)
// Case cochée = Accès accordé
// Clic = Accorder/Révoquer immédiatement
```

## Migration de l'Ancien Système

### Avant ❌

```javascript
// Ancien système par ressource + action
canAccess('VEHICLES', 'CREATE')
permissions.find(p => p.resource === 'VEHICLES')
```

### Après ✅

```javascript
// Nouveau système par fonction
canAccessFunction(functions, 'vehicles.create')
hasFunction('vehicles.create')
```

## Base de Données

### Table: `user_function_permissions`

```sql
id              UUID
userId          String (FK)
functionId      String ('vehicles.create', etc.)
expiresAt       DateTime (null = permanent)
grantedBy       String (admin id)
grantedAt       DateTime
reason          String
createdAt       DateTime
updatedAt       DateTime

UNIQUE(userId, functionId)
```

## Déploiement

1. **Générer migration Prisma:**
   ```bash
   cd interne/api
   npx prisma migrate dev --name add_function_permissions
   ```

2. **Déployer:**
   ```bash
   git add -A
   git commit -m "feat: Unified function-based permission system"
   git push origin main
   ```

3. **Tester:**
   - Admin peut accorder des fonctions
   - Utilisateurs voient uniquement leurs fonctions
   - API retourne 403 pour fonctions non accordées

## Checklist de Déploiement

- [ ] Migration Prisma appliquée
- [ ] Backend déployé avec `/api/functions` endpoints
- [ ] Frontend peut charger les fonctions d'un user
- [ ] Admin panel permet grant/revoke
- [ ] Tous les endpoints protégés avec `requireFunctionAccess`
- [ ] Cache localStorage fonctionne
- [ ] Tests avec différents rôles
- [ ] Documentation mise à jour
