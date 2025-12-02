# 🔄 Workflow Nettoyage et Synchronisation Données

## Problème Original
Les données supprimées réapparaissaient à cause d'un système hybride Prisma + mémoire + backups:
- Backups chargés au démarrage écrasaient les données Prisma
- Les modifications restaient en mémoire et se sauvegardaient automatiquement
- Les fallbacks mémoire servaient les vieilles données quand Prisma échouait

## Solution Déployée

### 3 Toggles Environnement

```env
# ✅ Désactiver le chargement automatique des backups au démarrage
LOAD_BACKUP_AT_BOOT=false

# ✅ Désactiver l'utilisation de la mémoire comme fallback
ENABLE_MEMORY_FALLBACK=false

# ✅ Désactiver la sauvegarde automatique en mémoire sur disque
ENABLE_RUNTIME_STATE_SAVE=false
```

### Comportement Après Activation des Toggles

| Endpoint | Prisma OK | Prisma DOWN | ENABLE_MEMORY_FALLBACK=false |
|----------|-----------|-------------|-----|
| GET /api/events | ✅ Prisma data | ❌ 503 Service Unavailable | N/A |
| GET /api/vehicles | ✅ Prisma data | ❌ 503 Service Unavailable | N/A |
| POST /api/events | ✅ Prisma create | ❌ 503 Service Unavailable | N/A |
| DELETE /api/events/:id | ✅ Prisma delete | ❌ 503 Service Unavailable | N/A |

**Résultat**: Aucune mutation accidentelle en mémoire. Les suppressions persistent à la DB.

---

## Workflow Recommandé: Nettoyage + Resync

### Étape 1: Sauvegarder l'état courant (optionnel)

```bash
cd interne/api
node backup-from-memory.mjs  # ou backup-utils.mjs
```

### Étape 2: Purger les données en mémoire

```bash
# Supprimer les backups chargés en mémoire
rm -rf backups/runtime-state.json
rm -rf backups/restore-info.json

# Optionnel: archiver les anciens backups
mkdir -p backups/archive
mv backups/backup_*.* backups/archive/
```

### Étape 3: Nettoyer la base Prisma PostgreSQL

**Si la DB PostgreSQL est accessible**, utiliser Prisma:

```bash
# Réinitialiser les migrations (destructif!)
npx prisma migrate reset --force

# Ou supprimer les tables individuelles
npx prisma db execute --stdin <<EOF
DELETE FROM Vehicle;
DELETE FROM Event;
DELETE FROM member;
-- ... autres tables
EOF
```

**Si la DB PostgreSQL est indisponible**, passer à l'étape 4.

### Étape 4: Réinitialiser ou Mettre à Jour les Données

#### Option A: Charger un backup propre comme point de départ

```bash
# Placer le backup propre dans backups/
# Créer restore-info.json avec:
cat > backups/restore-info.json <<EOF
{
  "backupToRestore": "backup_clean_name",
  "reason": "Clean reset from reliable backup",
  "timestamp": "$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
}
EOF

# Au redémarrage, le serveur chargera ce backup en mémoire
npm run dev
```

#### Option B: Démarrer vierge (recommandé avec Prisma en prod)

```bash
# Nettoyer les fichiers de sauvegarde
rm -rf backups/*

# Redémarrer avec variables d'environnement
LOAD_BACKUP_AT_BOOT=false \
ENABLE_MEMORY_FALLBACK=false \
ENABLE_RUNTIME_STATE_SAVE=false \
npm run dev
```

### Étape 5: Vérifier la Synchronisation

```bash
# Tester les endpoints avec Prisma comme unique source
curl -X GET http://localhost:3001/api/events \
  -H "Authorization: Bearer $TOKEN"

curl -X GET http://localhost:3001/api/vehicles \
  -H "Authorization: Bearer $TOKEN"

# Véhicules publics (sans auth)
curl http://localhost:3001/public/vehicles
```

Attendu:
- ✅ Données depuis Prisma seul
- ❌ Pas de fallback mémoire stale
- ✅ Les suppressions persistent

---

## Configuration pour Développement vs Production

### Développement (Flexible - Fallback OK)

```env
LOAD_BACKUP_AT_BOOT=true
ENABLE_MEMORY_FALLBACK=true
ENABLE_RUNTIME_STATE_SAVE=true
NODE_ENV=development
```

✅ Permet de tester sans DB PostgreSQL  
⚠️ Donnée peut rester stale si déploiement production

### Production (Strict - Prisma Only)

```env
LOAD_BACKUP_AT_BOOT=false
ENABLE_MEMORY_FALLBACK=false
ENABLE_RUNTIME_STATE_SAVE=false
NODE_ENV=production
```

✅ Garantit les suppressions persistent  
✅ Pas de données fantômes du backup  
✅ PostgreSQL est l'unique source

### Test/Migration (Strict après nettoyage)

```env
LOAD_BACKUP_AT_BOOT=false
ENABLE_MEMORY_FALLBACK=false
ENABLE_RUNTIME_STATE_SAVE=false
```

✅ Permet de migrer les données vers une DB neuve  
✅ Force Prisma une fois DB prête

---

## Dépannage

### Problème: `Prisma indisponible et fallback mémoire désactivé`

**Cause**: PostgreSQL inaccessible + `ENABLE_MEMORY_FALLBACK=false`

**Solutions**:
1. Démarrer PostgreSQL
2. Ou activer `ENABLE_MEMORY_FALLBACK=true` temporairement
3. Ou charger un backup via `restore-info.json`

### Problème: Données inexistantes après DELETE

**Cause**: Bon! Aucune donnée en mémoire, suppression a fonctionné.

**Vérifier**: Les données sont dans PostgreSQL?
```bash
npx prisma studio
# Vérifier les tables Vehicle, Event, etc.
```

### Problème: Backups réapparaissent constamment

**Cause**: `LOAD_BACKUP_AT_BOOT=true` + `restore-info.json` présent

**Solution**:
```bash
# Nettoyer
rm backups/restore-info.json
# Ou définir
LOAD_BACKUP_AT_BOOT=false
```

---

## Checklist Déploiement Sûr

- [ ] PostgreSQL opérationnel (`DATABASE_URL` valide)
- [ ] `LOAD_BACKUP_AT_BOOT=false` dans `.env`
- [ ] `ENABLE_MEMORY_FALLBACK=false` dans `.env`
- [ ] `ENABLE_RUNTIME_STATE_SAVE=false` dans `.env`
- [ ] `rm backups/restore-info.json` (force pas de chargement backup)
- [ ] `npm run dev` — attendre logs "Prisma initialisé"
- [ ] Tester création/suppression événement: `POST /api/events` + `DELETE /api/events/:id`
- [ ] Redémarrer serveur — vérifie que données persisten via Prisma
- [ ] Pusher à production

---

## Logs à Chercher

**Bon**: Prisma initialisé seul
```
✅ Prisma initialisé - DATABASE_URL valide
```

**Bon**: Aucun backup chargé
```
⏭️  LOAD_BACKUP_AT_BOOT=false - aucun backup chargé au démarrage
```

**Mauvais**: Backup chargé avec toggle actif
```
📦 Chargement du backup: backup_2025-12-02T02-06-21
```

**Mauvais**: Fallback en mémoire utilisé
```
🧠 Vehicle modifié en mémoire: 920
```

---

## Résumé Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   API RETROBUS                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  📥 Requête GET /api/events                            │
│        ↓                                                │
│  ✅ Prisma.event.findMany()                            │
│        ├─ OK → Retourner données DB ✅                │
│        └─ ERREUR →                                     │
│           ├─ ENABLE_MEMORY_FALLBACK=true  → mémoire    │
│           └─ ENABLE_MEMORY_FALLBACK=false → 503        │
│                                                         │
│  📥 Requête DELETE /api/events/:id                    │
│        ↓                                                │
│  ✅ Prisma.event.delete()                             │
│        ├─ OK → Suppr DB + sync mémoire ✅             │
│        └─ ERREUR →                                     │
│           ├─ ENABLE_MEMORY_FALLBACK=true  → suppr mem  │
│           └─ ENABLE_MEMORY_FALLBACK=false → 503        │
│                                                         │
│  💾 Sauvegarde Automatique (debouncedSave)            │
│        ├─ ENABLE_RUNTIME_STATE_SAVE=true  → disque     │
│        └─ ENABLE_RUNTIME_STATE_SAVE=false → rien       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Prochaines Étapes

1. **Vérifier PostgreSQL**:
   ```bash
   echo $DATABASE_URL
   psql $DATABASE_URL -c "SELECT COUNT(*) FROM Vehicle;"
   ```

2. **Configurer `.env.local`**:
   ```bash
   LOAD_BACKUP_AT_BOOT=false
   ENABLE_MEMORY_FALLBACK=false
   ENABLE_RUNTIME_STATE_SAVE=false
   ```

3. **Redémarrer et Tester**:
   ```bash
   npm run dev
   curl http://localhost:3001/api/vehicles
   ```

4. **Documenter en `.env.example`**:
   ```bash
   # Pour production: désactiver tous les fallbacks
   LOAD_BACKUP_AT_BOOT=false
   ENABLE_MEMORY_FALLBACK=false
   ENABLE_RUNTIME_STATE_SAVE=false
   ```
