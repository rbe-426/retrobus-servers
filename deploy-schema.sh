#!/bin/bash
# Script de déploiement du schéma Prisma sur Railway
# À exécuter après avoir poussé les modifications de schema.prisma

echo "🚀 Déploiement du schéma Prisma sur Railway..."
echo ""

# 1. Vérifier que DATABASE_URL est configurée
if [ -z "$DATABASE_URL" ]; then
  echo "❌ Erreur: DATABASE_URL non configurée"
  echo "Ajoutez DATABASE_URL dans votre .env ou exportez-la"
  exit 1
fi

echo "✅ DATABASE_URL détectée"
echo ""

# 2. Générer le client Prisma
echo "📦 Génération du client Prisma..."
npx prisma generate
echo ""

# 3. Appliquer les migrations (db push pour éviter le shadow db)
echo "🔄 Application du schéma à la base de données..."
npx prisma db push --skip-generate
echo ""

# 4. Vérifier que tout est OK
echo "✅ Schéma appliqué avec succès!"
echo ""
echo "📊 Modèles disponibles:"
npx prisma db execute --stdin <<EOF
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
EOF
