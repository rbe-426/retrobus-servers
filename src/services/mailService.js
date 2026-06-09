/**
 * Service de gestion des emails Infomaniak
 * Gère IMAP (lecture) et SMTP (envoi) via Infomaniak
 */

import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import { simpleParser } from 'mailparser';
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
 * Trouver l'ID utilisateur ayant une session mail active pour un email donne
 * @param {string} email - Adresse email a rechercher
 * @returns {string|null} userId si trouve, sinon null
 */
export function getSessionUserIdByEmail(email) {
  if (!email) return null;
  const target = String(email).toLowerCase();

  for (const [userId, session] of activeSessions.entries()) {
    if ((session?.email || '').toLowerCase() === target) {
      return userId;
    }
  }

  return null;
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
      const mailbox = await client.mailboxOpen(realFolder);
      const messageCount = mailbox.exists;
      
      console.log(`📬 Dossier ${folder} (${realFolder}) : ${messageCount} message(s)`);
      
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
 * Compter les emails non lus dans un dossier
 * @param {string} userId - ID utilisateur
 * @param {string} folder - Dossier IMAP
 * @returns {Promise<number>} Nombre d'emails non lus
 */
export async function getUnreadCount(userId, folder = 'INBOX') {
  const session = getMailSession(userId);
  
  const client = new ImapFlow({
    ...IMAP_CONFIG,
    auth: { user: session.email, pass: session.password }
  });

  try {
    await client.connect();
    
    // Trouver le vrai nom du dossier
    const realFolder = await findFolderName(client, folder);
    
    // Ouvrir le dossier en lecture seule
    const lock = await client.getMailboxLock(realFolder, { readonly: true });
    
    try {
      // Chercher les messages UNSEEN (non lus)
      const messages = await client.search({ seen: false });
      return messages.length;
    } finally {
      lock.release();
    }
  } catch (error) {
    console.error('❌ Erreur comptage emails non lus:', error.message);
    throw new Error(`Impossible de compter les emails non lus: ${error.message}`);
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
    
    // Trouver le vrai nom du dossier
    const realFolder = await findFolderName(client, folder);
    
    const lock = await client.getMailboxLock(realFolder);
    
    try {
      console.log(`📖 Lecture email UID ${emailId} dans ${realFolder}...`);
      
      // Récupérer l'email complet
      const message = await client.fetchOne(emailId, {
        envelope: true,
        bodyStructure: true,
        source: true,  // Récupérer le source complet
        flags: true,
        uid: true
      }, { uid: true });  // Spécifier que emailId est un UID

      if (!message) {
        throw new Error('Email non trouvé');
      }

      // Parser l'email avec mailparser pour décoder MIME, quoted-printable, base64, etc.
      let body = '';
      let textContent = '';
      let htmlContent = '';
      let attachments = [];
      
      if (message.source) {
        try {
          const parsed = await simpleParser(message.source);
          
          // Récupérer le texte brut
          if (parsed.text) {
            textContent = parsed.text.trim();
            body = textContent;
          }
          
          // Récupérer le HTML
          if (parsed.html) {
            htmlContent = parsed.html;
            // Si pas de texte, extraire du HTML
            if (!body) {
              body = htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            }
          } else if (parsed.textAsHtml) {
            htmlContent = parsed.textAsHtml;
          }
          
          // Extraire les pièces jointes
          if (parsed.attachments && parsed.attachments.length > 0) {
            attachments = parsed.attachments.map((att) => ({
              filename: att.filename || 'fichier_sans_nom',
              contentType: att.contentType || 'application/octet-stream',
              size: att.size || (att.content ? att.content.length : 0),
              // Convertir en base64 pour transmission au frontend
              content: att.content ? att.content.toString('base64') : null,
              // L'ID pour référence
              cid: att.cid || null
            }));
            console.log(`📎 ${attachments.length} pièce(s) jointe(s) extraite(s)`);
          }
          
          // Limiter à 50KB
          if (body.length > 50000) {
            body = body.substring(0, 50000) + '\n\n[... Message tronqué ...]';
          }
          if (htmlContent.length > 100000) {
            htmlContent = htmlContent.substring(0, 100000) + '\n\n<!-- Message tronqué -->';
          }
          
          console.log(`📄 Email parsé: ${body.length} caractères (text), ${htmlContent.length} caractères (html)`);
        } catch (parseError) {
          console.error('⚠️  Erreur parsing MIME:', parseError.message);
          body = '(Erreur lors du décodage du message)';
        }
      }

      // Marquer comme lu
      try {
        await client.messageFlagsAdd(emailId, ['\\Seen'], { uid: true });
      } catch (e) {
        console.warn('⚠️  Impossible de marquer comme lu:', e.message);
      }

      console.log(`✅ Email ${emailId} lu avec succès`);

      return {
        id: message.uid,
        from: message.envelope.from?.[0]?.address || 'Inconnu',
        fromName: message.envelope.from?.[0]?.name || '',
        to: message.envelope.to?.map(t => t.address).join(', ') || '',
        subject: message.envelope.subject || '(Sans objet)',
        date: message.envelope.date,
        body: body,
        html: htmlContent || null,
        read: true,
        attachments: attachments
      };
    } finally {
      lock.release();
    }
  } catch (error) {
    console.error('❌ Erreur lecture email:', error.message);
    console.error('Stack:', error.stack);
    throw new Error(`Impossible de lire l'email: ${error.message}`);
  } finally {
    await client.logout();
  }
}

/**
 * Envoyer un email
 * @param {string} userId - ID utilisateur
 * @param {object} mailOptions - Options de l'email { to, subject, body, html, attachments, fromName }
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
    // Construire le champ "from" avec le nom d'affichage si fourni
    const fromAddress = mailOptions.fromName 
      ? `"${mailOptions.fromName}" <${session.email}>`
      : session.email;

    // Convertir les pièces jointes base64 en format nodemailer
    const processedAttachments = (mailOptions.attachments || []).map(att => ({
      filename: att.filename,
      content: att.content, // Base64 string
      encoding: 'base64',
      contentType: att.contentType || 'application/octet-stream'
    }));

    console.log(`📧 Envoi email avec ${processedAttachments.length} pièce(s) jointe(s)`);

    // Envoyer l'email
    const info = await transporter.sendMail({
      from: fromAddress,
      to: mailOptions.to,
      cc: mailOptions.cc || undefined,
      bcc: mailOptions.bcc || undefined,
      subject: mailOptions.subject,
      text: mailOptions.body,
      html: mailOptions.html || mailOptions.body,
      attachments: processedAttachments
    });

    console.log(`✅ Email envoyé: ${info.messageId}`);
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
    
    // Trouver le vrai nom du dossier
    const realFolder = await findFolderName(client, folder);
    
    const lock = await client.getMailboxLock(realFolder);
    
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
    
    // Trouver les vrais noms des dossiers
    const realFromFolder = await findFolderName(client, fromFolder);
    const realToFolder = await findFolderName(client, toFolder);
    
    const lock = await client.getMailboxLock(realFromFolder);
    
    try {
      // Déplacer l'email
      await client.messageMove(emailId, realToFolder);

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







