/**
 * Script pour obtenir un Refresh Token OAuth 2.0 pour l'API Google Search Console
 * 
 * Usage:
 * 1. Téléchargez le fichier oauth_credentials.json depuis Google Cloud Console
 * 2. Placez-le dans le même dossier que ce script
 * 3. Exécutez: node get-oauth-token.mjs
 * 4. Suivez les instructions dans le terminal
 */

import { google } from 'googleapis';
import http from 'http';
import { parse } from 'url';
import fs from 'fs';
import { exec } from 'child_process';
import { platform } from 'os';

// Fonction pour ouvrir l'URL dans le navigateur (multi-plateforme)
function openUrl(url) {
  const command = platform() === 'win32' ? 'start' : platform() === 'darwin' ? 'open' : 'xdg-open';
  exec(`${command} "${url}"`);
}

async function main() {
  console.log('🔐 Obtention d\'un Refresh Token OAuth 2.0 pour Search Console');
  console.log('=============================================================');
  console.log('');

  // Vérifier que le fichier oauth_credentials.json existe
  if (!fs.existsSync('./oauth_credentials.json')) {
    console.error('❌ ERREUR: Fichier oauth_credentials.json introuvable');
    console.error('');
    console.error('Étapes à suivre :');
    console.error('1. Allez sur https://console.cloud.google.com/');
    console.error('2. APIs & Services > Credentials');
    console.error('3. CREATE CREDENTIALS > OAuth client ID');
    console.error('4. Application type: Desktop app');
    console.error('5. Téléchargez le JSON et renommez-le en "oauth_credentials.json"');
    console.error('6. Placez-le dans le dossier: ' + process.cwd());
    console.error('');
    process.exit(1);
  }

  // Charger les credentials
  let credentials;
  try {
    const fileContent = fs.readFileSync('./oauth_credentials.json', 'utf8');
    credentials = JSON.parse(fileContent);
  } catch (error) {
    console.error('❌ ERREUR: Impossible de lire oauth_credentials.json');
    console.error(error.message);
    process.exit(1);
  }

  // Vérifier le format (desktop app)
  if (!credentials.installed && !credentials.web) {
    console.error('❌ ERREUR: Format de credentials invalide');
    console.error('Le fichier doit contenir "installed" (Desktop app) ou "web"');
    process.exit(1);
  }

  const credType = credentials.installed || credentials.web;
  const redirectUri = 'http://localhost:3000/oauth2callback';

  const oauth2Client = new google.auth.OAuth2(
    credType.client_id,
    credType.client_secret,
    redirectUri
  );

  // Scopes nécessaires pour Search Console (read-only)
  const scopes = [
    'https://www.googleapis.com/auth/webmasters.readonly'
  ];

  // Générer l'URL d'autorisation
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent' // Force le refresh token
  });

  console.log('📋 Étape 1 : Autoriser l\'application');
  console.log('');
  console.log('Une fenêtre de navigateur va s\'ouvrir automatiquement.');
  console.log('Si ce n\'est pas le cas, copiez cette URL :');
  console.log('');
  console.log(authUrl);
  console.log('');
  console.log('Connectez-vous et autorisez l\'accès à Google Search Console.');
  console.log('');
  console.log('⏳ En attente de l\'autorisation...');
  console.log('');

  // Créer un serveur HTTP temporaire pour recevoir le code
  const server = http.createServer(async (req, res) => {
    if (req.url.indexOf('/oauth2callback') > -1) {
      const qs = parse(req.url, true).query;
      
      if (qs.error) {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body style="font-family: Arial; padding: 40px; text-align: center;">
              <h1 style="color: red;">❌ Erreur d'autorisation</h1>
              <p>${qs.error}</p>
              <p>Vous pouvez fermer cette fenêtre et réessayer.</p>
            </body>
          </html>
        `);
        console.error('❌ Erreur d\'autorisation:', qs.error);
        server.close();
        process.exit(1);
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <body style="font-family: Arial; padding: 40px; text-align: center;">
            <h1 style="color: green;">✅ Authentification réussie !</h1>
            <p>Vous pouvez fermer cette fenêtre.</p>
            <p>Retournez dans votre terminal pour récupérer les credentials.</p>
          </body>
        </html>
      `);
      
      server.close();

      try {
        // Échanger le code contre des tokens
        const { tokens } = await oauth2Client.getToken(qs.code);
        
        console.log('');
        console.log('✅ Tokens obtenus avec succès !');
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📋 Variables d\'environnement à ajouter au fichier .env :');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
        console.log('# Google Search Console API (OAuth 2.0)');
        console.log(`SEARCH_CONSOLE_SITE_URL=https://votre-site.com`);
        console.log(`SEARCH_CONSOLE_CLIENT_ID=${credType.client_id}`);
        console.log(`SEARCH_CONSOLE_CLIENT_SECRET=${credType.client_secret}`);
        console.log(`SEARCH_CONSOLE_REFRESH_TOKEN=${tokens.refresh_token}`);
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
        console.log('⚠️  N\'oubliez pas de remplacer "https://votre-site.com" par l\'URL');
        console.log('   exacte de votre propriété dans Google Search Console !');
        console.log('');
        console.log('✅ Ensuite, redémarrez votre serveur API (Ctrl+C puis npm run dev)');
        console.log('');

        // Sauvegarder aussi dans un fichier pour faciliter
        const envContent = `# Google Search Console API (OAuth 2.0)
SEARCH_CONSOLE_SITE_URL=https://votre-site.com
SEARCH_CONSOLE_CLIENT_ID=${credType.client_id}
SEARCH_CONSOLE_CLIENT_SECRET=${credType.client_secret}
SEARCH_CONSOLE_REFRESH_TOKEN=${tokens.refresh_token}
`;
        
        fs.writeFileSync('.env.search-console', envContent);
        console.log('💾 Variables sauvegardées dans : .env.search-console');
        console.log('   Vous pouvez copier-coller ce fichier dans votre .env');
        console.log('');
        
      } catch (error) {
        console.error('❌ Erreur lors de l\'échange du code:', error.message);
        process.exit(1);
      }

      process.exit(0);
    }
  });

  server.listen(3000, () => {
    console.log('🌐 Serveur d\'autorisation démarré sur http://localhost:3000');
    console.log('');
    
    // Ouvrir le navigateur automatiquement
    setTimeout(() => {
      try {
        openUrl(authUrl);
      } catch (error) {
        console.log('⚠️  Impossible d\'ouvrir automatiquement le navigateur.');
        console.log('   Copiez l\'URL ci-dessus manuellement.');
      }
    }, 1000);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error('❌ ERREUR: Le port 3000 est déjà utilisé');
      console.error('   Arrêtez les autres serveurs ou changez le port dans le script.');
    } else {
      console.error('❌ ERREUR serveur:', error.message);
    }
    process.exit(1);
  });
}

main().catch(error => {
  console.error('❌ Erreur fatale:', error.message);
  process.exit(1);
});
