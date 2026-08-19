# Script d'aide pour configurer Google Search Console API
# Usage: .\setup-search-console.ps1 -JsonFilePath "C:\Downloads\credentials.json"

param(
    [Parameter(Mandatory=$false)]
    [string]$JsonFilePath
)

Write-Host "🔧 Configuration Google Search Console API" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Fonction pour demander le chemin du fichier
function Get-JsonFile {
    if ($JsonFilePath -and (Test-Path $JsonFilePath)) {
        return $JsonFilePath
    }
    
    Write-Host "📁 Sélectionnez le fichier JSON des credentials..." -ForegroundColor Yellow
    Write-Host "   (Devrait être dans votre dossier Téléchargements)" -ForegroundColor Gray
    Write-Host ""
    
    Add-Type -AssemblyName System.Windows.Forms
    $openFileDialog = New-Object System.Windows.Forms.OpenFileDialog
    $openFileDialog.InitialDirectory = [Environment]::GetFolderPath('UserProfile') + "\Downloads"
    $openFileDialog.Filter = "JSON files (*.json)|*.json|All files (*.*)|*.*"
    $openFileDialog.Title = "Sélectionnez le fichier JSON Google Service Account"
    
    if ($openFileDialog.ShowDialog() -eq 'OK') {
        return $openFileDialog.FileName
    } else {
        Write-Host "❌ Aucun fichier sélectionné. Abandon." -ForegroundColor Red
        exit 1
    }
}

# Fonction pour valider le JSON
function Test-JsonContent {
    param([string]$FilePath)
    
    try {
        $content = Get-Content $FilePath -Raw
        $json = $content | ConvertFrom-Json
        
        if ($json.type -ne "service_account") {
            Write-Host "⚠️  ATTENTION: Le type n'est pas 'service_account'" -ForegroundColor Yellow
            return $false
        }
        
        if (-not $json.client_email) {
            Write-Host "❌ ERREUR: Pas de 'client_email' dans le JSON" -ForegroundColor Red
            return $false
        }
        
        Write-Host "✅ Fichier JSON valide" -ForegroundColor Green
        Write-Host "   📧 Email du Service Account: $($json.client_email)" -ForegroundColor Gray
        return $true
    }
    catch {
        Write-Host "❌ ERREUR: Fichier JSON invalide ou corrompu" -ForegroundColor Red
        Write-Host "   $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Fonction pour encoder en Base64
function ConvertTo-Base64 {
    param([string]$FilePath)
    
    $content = Get-Content $FilePath -Raw
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($content)
    $base64 = [Convert]::ToBase64String($bytes)
    return $base64
}

# Fonction pour demander l'URL du site
function Get-SiteUrl {
    Write-Host ""
    Write-Host "🌐 URL du Site Search Console" -ForegroundColor Cyan
    Write-Host "   Entrez l'URL EXACTE de votre propriété dans Search Console" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   Exemples:" -ForegroundColor Gray
    Write-Host "   • https://www.retrobus-essonne.fr" -ForegroundColor Gray
    Write-Host "   • https://retrobus-essonne.fr" -ForegroundColor Gray
    Write-Host "   • sc-domain:retrobus-essonne.fr (propriété de domaine)" -ForegroundColor Gray
    Write-Host ""
    
    $url = Read-Host "URL du site"
    
    if (-not $url) {
        Write-Host "⚠️  URL vide, utilisation de 'https://www.retrobus-essonne.fr' par défaut" -ForegroundColor Yellow
        return "https://www.retrobus-essonne.fr"
    }
    
    return $url
}

# === SCRIPT PRINCIPAL ===

# Étape 1 : Récupérer le fichier JSON
$jsonFile = Get-JsonFile
Write-Host ""
Write-Host "📄 Fichier sélectionné: $jsonFile" -ForegroundColor Green
Write-Host ""

# Étape 2 : Valider le contenu
if (-not (Test-JsonContent -FilePath $jsonFile)) {
    Write-Host ""
    Write-Host "❌ Le fichier JSON n'est pas valide. Vérifiez qu'il s'agit bien des credentials d'un Service Account Google." -ForegroundColor Red
    exit 1
}

# Étape 3 : Encoder en Base64
Write-Host ""
Write-Host "🔐 Encodage en Base64..." -ForegroundColor Cyan
$base64Content = ConvertTo-Base64 -FilePath $jsonFile
Write-Host "✅ Encodage réussi ($($base64Content.Length) caractères)" -ForegroundColor Green

# Étape 4 : Demander l'URL du site
$siteUrl = Get-SiteUrl

# Étape 5 : Préparer les variables d'environnement
Write-Host ""
Write-Host "📝 Variables d'environnement à ajouter dans .env:" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

$envContent = @"
# Google Search Console API (ajouté le $(Get-Date -Format "yyyy-MM-dd HH:mm"))
SEARCH_CONSOLE_SITE_URL=$siteUrl
SEARCH_CONSOLE_SERVICE_ACCOUNT_BASE64=$base64Content
"@

Write-Host $envContent -ForegroundColor Yellow
Write-Host ""

# Étape 6 : Proposer d'ajouter automatiquement au .env
$envPath = Join-Path $PSScriptRoot ".env"
if (Test-Path $envPath) {
    Write-Host "📁 Fichier .env détecté: $envPath" -ForegroundColor Green
    Write-Host ""
    $response = Read-Host "Voulez-vous ajouter automatiquement ces lignes au fichier .env ? (o/n)"
    
    if ($response -eq "o" -or $response -eq "O" -or $response -eq "oui") {
        # Vérifier si déjà présent
        $currentContent = Get-Content $envPath -Raw
        if ($currentContent -match "SEARCH_CONSOLE_") {
            Write-Host ""
            Write-Host "⚠️  Des variables SEARCH_CONSOLE_ existent déjà dans .env" -ForegroundColor Yellow
            $overwrite = Read-Host "Voulez-vous les remplacer ? (o/n)"
            
            if ($overwrite -eq "o" -or $overwrite -eq "O") {
                # Supprimer les anciennes lignes
                $lines = Get-Content $envPath
                $newLines = $lines | Where-Object { $_ -notmatch "^SEARCH_CONSOLE_" }
                $newLines | Set-Content $envPath
                Write-Host "✅ Anciennes variables supprimées" -ForegroundColor Green
            } else {
                Write-Host "❌ Ajout annulé. Modifiez manuellement le fichier .env" -ForegroundColor Red
                exit 0
            }
        }
        
        # Ajouter les nouvelles lignes
        Add-Content -Path $envPath -Value "`n$envContent"
        Write-Host ""
        Write-Host "✅ Variables ajoutées au fichier .env avec succès !" -ForegroundColor Green
        
        # Copier aussi dans le presse-papiers
        $envContent | Set-Clipboard
        Write-Host "✅ Variables également copiées dans le presse-papiers" -ForegroundColor Green
    } else {
        # Copier dans le presse-papiers
        $envContent | Set-Clipboard
        Write-Host ""
        Write-Host "✅ Variables copiées dans le presse-papiers !" -ForegroundColor Green
        Write-Host "   Collez-les manuellement dans votre fichier .env" -ForegroundColor Gray
    }
} else {
    Write-Host "⚠️  Fichier .env non trouvé dans: $PSScriptRoot" -ForegroundColor Yellow
    Write-Host "   Créez le fichier .env et collez les lignes ci-dessus" -ForegroundColor Gray
    Write-Host ""
    
    # Copier dans le presse-papiers
    $envContent | Set-Clipboard
    Write-Host "✅ Variables copiées dans le presse-papiers !" -ForegroundColor Green
}

# Étape 7 : Email du Service Account (pour Search Console)
Write-Host ""
Write-Host "👤 Étape suivante : Ajouter le Service Account dans Search Console" -ForegroundColor Cyan
Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host ""

$jsonContent = Get-Content $jsonFile -Raw | ConvertFrom-Json
$serviceEmail = $jsonContent.client_email

Write-Host "📧 Email du Service Account à ajouter:" -ForegroundColor Yellow
Write-Host "   $serviceEmail" -ForegroundColor Green
Write-Host ""

$serviceEmail | Set-Clipboard
Write-Host "✅ Email copié dans le presse-papiers !" -ForegroundColor Green
Write-Host ""

Write-Host "Étapes suivantes:" -ForegroundColor Cyan
Write-Host "1. Allez sur https://search.google.com/search-console" -ForegroundColor Gray
Write-Host "2. Sélectionnez votre propriété" -ForegroundColor Gray
Write-Host "3. Paramètres > Utilisateurs et autorisations" -ForegroundColor Gray
Write-Host "4. Ajouter un utilisateur et collez l'email ci-dessus" -ForegroundColor Gray
Write-Host "5. Donnez les droits 'Propriétaire' ou 'Complet'" -ForegroundColor Gray
Write-Host "6. Redémarrez votre serveur API (Ctrl+C puis npm run dev)" -ForegroundColor Gray
Write-Host ""

Write-Host "✨ Configuration terminée !" -ForegroundColor Green
Write-Host ""
