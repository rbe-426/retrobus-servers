# Modularisation du Serveur API

## 🎯 Objectif
Transformer server.js (3000 lignes) en une architecture modulaire et maintenable.

## 📁 Structure

```
api/src/
├── server.js                    # Fichier principal (point d'entrée réduit)
├── routes/                      # Définition des routes (endpoints)
│   ├── auth.routes.js          # Routes d'authentification ✅
│   ├── system.routes.js        # Routes système ✅
│   ├── members.routes.js       # Routes membres (TODO)
│   ├── vehicles.routes.js      # Routes véhicules (TODO)
│   ├── finance.routes.js       # Routes finance (TODO)
│   ├── events.routes.js        # Routes événements (TODO)
│   └── ...
├── controllers/                 # Logique des endpoints
│   ├── authController.js       # Contrôles login, tokens ✅
│   ├── memberController.js     # CRUD membres (TODO)
│   ├── vehicleController.js    # CRUD véhicules (TODO)
│   ├── financeController.js    # Logique finance (TODO)
│   └── ...
├── services/                    # Logique métier et BD
│   ├── userService.js          # Gestion utilisateurs ✅
│   ├── memberService.js        # Gestion membres (TODO)
│   ├── vehicleService.js       # Gestion véhicules (TODO)
│   ├── financeService.js       # Gestion finance (TODO)
│   └── ...
├── middleware/                  # Middlewares personnalisés
│   ├── auth.middleware.js      # Authentification (TODO)
│   ├── validation.middleware.js # Validation requêtes (TODO)
│   ├── errorHandler.middleware.js # Gestion erreurs (TODO)
│   └── ...
├── lib/                         # Utilitaires
│   ├── tokenService.js         # Gestion JWT ✅
│   ├── passwordUtils.js        # Hash passwords
│   └── ...
└── security.js                  # Configuration sécurité

```

## 🚀 Comment continuer la modularisation

### Pattern à suivre pour chaque feature:

#### 1. Créer la route (`routes/feature.routes.js`)
```javascript
import express from 'express';
import * as controller from '../controllers/featureController.js';

const router = express.Router();
router.get('/', controller.list);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);

export default router;
```

#### 2. Créer le contrôleur (`controllers/featureController.js`)
```javascript
import * as service from '../services/featureService.js';

export const list = async (req, res) => {
  try {
    const items = await service.findAll();
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const create = async (req, res) => {
  try {
    const item = await service.create(req.body);
    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ... update, delete
```

#### 3. Créer le service (`services/featureService.js`)
```javascript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const findAll = async () => {
  return await prisma.feature.findMany();
};

export const create = async (data) => {
  return await prisma.feature.create({ data });
};

// ... update, delete, autres logiques métier
```

#### 4. Ajouter la route dans server.js
```javascript
import featureRoutes from './routes/feature.routes.js';
app.use('/api/feature', featureRoutes);
```

## ✅ Routes déjà modularisées

### Auth (`/api/auth/`)
- ✅ `POST /api/auth/login` - Login simple
- ✅ `POST /api/auth/member-login` - Login membre
- ✅ `POST /api/auth/refresh-token` - Rafraîchir token JWT
- ✅ `GET /api/auth/me` - Utilisateur courant

### System (`/health`, `/api/health`, `/api/version`, `/api/status`)
- ✅ Health checks
- ✅ Version info
- ✅ Status endpoint

## 📋 Routes à modulariser (by priority)

### High Priority (Sécurité + Données sensibles)
1. **Members** (`GET/POST/PUT/DELETE /api/members`) - ~500 lignes
2. **Finance** (`GET/POST /api/finance/*`) - ~800 lignes  
3. **Vehicles** (`GET/POST /api/vehicles`) - ~400 lignes

### Medium Priority
4. Events - ~300 lignes
5. Flashes - ~100 lignes
6. Newsletter - ~200 lignes

### Nice to Have
7. Other routes - ~400 lignes

## ⚡ Avantages de la modularisation

| Avant | Après |
|-------|-------|
| 3000 lignes dans 1 fichier | -1000 lignes par fichier maximum |
| Impossible de trouver un bug | Recherche sectorisée par feature |
| Pas de réutilisabilité | Services réutilisables |
| Pas de tests | Facile à tester par module |
| 1 personne peut coder à la fois | Plusieurs développeurs en parallèle |
| Modifications = risque crash | Isolation des changements |

## 🔨 Étapes suivantes

1. **Appliquer le pattern** aux routes Members (~2h)
2. **Extraire Finance** (~3h)
3. **Refactoriser Vehicles** (~2h)
4. **Tester chaque module** (~2h)
5. **Retirer du server.js** (~1h)

**Total estimé: 10h de travail**, à faire de manière itérative.

## 📚 Ressources

- Pattern MVC: https://developer.mozilla.org/en-US/docs/Glossary/MVC
- Express Router: https://expressjs.com/en/api/router.html
- Prisma Client: https://www.prisma.io/docs/reference/api-reference/prisma-client-reference

## 💡 Tips

- **Ne pas casser les routes existantes** - garder la backward compatibility 
- **Tester les endpoints** après chaque extraction
- **Garder les erreurs cohérentes** - même format d'erreur partout
- **Utiliser des services** pour partager la logique
- **Documenter les routes** avec les paramètres et réponses
