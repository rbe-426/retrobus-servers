# 📧 Configuration Email pour le Formulaire de Contact

## Prérequis

Le système d'envoi d'email utilise **Nodemailer** avec **Gmail SMTP**.

## Configuration

### 1. Variables d'environnement à ajouter dans `.env`

```env
# Configuration Email
EMAIL_USER=association.rbe@gmail.com
EMAIL_PASSWORD=your-app-password-here
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
```

### 2. Créer un mot de passe spécifique d'application (App Password)

Gmail n'accepte plus les mots de passe normaux avec les apps tierces. Il faut créer un **App Password**:

1. Aller sur https://myaccount.google.com/apppasswords
2. Sélectionner:
   - **Appareil**: Custom (other) - tapez "RetrobusCRM"
   - **Application**: Mail
3. Google générera un mot de passe de 16 caractères (sans espaces)
4. Copier ce mot de passe dans `EMAIL_PASSWORD` du fichier `.env`

### 3. Vérifier la configuration (optionnel)

```bash
# Test local
npm start
# Les logs afficheront "✅ Email transporter initialisé" si OK
```

## Fonctionnement

Quand un utilisateur soumet le formulaire de contact:

1. **Message enregistré** en base de données PostgreSQL
2. **Email envoyé à l'association** (association.rbe@gmail.com)
3. **Email de confirmation** envoyé à l'expéditeur

## Dépannage

- ❌ Si `EMAIL_PASSWORD` est vide → Les emails ne sont pas envoyés (mais le formulaire fonctionne)
- ⚠️  Si les emails échouent → Les messages sont quand même enregistrés en base
- 🔗 Pour plus d'infos: https://support.google.com/accounts/answer/185833

## Déploiement sur Railway

Sur Railway, ajouter les variables d'environnement dans les **Secrets** du projet:

```
EMAIL_USER=association.rbe@gmail.com
EMAIL_PASSWORD=<your-app-password>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
```
