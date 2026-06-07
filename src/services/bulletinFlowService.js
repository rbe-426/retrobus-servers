/**
 * Service de gestion du parcours numérique de signature de bulletin
 * Gère les liens privés, tokens, et le workflow de signature
 */

import crypto from 'crypto';

// Stockage en mémoire des tokens de signature (à remplacer par DB en production)
const signatureTokens = new Map();

// Durée de validité : 7 jours
const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Génère un token unique pour le parcours de signature
 * @param {object} memberData - Données de l'adhérent
 * @returns {string} Token unique
 */
export const generateSignatureToken = (memberData) => {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + TOKEN_EXPIRY_MS;

  signatureTokens.set(token, {
    memberData,
    createdAt: Date.now(),
    expiresAt,
    status: 'pending', // pending | in_progress | signed | expired
    signatureData: null,
    signedAt: null,
    ipAddress: null,
    userAgent: null,
    steps: {
      welcome: false,
      verification: false,
      additional_info: false,
      signature: false,
      confirmation: false
    }
  });

  console.log(`✅ Signature token generated: ${token.substring(0, 8)}... (expires in 7 days)`);
  return token;
};

/**
 * Récupère les données associées à un token
 * @param {string} token - Token de signature
 * @returns {object|null} Données du token ou null si invalide/expiré
 */
export const getTokenData = (token) => {
  const data = signatureTokens.get(token);
  
  if (!data) {
    console.log(`❌ Token not found: ${token.substring(0, 8)}...`);
    return null;
  }

  // Vérifier expiration
  if (Date.now() > data.expiresAt) {
    console.log(`❌ Token expired: ${token.substring(0, 8)}...`);
    data.status = 'expired';
    return null;
  }

  return data;
};

/**
 * Met à jour le statut d'une étape du parcours
 * @param {string} token - Token de signature
 * @param {string} step - Nom de l'étape
 * @param {boolean} completed - Statut de complétion
 * @returns {boolean} Succès de la mise à jour
 */
export const updateStepStatus = (token, step, completed = true) => {
  const data = signatureTokens.get(token);
  
  if (!data || data.status === 'expired') {
    return false;
  }

  if (data.steps.hasOwnProperty(step)) {
    data.steps[step] = completed;
    console.log(`✅ Step updated: ${step} = ${completed}`);
    return true;
  }

  return false;
};

/**
 * Met a jour les informations membre stockees dans le token
 * @param {string} token - Token de signature
 * @param {object} memberDataPatch - Donnees a fusionner
 * @returns {object|false} Donnees mises a jour ou false
 */
export const updateMemberData = (token, memberDataPatch = {}) => {
  const data = signatureTokens.get(token);

  if (!data || data.status === 'expired') {
    return false;
  }

  if (!memberDataPatch || typeof memberDataPatch !== 'object') {
    return false;
  }

  data.memberData = {
    ...data.memberData,
    ...memberDataPatch
  };

  // Si l'adherent renseigne des infos, on marque l'etape comme complete.
  data.steps.additional_info = true;

  return data.memberData;
};

/**
 * Enregistre la signature de l'adhérent
 * @param {string} token - Token de signature
 * @param {string} signatureDataUrl - Signature en base64 (Canvas)
 * @param {object} metadata - Métadonnées (IP, User-Agent, etc.)
 * @returns {boolean} Succès de l'enregistrement
 */
export const saveSignature = (token, signatureDataUrl, metadata = {}) => {
  const data = signatureTokens.get(token);
  
  if (!data || data.status === 'expired') {
    return false;
  }

  data.signatureData = signatureDataUrl;
  data.signedAt = new Date().toISOString();
  data.status = 'signed';
  data.ipAddress = metadata.ipAddress || null;
  data.userAgent = metadata.userAgent || null;
  data.steps.signature = true;
  data.steps.confirmation = true;

  console.log(`✅ Signature saved for token: ${token.substring(0, 8)}...`);
  return true;
};

/**
 * Génère le lien de signature complet
 * @param {string} token - Token de signature
 * @param {string} baseUrl - URL de base de l'application
 * @returns {string} Lien complet
 */
export const generateSignatureLink = (token, baseUrl = 'https://association-rbe.fr') => {
  return `${baseUrl}/bulletin/sign/${token}`;
};

/**
 * Génère un message SMS pour le parcours de signature
 * @param {string} token - Token de signature
 * @param {string} firstName - Prénom de l'adhérent
 * @param {string} baseUrl - URL de base
 * @returns {string} Message SMS formaté
 */
export const generateSMSMessage = (token, firstName, baseUrl = 'https://association-rbe.fr') => {
  const link = generateSignatureLink(token, baseUrl);
  return `Bonjour ${firstName},\n\nVotre bulletin d'adhésion RETROBUS ESSONNE est prêt.\nSignez-le en ligne ici (lien sécurisé valide 7 jours) :\n${link}\n\nMerci !`;
};

/**
 * Génère un message email pour le parcours de signature
 * @param {string} token - Token de signature
 * @param {object} memberData - Données de l'adhérent
 * @param {string} baseUrl - URL de base
 * @returns {object} Email (subject, text, html)
 */
export const generateSignatureEmail = (token, memberData, baseUrl = 'https://association-rbe.fr') => {
  const link = generateSignatureLink(token, baseUrl);
  const firstName = memberData.firstName || 'Adhérent';

  return {
    subject: '✍️ Signature de votre bulletin d\'adhésion - RETROBUS ESSONNE',
    text: `Bonjour ${firstName},

Votre bulletin d'adhésion est prêt à être signé !

Cliquez sur le lien ci-dessous pour accéder à votre espace de signature sécurisé :
${link}

Ce lien est personnel et sécurisé. Il est valide pendant 7 jours.

Le processus est simple :
1. Vérifiez vos informations
2. Complétez si nécessaire
3. Signez électroniquement
4. C'est terminé !

À bientôt,
L'équipe RETROBUS ESSONNE`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: white; padding: 30px; border: 1px solid #e2e8f0; }
    .button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
    .steps { background: #f7fafc; padding: 20px; border-radius: 6px; margin: 20px 0; }
    .step { display: flex; align-items: center; margin: 10px 0; }
    .step-number { background: #667eea; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; font-weight: bold; }
    .footer { text-align: center; color: #718096; font-size: 12px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✍️ Signature de bulletin d'adhésion</h1>
      <p>RETROBUS ESSONNE</p>
    </div>
    <div class="content">
      <p>Bonjour <strong>${firstName}</strong>,</p>
      
      <p>Votre bulletin d'adhésion est prêt à être signé !</p>
      
      <p style="text-align: center;">
        <a href="${link}" class="button">📝 Signer mon bulletin</a>
      </p>
      
      <p style="font-size: 12px; color: #718096;">
        Lien direct : <a href="${link}">${link}</a>
      </p>
      
      <div class="steps">
        <h3>📋 Le processus en 4 étapes :</h3>
        <div class="step">
          <div class="step-number">1</div>
          <div>Vérifiez vos informations pré-remplies</div>
        </div>
        <div class="step">
          <div class="step-number">2</div>
          <div>Complétez les informations manquantes (si besoin)</div>
        </div>
        <div class="step">
          <div class="step-number">3</div>
          <div>Signez électroniquement avec votre doigt ou souris</div>
        </div>
        <div class="step">
          <div class="step-number">4</div>
          <div>Validez : votre bulletin est généré automatiquement !</div>
        </div>
      </div>
      
      <p style="background: #fff5f5; border-left: 4px solid #fc8181; padding: 15px; border-radius: 4px;">
        <strong>🔒 Sécurité :</strong> Ce lien est personnel et sécurisé. Il est valide pendant <strong>7 jours</strong>.
      </p>
      
      <p>Si vous avez des questions, n'hésitez pas à nous contacter.</p>
      
      <p>À bientôt,<br><strong>L'équipe RETROBUS ESSONNE</strong></p>
    </div>
    <div class="footer">
      <p>RETROBUS ESSONNE<br>2 Rue du Petit Pont, 91100 Corbeil-Essonnes<br>07 60 82 11 62</p>
    </div>
  </div>
</body>
</html>
    `
  };
};

/**
 * Nettoie les tokens expirés (à appeler périodiquement)
 */
export const cleanupExpiredTokens = () => {
  const now = Date.now();
  let cleaned = 0;

  for (const [token, data] of signatureTokens.entries()) {
    if (data.expiresAt < now) {
      signatureTokens.delete(token);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`🧹 Cleaned up ${cleaned} expired signature tokens`);
  }

  return cleaned;
};

/**
 * Obtient les statistiques des parcours de signature
 * @returns {object} Statistiques
 */
export const getSignatureStats = () => {
  const stats = {
    total: signatureTokens.size,
    pending: 0,
    in_progress: 0,
    signed: 0,
    expired: 0
  };

  const now = Date.now();

  for (const data of signatureTokens.values()) {
    if (data.expiresAt < now) {
      stats.expired++;
    } else {
      stats[data.status]++;
    }
  }

  return stats;
};
