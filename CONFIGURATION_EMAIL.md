# 📧 Configuration Email - Fix Renouvellement Adhésion

## 🚨 Problème Identifié

Les emails de renouvellement d'adhésion ne partent pas car **les credentials SMTP ne sont pas configurées**.

## ✅ Solution Immédiate

### 1. Éditer le fichier `.env` de l'API

Ouvrir `interne/api/.env` et **renseigner les mots de passe** :

```env
# 📧 Configuration email (Infomaniak SMTP)
NOREPLY_EMAIL=noreply@association-rbe.fr
NOREPLY_PASSWORD=VOTRE_MOT_DE_PASSE_ICI

# Fallback SMTP
SMTP_HOST=mail.infomaniak.com
SMTP_PORT=587
EMAIL_USER=noreply@association-rbe.fr
EMAIL_PASSWORD=VOTRE_MOT_DE_PASSE_ICI
SMTP_USER=noreply@association-rbe.fr
SMTP_PASSWORD=VOTRE_MOT_DE_PASSE_ICI
```

### 2. Redémarrer le serveur API

```bash
cd C:\Dev\RETROBUS_ESSONNE\interne\api
# Arrêter le serveur (Ctrl+C)
npm run dev
```

### 3. Tester le renouvellement

1. Aller dans **MembersManagement** (interne)
2. Sélectionner un adhérent
3. Cliquer sur "Gestion bulletin"
4. Onglet "Renouveler l'adhésion"
5. Renseigner l'email et cliquer "Lancer le parcours"

## 🔍 Comment Ça Marche

Le système utilise **3 niveaux de fallback** :

```
┌──────────────────────────────────────────┐
│ 1. Session mail active en mémoire       │ ❌ Perdue au redémarrage
├──────────────────────────────────────────┤
│ 2. Session trouvée par email            │ ❌ Même problème
├──────────────────────────────────────────┤
│ 3. Fallback SMTP direct (env vars)      │ ✅ Toujours disponible
└──────────────────────────────────────────┘
```

**Avant la fix** : Niveau 3 échouait car `EMAIL_PASSWORD` était vide  
**Après la fix** : Niveau 3 fonctionne avec les credentials configurées

## 📝 Variables d'Environnement Ajoutées

| Variable | Rôle | Valeur |
|----------|------|--------|
| `NOREPLY_EMAIL` | Email expéditeur | `noreply@association-rbe.fr` |
| `NOREPLY_PASSWORD` | Mot de passe (auto-connexion) | **À renseigner** |
| `SMTP_HOST` | Serveur SMTP Infomaniak | `mail.infomaniak.com` |
| `SMTP_PORT` | Port SMTP | `587` |
| `EMAIL_USER` | Utilisateur SMTP (fallback) | `noreply@association-rbe.fr` |
| `EMAIL_PASSWORD` | Mot de passe SMTP (fallback) | **À renseigner** |
| `SMTP_USER` | Alias de EMAIL_USER | `noreply@association-rbe.fr` |
| `SMTP_PASSWORD` | Alias de EMAIL_PASSWORD | **À renseigner** |

## 🔐 Sécurité

⚠️ **IMPORTANT** : Ne jamais commiter les mots de passe dans Git !

Le fichier `.env` est déjà dans `.gitignore`. Vérifier avec :
```bash
git status
# Le fichier .env ne doit PAS apparaître
```

## 🧪 Test de la Configuration

Une fois configuré, tester avec :

```bash
# Dans le terminal API
curl -X POST http://localhost:4000/api/bulletin-flow/create \
  -H "Content-Type: application/json" \
  -d '{
    "memberData": {
      "firstName": "Test",
      "lastName": "User",
      "email": "test@example.com"
    },
    "sendEmail": true,
    "email": "VOTRE_EMAIL_TEST@gmail.com"
  }'
```

Vérifier dans les logs :
- ✅ `✅ Email envoyé via SMTP direct`
- ❌ `Fallback SMTP impossible: EMAIL_PASSWORD non configuré`

## 📂 Fichiers Modifiés

1. `interne/api/.env` - Ajout des variables SMTP
2. `interne/api/CONFIGURATION_EMAIL.md` - Cette documentation

## 🔗 Code Concerné

- **Route** : `interne/api/src/routes/bulletinFlow.routes.js` (ligne 193-372)
- **Service** : `interne/api/src/services/mailService.js`
- **Frontend** : `interne/src/pages/MembersManagement.jsx` (handleRenewAdhesion)

## 🚀 En Production (Railway)

Ne pas oublier de configurer les variables dans Railway :

```bash
# Dashboard Railway > Variables
NOREPLY_EMAIL=noreply@association-rbe.fr
NOREPLY_PASSWORD=********
EMAIL_PASSWORD=********
SMTP_PASSWORD=********
```

---

**Date de création** : 16 Juin 2026  
**Problème résolu** : Renouvellement d'adhésion - emails non envoyés
