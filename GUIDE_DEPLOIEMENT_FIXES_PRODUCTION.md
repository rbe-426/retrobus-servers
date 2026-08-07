# 🚀 Guide de Déploiement - Fixes Production

## ❌ Problèmes Identifiés

### 1. **Annonces d'accueil** → Table `HomeAnnouncement` manquante en production
### 2. **Images RétroActus** → Déjà fixé dans le code (URLs absolues), mais Railway doit redéployer

---

## ✅ Solution : Appliquer le schéma Prisma sur Railway

### **Option A : Via Railway Dashboard (Recommandé)**

1. **Allez sur Railway Dashboard** : https://railway.app/dashboard
2. **Sélectionnez** votre projet API (`attractive-kindness...`)
3. **Cliquez** sur l'onglet **"Deployments"**
4. **Trouvez** le dernier déploiement (celui avec le commit "mise à jour")
5. **Cliquez** sur les **3 points** → **"View Logs"**
6. **Vérifiez** si vous voyez :
   ```
   Running prisma generate...
   ✓ Generated Prisma Client
   ```

7. **Si ça ne s'est pas fait automatiquement**, forcez un redéploiement :
   - Cliquez sur **"Redeploy"** en haut à droite

---

### **Option B : Depuis votre terminal local (Avancé)**

#### **Prérequis** :
- DATABASE_URL Railway dans votre `.env`

#### **Étapes** :

```powershell
cd C:\Dev\RETROBUS_ESSONNE\interne\api

# 1. Vérifier que DATABASE_URL pointe vers Railway
Get-Content .env | Select-String "DATABASE_URL"

# 2. Appliquer le schéma Prisma
npx prisma db push --skip-generate

# 3. Générer le client Prisma
npx prisma generate

# 4. Vérifier que la table existe
npx prisma studio
# → Regarder si "HomeAnnouncement" apparaît dans la liste des modèles
```

---

## 📋 Vérification Post-Déploiement

### **1. Vérifier les annonces d'accueil**

**URL** : https://www.retrobus-interne.fr/  
**Page** : Site Management → Annonces d'Accueil

**Attendu** :
- ✅ Liste des annonces charge (même si vide)
- ✅ Boutons "Test Info/Warning/Critical" fonctionnels
- ✅ Pas d'erreur "Le serveur a renvoyé une page HTML..."

**Si erreur persiste** :
1. Ouvrez F12 → Console
2. Notez l'URL appelée (devrait être `https://attractive-kindness-rbe-serveurs.up.railway.app/api/home-announcements`)
3. Testez directement dans le navigateur :
   ```
   https://attractive-kindness-rbe-serveurs.up.railway.app/api/home-announcements
   ```
4. Vous devriez voir `[]` (tableau JSON vide) au lieu d'une page HTML

---

### **2. Vérifier les images RétroActus**

**URL** : https://www.retrobus-interne.fr/  
**Page** : Gestion du site → RétroActus

**Test** :
1. Cliquez sur "Créer une RétroActu"
2. Ajoutez un titre
3. Cliquez "Ajouter un média"
4. Uploadez une image JPG/PNG
5. Sauvegardez

**Attendu** :
- ✅ Upload réussit
- ✅ Image s'affiche dans la preview
- ✅ URL de l'image commence par `https://attractive-kindness-rbe-serveurs.up.railway.app/uploads/retroactus/...`

**Si l'image ne s'affiche toujours pas** :
1. Clic droit sur l'image cassée → "Inspecter"
2. Regardez l'URL dans l'attribut `src`
3. Si c'est `/uploads/...` (relatif), Railway n'a pas redéployé
4. Forcez le redéploiement (Option A ci-dessus)

---

## 🔧 Script de Vérification Rapide

```powershell
# Test endpoint annonces
Invoke-RestMethod -Uri "https://attractive-kindness-rbe-serveurs.up.railway.app/api/home-announcements" -Method GET

# Devrait retourner un tableau JSON (même vide)
# ✅ Bon : []
# ❌ Erreur : HTML ou "Cannot read properties of undefined..."
```

---

## 📊 Checklist Complète

- [ ] Railway a redéployé automatiquement (vérifier Deployments)
- [ ] Schema Prisma appliqué (`npx prisma db push` ou via Railway)
- [ ] Table HomeAnnouncement existe (vérifier avec Prisma Studio)
- [ ] Endpoint `/api/home-announcements` retourne JSON
- [ ] Annonces d'accueil fonctionnent sur le dashboard admin
- [ ] Images RétroActus s'affichent correctement
- [ ] URLs images sont absolues (`https://...` au lieu de `/uploads/...`)

---

## ⚠️ Si Rien ne Fonctionne

### **Redéploiement forcé complet** :

```powershell
cd C:\Dev\RETROBUS_ESSONNE\interne\api

# 1. Commit vide pour forcer Railway
git commit --allow-empty -m "chore: force Railway rebuild - Prisma schema + media URLs"
git push origin main

# 2. Attendre 3-5 minutes

# 3. Vérifier les logs Railway :
# https://railway.app/dashboard → Projet → Deployments → Logs

# 4. Chercher dans les logs :
#    ✅ "✓ Generated Prisma Client"
#    ✅ "Database schema applied successfully"
#    ✅ "Server listening on port 8080"
```

---

## 🆘 Support

Si après tout ça les problèmes persistent :
1. Capture d'écran de l'erreur Console (F12)
2. Logs Railway (Deployments → View Logs)
3. Test manuel : `https://attractive-kindness-rbe-serveurs.up.railway.app/api/home-announcements`
