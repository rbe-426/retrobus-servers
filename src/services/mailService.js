/**
 * Service de gestion des emails Infomaniak
 * Gère IMAP (lecture) et SMTP (envoi) via Infomaniak
 */

import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import { encryptSensitiveData, decryptSensitiveData } from '../security.js';

// Configuration Infomaniak
const IMAP_CONFIG = {
  host: 'mail.infomaniak.com',
  port: 993,
  secure: true, // SSL
  logger: false
};

const SMTP_CONFIG = {
  host: 'mail.infomaniak.com',
  port: 587,
  secure: false, // STARTTLS
  requireTLS: true
};

// Mapping des noms de dossiers (tentatives multiples pour compatibilité)
const FOLDER_MAPPING = {
  'INBOX': ['INBOX'],
  'SENT': ['Sent', 'INBOX.Sent', 'Sent Messages', 'Envoyés', 'INBOX.Envoyés'],
  'TRASH': ['Trash', 'INBOX.Trash', 'Deleted', 'INBOX.Deleted', 'Corbeille', 'INBOX.Corbeille'],
  'DRAFTS': ['Drafts', 'INBOX.Drafts', 'Brouillons', 'INBOX.Brouillons'],
  'SPAM': ['Spam', 'INBOX.Spam', 'Junk', 'INBOX.Junk']
};

/**
 * Trouver le vrai nom d'un dossier IMAP en essayant plusieurs variantes
 * @param {ImapFlow} client - Client IMAP connecté
 * @param {string} logicalFolder - Nom logique du dossier (INBOX, SENT, etc.)
 */
async function findFolderName(client, logicalFolder) {
  const candidates = FOLDER_MAPPING[logicalFolder] || [logicalFolder];
  
  // Lister tous les dossiers disponibles
  const mailboxes = await client.list();
  const availableNames = mailboxes.map(m => m.path);
  
  // Essayer chaque candidat
  for (const candidate of candidates) {
    if (availableNames.includes(candidate)) {
      console.log(`✅ Dossier ${logicalFolder} trouvé: ${candidate}`);
      return candidate;
    }
  }
  
  // Aucun trouvé, utiliser le premier candidat par défaut
  console.warn(`⚠️  Dossier ${logicalFolder} introuvable, utilisation de ${candidates[0]}`);
  return candidates[0];
}

// Stockage temporaire des sessions (en prod, utiliser Redis ou DB)
const activeSessions = new Map();

/**
 * Créer une session mail pour un utilisateur
 * @param {string} userId - ID utilisateur
 * @param {string} email - Email Infomaniak
 * @param {string} password - Mot de passe (sera chiffré)
 */
export async function createMailSession(userId, email, password) {
  try {
    // Tester la connexion IMAP
    const client = new ImapFlow({
      ...IMAP_CONFIG,
      auth: { user: email, pass: password }
    });

    await client.connect();
    await client.logout();

    // Chiffrer le mot de passe avant stockage
    const encryptedPassword = encryptSensitiveData(password);

    // Stocker la session
    activeSessions.set(userId, {
      email,
      password: encryptedPassword,
      createdAt: Date.now()
    });

    console.log(`✅ Session mail créée pour ${email}`);
    return { success: true, email };
  } catch (error) {
    console.error('❌ Erreur création session mail:', error.message);
    throw new Error(`Impossible de se connecter à ${email}: ${error.message}`);
  }
}

/**
 * Récupérer une session mail
 * @param {string} userId - ID utilisateur
 */
export function getMailSession(userId) {
  const session = activeSessions.get(userId);
  if (!session) {
    throw new Error('Session mail non trouvée. Veuillez vous reconnecter.');
  }

  // Déchiffrer le mot de passe
  return {
    email: session.email,
    password: decryptSensitiveData(session.password),
    createdAt: session.createdAt
  };
}

/**
 * Supprimer une session mail
 * @param {string} userId - ID utilisateur
 */
export function deleteMailSession(userId) {
  activeSessions.delete(userId);
  console.log(`🗑️ Session mail supprimée pour user ${userId}`);
}

/**
 * Vérifier si une session existe
 * @param {string} userId - ID utilisateur
 */
export function hasMailSession(userId) {
  return activeSessions.has(userId);
}

/**
 * Lister les emails d'un dossier
 * @param {string} userId - ID utilisateur
 * @param {string} folder - Dossier IMAP (INBOX, SENT, etc.)
 * @param {number} limit - Nombre max d'emails à récupérer
 */
export async function listEmails(userId, folder = 'INBOX', limit = 50) {
  const session = getMailSession(userId);
  
  const client = new ImapFlow({
    ...IMAP_CONFIG,
    auth: { user: session.email, pass: session.password }
  });

  try {
    await client.connect();
    
    // Trouver le vrai nom du dossier
    const realFolder = await findFolderName(client, folder);
    
    // Ouvrir le dossier
    const lock = await client.getMailboxLock(realFolder);
    
    try {
      const mailbox = await client.mailboxOpen(folder);
      const messageCount = mailbox.exists;
      
      console.log(`📬 Dossier ${folder} : ${messageCount} message(s)`);
      
      // Si aucun message, retourner un tableau vide
      if (messageCount === 0) {
        return [];
      }
      
      // Récupérer les derniers emails
      const messages = [];
      
      // Chercher les messages (limiter à 100 max pour éviter surcharge)
      const maxToFetch = Math.min(messageCount, 100);
      const range = messageCount > 100 ? `${messageCount - 99}:${messageCount}` : `1:${messageCount}`;
      
      for await (let msg of client.fetch(range, { 
        envelope: true, 
        bodyStructure: true,
        flags: true,
        uid: true
      })) {
        messages.push({
          id: msg.uid,
          from: msg.envelope.from?.[0]?.address || 'Inconnu',
          fromName: msg.envelope.from?.[0]?.name || '',
          subject: msg.envelope.subject || '(Sans objet)',
          date: msg.envelope.date,
          read: msg.flags.has('\\Seen'), // True si marqué comme lu
          flags: Array.from(msg.flags)
        });
      }

      // Trier par date décroissante et limiter
      messages.sort((a, b) => new Date(b.date) - new Date(a.date));
      const limited = messages.slice(0, limit);

      return limited;
    } finally {
      lock.release();
    }
  } catch (error) {
    console.error('❌ Erreur listage emails:', error.message);
    console.error('Stack:', error.stack);
    throw new Error(`Impossible de lire les emails: ${error.message}`);
  } finally {
    await client.logout();
  }
}

/**
 * Récupérer le contenu d'un email
 * @param {string} userId - ID utilisateur
 * @param {string} emailId - UID de l'email
 * @param {string} folder - Dossier IMAP
 */
export async function getEmail(userId, emailId, folder = 'INBOX') {
  const session = getMailSession(userId);
  
  const client = new ImapFlow({
    ...IMAP_CONFIG,
    auth: { user: session.email, pass: session.password }
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock(folder);
    
    try {
      // Récupérer l'email complet
      const message = await client.fetchOne(emailId, {
        envelope: true,
        bodyStructure: true,
        bodyParts: ['TEXT', 'HEADER'],
        flags: true
      });

      if (!message) {
        throw new Error('Email non trouvé');
      }

      // Extraire le corps du message
      let body = '';
      if (message.bodyParts && message.bodyParts.get('TEXT')) {
        body = message.bodyParts.get('TEXT').toString('utf-8');
      }

      // Marquer comme lu
      await client.messageFlagsAdd(emailId, ['\\Seen']);

      return {
        id: message.uid,
        from: message.envelope.from?.[0]?.address || 'Inconnu',
        fromName: message.envelope.from?.[0]?.name || '',
        to: message.envelope.to?.map(t => t.address).join(', ') || '',
        subject: message.envelope.subject || '(Sans objet)',
        date: message.envelope.date,
        body: body,
        read: true,
        attachments: [] // TODO: extraire les pièces jointes si nécessaire
      };
    } finally {
      lock.release();
    }
  } catch (error) {
    console.error('❌ Erreur lecture email:', error.message);
    throw new Error(`Impossible de lire l'email: ${error.message}`);
  } finally {
    await client.logout();
  }
}

/**
 * Envoyer un email
 * @param {string} userId - ID utilisateur
 * @param {object} mailOptions - Options de l'email { to, subject, body, html, attachments }
 */
export async function sendEmail(userId, mailOptions) {
  const session = getMailSession(userId);

  // Créer le transporteur SMTP
  const transporter = nodemailer.createTransport({
    ...SMTP_CONFIG,
    auth: {
      user: session.email,
      pass: session.password
    }
  });

  try {
    // Vérifier la connexion
    await transporter.verify();

    // Envoyer l'email
    const info = await transporter.sendMail({
      from: session.email,
      to: mailOptions.to,
      subject: mailOptions.subject,
      text: mailOptions.body,
      html: mailOptions.html || mailOptions.body,
      attachments: mailOptions.attachments || []
    });

    console.log(`📧 Email envoyé: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Erreur envoi email:', error.message);
    throw new Error(`Impossible d'envoyer l'email: ${error.message}`);
  }
}

/**
 * Supprimer un email
 * @param {string} userId - ID utilisateur
 * @param {string} emailId - UID de l'email
 * @param {string} folder - Dossier IMAP
 */
export async function deleteEmail(userId, emailId, folder = 'INBOX') {
  const session = getMailSession(userId);
  
  const client = new ImapFlow({
    ...IMAP_CONFIG,
    auth: { user: session.email, pass: session.password }
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock(folder);
    
    try {
      // Marquer pour suppression
      await client.messageFlagsAdd(emailId, ['\\Deleted']);
      
      // Expunge pour supprimer définitivement
      await client.expunge();

      console.log(`🗑️ Email ${emailId} supprimé`);
      return { success: true };
    } finally {
      lock.release();
    }
  } catch (error) {
    console.error('❌ Erreur suppression email:', error.message);
    throw new Error(`Impossible de supprimer l'email: ${error.message}`);
  } finally {
    await client.logout();
  }
}

/**
 * Déplacer un email vers un dossier
 * @param {string} userId - ID utilisateur
 * @param {string} emailId - UID de l'email
 * @param {string} fromFolder - Dossier source
 * @param {string} toFolder - Dossier destination
 */
export async function moveEmail(userId, emailId, fromFolder, toFolder) {
  const session = getMailSession(userId);
  
  const client = new ImapFlow({
    ...IMAP_CONFIG,
    auth: { user: session.email, pass: session.password }
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock(fromFolder);
    
    try {
      // Déplacer l'email
      await client.messageMove(emailId, toFolder);

      console.log(`📁 Email ${emailId} déplacé de ${fromFolder} vers ${toFolder}`);
      return { success: true };
    } finally {
      lock.release();
    }
  } catch (error) {
    console.error('❌ Erreur déplacement email:', error.message);
    throw new Error(`Impossible de déplacer l'email: ${error.message}`);
  } finally {
    await client.logout();
  }
}

/**
 * Nettoyer les sessions expirées (appeler périodiquement)
 * @param {number} maxAge - Age max en ms (défaut: 24h)
 */
export function cleanupExpiredSessions(maxAge = 24 * 60 * 60 * 1000) {
  const now = Date.now();
  let cleaned = 0;

  for (const [userId, session] of activeSessions.entries()) {
    if (now - session.createdAt > maxAge) {
      activeSessions.delete(userId);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`🧹 ${cleaned} session(s) mail expirée(s) nettoyée(s)`);
  }
}

// Nettoyer les sessions toutes les heures
setInterval(() => cleanupExpiredSessions(), 60 * 60 * 1000);
