# 📋 Guide de Diagnostic: PDF Vides (33 pages)

## 🎯 Objectif
Identifier pourquoi les PDFs générés contiennent 33 pages vides au lieu du contenu.

## 🔍 Points de Diagnostic

### 1. **Frontend - Console Navigateur (F12)**

Ouvrir la console et générer un PDF. Vous devriez voir:

```javascript
// ✅ Si tout va bien:
"📋 Données de remplacement:"
"  - Numéro: DV-2025-001"
"  - Titre: Mon Devis"
"  - Montant: 2 100,00"
"  - Logo Big size: 150000 chars"  ← Peut être très gros!
"  - Logo Small size: 50000 chars"
"  - Lignes devis: 1200 chars"
"📏 Taille HTML à envoyer: 450.25 KB"
"🔍 Premiers 500 chars du HTML: <!DOCTYPE html>..."
"📝 Contenu texte du HTML: 450 caractères"

// ❌ Si problème:
"📝 Contenu texte du HTML: 5 caractères" ← VIDE!
"⚠️ ATTENTION: HTML généré presque vide!" ← Alerte
```

### 2. **Onglet Réseau - Payload POST**

Toujours dans F12, aller à Réseau → chercher la requête POST `/generate-pdf`

**Regarder le payload**:
```javascript
{
  "htmlContent": "<!DOCTYPE html>..." // Doit être longue (500+ KB!)
}
```

**Si htmlContent est vide ou très court → Problème Frontend**
**Si htmlContent est bon → Problème Serveur/Puppeteer**

### 3. **Logs Serveur**

Quand le serveur reçoit la requête, vous devriez voir:

```
📄 Génération PDF pour document abc123 avec Puppeteer...
📏 Taille htmlContent: 450.25 KB
⏳ Chargement du HTML...
📄 Conversion en PDF...
✅ PDF généré avec succès pour document abc123
```

**Si vous ne voyez pas ces logs → Vérifier les connexions/tokens**

### 4. **Tester l'Endpoint Debug**

Exécuter depuis le terminal API:

```bash
cd interne/api
node test-pdf-diagnostic.js
```

Cela teste si Puppeteer peut rendre du HTML correctement.

### 5. **Vérifier la Base de Données**

```bash
# Depuis psql
SELECT 
  id,
  type,
  "number",
  htmlContent,
  LENGTH(htmlContent) as htmlLength,
  LENGTH(documentUrl) as urlLength,
  SUBSTRING(htmlContent, 1, 100) as htmlStart
FROM "FinancialDocument"
ORDER BY "createdAt" DESC
LIMIT 5;
```

**À vérifier**:
- `htmlLength > 1000` ? ✓ (Doit avoir du contenu)
- `urlLength > 50000` ? ✓ (PDF data URI est généralement 100KB+)
- `htmlStart` contient `<!DOCTYPE` ou `<html` ? ✓

### 6. **Ouvrir le PDF Directement**

Si vous avez un PDF vide sauvegardé:

1. Allez dans la page affichage des devis
2. Cliquez sur l'oeil pour voir le PDF
3. Ouvrez les Devtools (F12)
4. Allez dans Réseau
5. Cherchez la requête pour le PDF
6. Copiez le datauri
7. Collez dans une nouvelle URL: `data:application/pdf;base64,...`

**Vérifiez**: Est-ce que le PDF est vide dans l'affichage?

## 🚀 Actions à Prendre

### Étape 1: Vérifier Frontend
```bash
1. F12 → Console → Générer PDF
2. Chercher "htmlContent" dans la sortie
3. Si vide → Problème template ou remplacement
4. Si bon → Aller Étape 2
```

### Étape 2: Vérifier Payload
```bash
1. F12 → Réseau → Chercher POST generate-pdf
2. Voir le payload → htmlContent
3. Si vide → Même problème que Étape 1
4. Si bon → Aller Étape 3
```

### Étape 3: Vérifier Serveur
```bash
1. Lancer le serveur: npm run dev (depuis interne/api)
2. Générer un PDF
3. Regarder les logs serveur
4. Exécuter: node test-pdf-diagnostic.js
```

### Étape 4: Vérifier BD
```bash
1. psql retrobus_db
2. Exécuter la requête SELECT ci-dessus
3. Vérifier que htmlContent et documentUrl sont remplis
```

## 🎯 Solutions Possibles

### Si HTML Frontend est Vide
```javascript
// PROBLÈME: Template ou remplacement
// SOLUTION: 
// 1. Vérifier que le template est chargé (selectedTemplate !== null)
// 2. Vérifier que les placeholders existent ({{NUM_DEVIS}}, etc)
// 3. Vérifier que previewData est bien formé
// 4. Ajouter console.log(selectedTemplate.htmlContent) pour voir le template
```

### Si HTML Frontend est Bon mais PDF Vide
```javascript
// PROBLÈME: Puppeteer ne rend pas le HTML
// SOLUTION:
// 1. Vérifier que waitUntil et timeout sont bons ✓ (déjà fixé)
// 2. Vérifier que les images base64 ne sont pas trop grosses
// 3. Essayer avec HTML sans les images
// 4. Augmenter le timeout Puppeteer
```

### Si Images Trop Grosses
```javascript
// Les logos base64 peuvent être 100KB+ chacun
// Total HTML = 500KB+ ce qui cause problèmes
// 
// SOLUTIONS:
// 1. Compresser les images (jpegoptim, imagemin)
// 2. Envoyer les images séparément (pas en base64)
// 3. Utiliser des URLs externes pour images
// 4. Limiter la taille des logos à 50KB max
```

## 📊 Taille Attendue

**HTML généré**:
- Sans images: ~50 KB
- Avec 2 logos base64: 300-500 KB ← Normal

**PDF résultant**:
- Simple (2 pages): 50-100 KB
- Complexe (5+ pages): 200-500 KB
- **VIDE (33 pages)**: ??? KB ← À mesurer

Si PDF vide = 5-10 KB → Presque rien rendu
Si PDF vide = 500 KB → Quelque chose s'est mal passé

## ✅ Checklist

- [ ] Console navigateur: htmlContent non vide
- [ ] Réseau: Payload POST contient htmlContent
- [ ] Serveur: Logs montrent "Génération PDF..."
- [ ] BD: htmlContent et documentUrl remplis
- [ ] Test diagnostic: node test-pdf-diagnostic.js OK
- [ ] PDF test: Pas vide après diagnostic

## 🆘 Si Rien Ne Marche

Créer un HTML de test MINIMAL directement dans le code et tester:

```javascript
const testHtml = `<html><body><h1>TEST</h1><p>Contenu</p></body></html>`;
// Envoyer au serveur
// Si même ce HTML simple donne 33 pages vides
// → Problème Puppeteer lui-même (config, dépendances, etc)
```

