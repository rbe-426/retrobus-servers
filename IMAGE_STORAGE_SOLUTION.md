# Solution de stockage d'images pour la production

## Problème actuel
Les images uploadées en local ne sont pas accessibles en production car :
- Railway utilise un système de fichiers **éphémère**
- Les fichiers uploadés disparaissent au redémarrage du conteneur
- Les uploads locaux ne sont jamais synchronisés avec Railway

## Solutions possibles

### ✅ Option 1 : Cloudinary (RECOMMANDÉ - Gratuit)
- 25 crédits/mois gratuits
- Transformation d'images automatique
- CDN intégré
- Facile à intégrer

**Installation :**
```bash
npm install cloudinary multer-storage-cloudinary
```

**Configuration API (.env) :**
```
CLOUDINARY_CLOUD_NAME=votre_cloud_name
CLOUDINARY_API_KEY=votre_api_key
CLOUDINARY_API_SECRET=votre_api_secret
```

### Option 2 : Railway Volumes (Payant)
- Stockage persistant sur Railway
- ~$0.25/GB/mois
- Nécessite configuration dans railway.toml

### Option 3 : AWS S3 (Payant)
- Très fiable mais plus complexe
- Coût variable selon usage

## Solution temporaire
Pour l'instant, les images uploadées localement fonctionnent uniquement en développement local. 

En production, utilisez des URLs externes (via.placeholder.com, ui-avatars.com, etc.) en attendant l'intégration Cloudinary.

## Images actuellement accessibles
- Methusan : /uploads/team-avatars/team_2-1781473872315.png ✅ (existe sur Railway)
- Waiyl : /uploads/team-avatars/team_1-1781474784159.png ❌ (uploadé en local uniquement)
