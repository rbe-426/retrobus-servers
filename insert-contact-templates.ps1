# Script PowerShell pour insérer les templates du formulaire de contact
# Usage: .\insert-contact-templates.ps1

Write-Host "📧 Insertion des templates du formulaire de contact" -ForegroundColor Cyan
Write-Host ""

# Vérifier si DATABASE_URL est définie
if (-not $env:DATABASE_URL) {
    Write-Host "❌ La variable d'environnement DATABASE_URL n'est pas définie" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Solutions:" -ForegroundColor Yellow
    Write-Host "   1. La définir temporairement:" -ForegroundColor White
    Write-Host '      $env:DATABASE_URL = "postgresql://user:pass@host:port/db"' -ForegroundColor Gray
    Write-Host ""
    Write-Host "   2. Utiliser Railway CLI:" -ForegroundColor White
    Write-Host "      railway run pwsh" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   3. Copier-coller le SQL dans pgAdmin ou Prisma Studio" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "✅ Variable DATABASE_URL trouvée" -ForegroundColor Green
Write-Host ""

# Extraire uniquement les deux templates de contact depuis seed-email-templates.sql
$sqlFile = ".\prisma\seed-email-templates.sql"

if (-not (Test-Path $sqlFile)) {
    Write-Host "❌ Fichier seed-email-templates.sql introuvable" -ForegroundColor Red
    Write-Host "   Chemin recherché: $sqlFile" -ForegroundColor Gray
    Write-Host ""
    Write-Host "💡 Assurez-vous d'exécuter ce script depuis:" -ForegroundColor Yellow
    Write-Host "   C:\Dev\RETROBUS_ESSONNE\interne\api" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

Write-Host "📄 Lecture du fichier SQL..." -ForegroundColor Yellow

# Lire tout le fichier
$content = Get-Content $sqlFile -Raw

# Extraire uniquement les templates 9 et 10 (formulaire de contact)
$pattern = "(?s)(-- 9\. Contact Form Notification.*?NOW\(\)\);)"
$matches = [regex]::Matches($content, $pattern)

if ($matches.Count -eq 0) {
    Write-Host "❌ Templates de contact non trouvés dans le fichier SQL" -ForegroundColor Red
    exit 1
}

$contactTemplates = $matches[0].Value

# Ajouter aussi le template 10
$pattern2 = "(?s)(-- 10\. Contact Form Confirmation.*?NOW\(\)\);)"
$matches2 = [regex]::Matches($content, $pattern2)

if ($matches2.Count -gt 0) {
    $contactTemplates += "`n`n" + $matches2[0].Value
}

Write-Host "✅ Templates trouvés:" -ForegroundColor Green
Write-Host "   - contact_form_notification (à l'association)" -ForegroundColor Gray
Write-Host "   - mailback_formulaire (confirmation au visiteur)" -ForegroundColor Gray
Write-Host ""

# Créer un fichier temporaire avec uniquement ces templates
$tempFile = ".\temp-contact-templates.sql"
$contactTemplates | Out-File -FilePath $tempFile -Encoding UTF8

Write-Host "📊 Insertion dans la base de données..." -ForegroundColor Yellow

# Vérifier si psql est disponible
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue

if ($psqlPath) {
    # Utiliser psql
    try {
        psql $env:DATABASE_URL -f $tempFile
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ Templates insérés avec succès !" -ForegroundColor Green
        } else {
            Write-Host ""
            Write-Host "⚠️  Une erreur s'est produite lors de l'insertion" -ForegroundColor Yellow
            Write-Host "   Code de sortie: $LASTEXITCODE" -ForegroundColor Gray
        }
    } catch {
        Write-Host ""
        Write-Host "❌ Erreur lors de l'exécution de psql:" -ForegroundColor Red
        Write-Host "   $($_.Exception.Message)" -ForegroundColor Gray
    }
} else {
    Write-Host ""
    Write-Host "⚠️  psql non trouvé. Installation alternative..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "💡 Solutions:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   1. Installer PostgreSQL client:" -ForegroundColor White
    Write-Host "      winget install PostgreSQL.PostgreSQL" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   2. Utiliser Prisma Studio:" -ForegroundColor White
    Write-Host "      npx prisma studio" -ForegroundColor Gray
    Write-Host "      Puis exécuter le SQL via l'interface" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   3. Copier le contenu de temp-contact-templates.sql" -ForegroundColor White
    Write-Host "      et l'exécuter dans pgAdmin ou un autre client PostgreSQL" -ForegroundColor Gray
    Write-Host ""
    Write-Host "📄 Fichier SQL temporaire créé: $tempFile" -ForegroundColor Cyan
}

# Nettoyer le fichier temporaire
if (Test-Path $tempFile) {
    Remove-Item $tempFile
    Write-Host ""
    Write-Host "🧹 Fichier temporaire nettoyé" -ForegroundColor Gray
}

Write-Host ""
Write-Host "📋 Prochaines étapes:" -ForegroundColor Cyan
Write-Host ""
Write-Host "   1. Connecter le compte noreply:" -ForegroundColor White
Write-Host "      https://www.retrobus-interne.fr/dashboard/site-management" -ForegroundColor Gray
Write-Host "      Onglet: Modèles d'e-mail" -ForegroundColor Gray
Write-Host ""
Write-Host "   2. Tester le formulaire de contact:" -ForegroundColor White
Write-Host "      https://association-rbe.fr/contact" -ForegroundColor Gray
Write-Host ""
Write-Host "   3. Vérifier les emails:" -ForegroundColor White
Write-Host "      - association.rbe@gmail.com (notification)" -ForegroundColor Gray
Write-Host "      - Votre email (confirmation)" -ForegroundColor Gray
Write-Host ""
Write-Host "✨ Configuration terminée !" -ForegroundColor Green
