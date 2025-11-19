# 🚀 DÉPLOIEMENT PERMISSIONS - GUIDE RAPIDE

**Date**: 20 novembre 2025  
**Commits**: 
- API (retroservers): `ede01cd`
- Interne (retrobus-interne): `e951379b`

---

## ✅ DÉJÀ FAIT

- ✅ FunctionPermissions.js: Rôles métier ajoutés
- ✅ schema.prisma: UserPermission fixé
- ✅ unified-permissions-api.js: 6 endpoints
- ✅ checkFunctionAccess.js: Middlewares
- ✅ useUnifiedPermissions.js: Hook React
- ✅ UnifiedPermissionGate.jsx: Composants
- ✅ Documentation complète
- ✅ Prisma client régénéré
- ✅ Commits GitHub poussés

---

## ⚡ DÉPLOIEMENT EN PRODUCTION

### 1. AVANT le déploiement (Sauvegarder la DB)

```bash
# Faire un backup PostgreSQL
pg_dump $DATABASE_URL > backup_before_permissions.sql
```

### 2. PULL en production

```bash
cd /app/retrobus-interne
git pull origin main

cd /app/retrobus-interne/api
git pull origin main
```

### 3. MIGRER Prisma

```bash
cd /app/retrobus-interne/api

# Générer la migration
npx prisma migrate dev --name add_user_permissions_complete

# OU si déploiement sur prod (pas de dev)
npx prisma migrate deploy
```

### 4. RÉGÉNÉRER client

```bash
npx prisma generate
```

### 5. RESTART le serveur

```bash
# Exemple avec pm2
pm2 restart retrobus-api

# Ou
pm2 restart all
```

### 6. VALIDER

```bash
# Tester l'API
curl http://localhost:3000/api/permissions/definitions

# Tester avec token
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:3000/api/permissions/my-permissions
```

---

## 📊 VÉRIFICATION POST-DÉPLOIEMENT

### Étape 1: API responds
```
✓ GET /api/permissions/definitions → 200 + data
✓ GET /api/permissions/my-permissions (auth) → 200 + permissions
✓ GET /api/permissions/user/:userId (admin) → 200 + user perms
✓ POST /api/permissions/grant (admin) → 201 + permission
✓ GET /api/permissions/audit (admin) → 200 + audit
```

### Étape 2: Database
```
✓ user_permissions table créée
✓ user_permissions a les colonnes: id, userId, resource, actions, expiresAt, grantedAt, grantedBy, reason
✓ SiteUser.permissions relation existe
✓ Indexes créés sur userId, resource, expiresAt
```

### Étape 3: Rôles testés
```
✓ ADMIN: Accès tout
✓ MANAGER: Accès large
✓ PRESIDENT: Vision stratégique
✓ TRESORIER: Finances
✓ SECRETAIRE_GENERAL: Admin général
✓ MEMBER: Lecture + création limitée
```

### Étape 4: Ancien code
```
✓ /api/permissions/* (anciens endpoints) continuent de marcher
✓ Pas de break dans les appels existants
```

---

## 🆘 TROUBLESHOOTING

### Erreur: "Column 'actions' not found"
**Cause**: Migration Prisma non appliquée  
**Solution**:
```bash
cd api
npx prisma migrate deploy
npx prisma generate
```

### Erreur: "relations not found"
**Cause**: Relations Prisma non synchronisées  
**Solution**:
```bash
cd api
rm -rf node_modules/.prisma
npx prisma generate
```

### 404 sur /api/permissions/*
**Cause**: API non initialisée dans server.js  
**Solution**: Vérifier `setupUnifiedPermissionsApi(app, prisma)` est appelé  

### Permissions not loading frontend
**Cause**: sessionStorage cache stale  
**Solution**: `localStorage.clear()` or logout/login  

---

## 📋 CHECKLIST DÉPLOIEMENT

**PRÉ-DÉPLOIEMENT:**
- [ ] Backup database
- [ ] Tester localement API
- [ ] Tester localement React
- [ ] Vérifier tous les commits
- [ ] Vérifier submodule tracking

**DÉPLOIEMENT:**
- [ ] Pull retrobus-interne
- [ ] Pull retroservers
- [ ] Prisma migrate deploy
- [ ] Prisma generate
- [ ] Restart serveur
- [ ] Monitor logs

**VALIDATION:**
- [ ] API /definitions répond
- [ ] API /my-permissions répond
- [ ] User can login
- [ ] Permissions affichées correctement
- [ ] PermissionGate masque/affiche contenu
- [ ] Admin peut accorder permissions
- [ ] Audit enregistre les changes

**POST-DÉPLOIEMENT:**
- [ ] Monitorer erreurs
- [ ] Vérifier chaque rôle
- [ ] Test utilisateur complet
- [ ] Confirmer backward compat

---

## 🔄 ROLLBACK (si besoin)

```bash
cd /app/retrobus-interne
git reset --hard 2efa0c38

cd /app/retrobus-interne/api
git reset --hard 2cf8fd2

# Undo prisma migration
npx prisma migrate resolve --rolled-back add_user_permissions_complete

# Restore DB
psql $DATABASE_URL < backup_before_permissions.sql

# Restart
pm2 restart all
```

---

## 📈 MONITORING POST-DÉPLOIEMENT

**Logs à surveiller:**

```bash
# Erreurs auth
grep "401\|403" /var/log/retrobus-api.log

# Erreurs permissions
grep "permission\|Permission" /var/log/retrobus-api.log

# Erreurs Prisma
grep "Prisma\|PrismaClient" /var/log/retrobus-api.log

# Performance API
grep "GET /api/permissions" /var/log/retrobus-api.log | tail -100
```

**Métriques clés:**

- Temps réponse /api/permissions/my-permissions < 500ms
- Cache hit rate > 80% (sessionStorage)
- 0 erreurs 403 pour rôles autorisés
- Permission checks < 10ms en average

---

## 🎓 PROCHAINES ÉTAPES

### Phase 2: Protection des routes (À FAIRE)
1. Ajouter middleware `checkFunctionAccess` sur chaque route
2. Tester protections
3. Vérifier audit trail

**Exemple**:
```javascript
app.get('/api/vehicles', checkFunctionAccess('vehicles.view'), handler);
app.post('/api/vehicles', checkFunctionAccess('vehicles.create'), handler);
```

### Phase 3: Migration code frontend (À FAIRE)
1. Remplacer imports `permissionUtils.js` → `useUnifiedPermissions.js`
2. Migrer PermissionGate existants
3. Supprimer anciens fichiers

### Phase 4: Tests E2E (À FAIRE)
1. Tester chaque rôle complet
2. Tester permission expiration
3. Tester cache + logout
4. Tester audit trail

---

## 📞 SUPPORT

**Questions sur l'implémentation:**
- Voir `PERMISSION_UNIFICATION_MIGRATION.md` (guide détaillé)
- Voir `AUDIT_SYSTEME_PERMISSIONS.md` (problèmes trouvés)

**Code à consulter:**
- `api/src/core/FunctionPermissions.js` - Définitions
- `api/src/unified-permissions-api.js` - API
- `api/src/middleware/checkFunctionAccess.js` - Middlewares
- `src/hooks/useUnifiedPermissions.js` - Frontend

