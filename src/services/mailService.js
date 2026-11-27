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
  'SENT': ['Sent', 'INBOX.Sent', 'Sent Messages', 'Sent Items', 'Envoyés', 'Elements envoyés', 'Éléments envoyés', 'INBOX.Envoyés'],
  'TRASH': ['Trash', 'INBOX.Trash', 'Deleted', 'INBOX.Deleted', 'Corbeille', 'INBOX.Corbeille'],
  'DRAFTS': ['Drafts', 'INBOX.Drafts', 'Brouillons', 'INBOX.Brouillons'],
  'SPAM': ['Spam', 'INBOX.Spam', 'Junk', 'INBOX.Junk', 'Indésirables', 'INBOX.Indésirables'],
  'ARCHIVE': ['Archives', 'Archive', 'INBOX.Archives', 'INBOX.Archive'],
  'PROMOTIONS': ['Promotions', 'INBOX.Promotions'],
  'SOCIAL_NETWORKS': ['SocialNetworks', 'INBOX.SocialNetworks', 'Réseaux sociaux', 'INBOX.Réseaux sociaux']
};

const SPECIAL_USE = {
  SENT: '\\Sent',
  TRASH: '\\Trash',
  DRAFTS: '\\Drafts',
  SPAM: '\\Junk',
  ARCHIVE: '\\Archive'
};

// Les images collées sont des data: URI, bloquées par la plupart des clients mail :
// on les transforme en images embarquées (cid:).
const extractInlineImages = (html) => {
  const inlineAttachments = [];
  const converted = String(html || '').replace(
    /(<img\b[^>]*?\ssrc=)(["'])data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)\2/gi,
    (_match, prefix, quote, contentType, data) => {
      const index = inlineAttachments.length + 1;
      const cid = `inline-${index}-${Date.now().toString(36)}@retromail`;
      const extension = contentType.split('/')[1].replace('jpeg', 'jpg').replace(/\+.*$/, '');
      inlineAttachments.push({
        filename: `image-${index}.${extension}`,
        content: data.replace(/\s+/g, ''),
        encoding: 'base64',
        contentType,
        cid,
        contentDisposition: 'inline'
      });
      return `${prefix}${quote}cid:${cid}${quote}`;
    }
  );
  return { html: converted, inlineAttachments };
};

const plainTextToHtml = (text) => String(text || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/\r?\n/g, '<br>');

const formatAddressList = (addresses) => (Array.isArray(addresses) ? addresses : [])
  .map((entry) => {
    const address = String(entry?.address || '').trim();
    const name = String(entry?.name || '').trim();
    if (!address) return '';
    return name ? `${name} <${address}>` : address;
  })
  .filter(Boolean)
  .join(', ');

const getMessageHeader = (source, headerName) => {
  const headerBlock = String(source || '').split(/\r?\n\r?\n/, 1)[0];
  const headerPattern = new RegExp(`^${headerName}:\\s*([^\\r\\n]*(?:\\r?\\n[ \\t]+[^\\r\\n]*)*)`, 'im');
  const match = headerBlock.match(headerPattern);
  return match ? match[1].replace(/\r?\n[ \t]+/g, ' ').trim() : '';
};

const normalizeMailAttachments = (attachments) => {
  if (!Array.isArray(attachments)) return [];

  return attachments.map((attachment, index) => {
    const filename = String(attachment?.filename || '').trim();
    const encodedContent = String(attachment?.content || '').replace(/\s+/g, '');

    if (!filename || !encodedContent || !/^[A-Za-z0-9+/]*={0,2}$/.test(encodedContent)) {
      throw new Error(`Pièce jointe ${index + 1} invalide.`);
    }

    const decodedSize = Buffer.byteLength(encodedContent, 'base64');
    if (decodedSize === 0) {
      throw new Error(`Pièce jointe ${index + 1} vide.`);
    }

    return {
      filename,
      content: encodedContent,
      encoding: 'base64',
      contentType: String(attachment.contentType || 'application/octet-stream'),
      contentDisposition: 'attachment'
    };
  });
};

/**
 * Trouver le vrai nom d'un dossier IMAP en essayant plusieurs variantes
 * @param {ImapFlow} client - Client IMAP connecté
 * @param {string} logicalFolder - Nom logique du dossier (INBOX, SENT, etc.)
 */
async function findFolderName(client, logicalFolder, { createIfMissing = false } = {}) {
  const candidates = FOLDER_MAPPING[logicalFolder] || [logicalFolder];
  const mailboxes = await client.list();

  const bySpecialUse = SPECIAL_USE[logicalFolder]
    ? mailboxes.find((m) => m.specialUse === SPECIAL_USE[logicalFolder])
    : null;
  if (bySpecialUse) return bySpecialUse.path;

  for (const candidate of candidates) {
    const found = mailboxes.find((m) => m.path.toLowerCase() === candidate.toLowerCase());
    if (found) return found.path;
  }

  if (createIfMissing) {
    await client.mailboxCreate(candidates[0]);
    return candidates[0];
  }

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
    console.log(`🔐 Tentative de connexion mail IMAP pour ${email}...`);
    console.log(`   Host: ${IMAP_CONFIG.host}:${IMAP_CONFIG.port}`);
    
    // Tester la connexion IMAP
    const client = new ImapFlow({
      ...IMAP_CONFIG,
      auth: { user: email, pass: password }
    });

    await client.connect();
    console.log(`✅ Connexion IMAP réussie pour ${email}`);
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
    console.error(`❌ Erreur création session mail pour ${email}:`, error.message);
    console.error(`   Code erreur:`, error.code);
    console.error(`   Détails:`, error.serverResponseText || error.response || 'N/A');
    
    // Message d'erreur plus détaillé selon le type d'erreur
    let userMessage = `Impossible de se connecter à ${email}`;
    if (error.code === 'EAUTH' || error.message.includes('auth')) {
      userMessage += ' : Identifiants incorrects (email ou mot de passe invalide)';
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      userMessage += ' : Serveur mail injoignable';
    } else {
      userMessage += ` : ${error.message}`;
    }
    
    throw new Error(userMessage);
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
 * @param {number} offset - Nombre de messages récents à ignorer
 */
export async function listEmails(userId, folder = 'INBOX', limit = 50, offset = 0, query = '') {
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
        return { emails: [], total: 0, hasMore: false };
      }
      
      const messages = [];

      const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 50, 1), 100);
      const safeOffset = Math.max(Number.parseInt(offset, 10) || 0, 0);
      const searchText = String(query || '').trim().slice(0, 200);
      let range;
      let byUid = false;
      let total = messageCount;
      let hasMore;

      if (searchText) {
        const matches = await client.search({
          or: [{ subject: searchText }, { from: searchText }, { to: searchText }, { body: searchText }]
        }, { uid: true });
        matches.sort((a, b) => b - a);
        total = matches.length;
        const pageUids = matches.slice(safeOffset, safeOffset + safeLimit);
        if (pageUids.length === 0) return { emails: [], total, hasMore: false };
        range = pageUids.join(',');
        byUid = true;
        hasMore = safeOffset + safeLimit < total;
      } else {
        const lastSequence = messageCount - safeOffset;
        if (lastSequence < 1) {
          return { emails: [], total: messageCount, hasMore: false };
        }
        const firstSequence = Math.max(1, lastSequence - safeLimit + 1);
        range = `${firstSequence}:${lastSequence}`;
        hasMore = firstSequence > 1;
      }

      for await (let msg of client.fetch(range, {
        envelope: true,
        bodyStructure: true,
        source: folder === 'SENT',
        flags: true,
        uid: true
      }, byUid ? { uid: true } : undefined)) {
        const sourceTo = folder === 'SENT' ? getMessageHeader(msg.source, 'to') : '';
        const sourceCc = folder === 'SENT' ? getMessageHeader(msg.source, 'cc') : '';
        const sourceBcc = folder === 'SENT' ? getMessageHeader(msg.source, 'x-retromail-bcc') : '';
        messages.push({
          id: msg.uid,
          from: msg.envelope.from?.[0]?.address || 'Inconnu',
          fromName: msg.envelope.from?.[0]?.name || '',
          to: formatAddressList(msg.envelope.to) || sourceTo,
          cc: formatAddressList(msg.envelope.cc) || sourceCc,
          bcc: sourceBcc,
          subject: msg.envelope.subject || '(Sans objet)',
          date: msg.envelope.date,
          read: msg.flags.has('\\Seen'), // True si marqué comme lu
          flagged: msg.flags.has('\\Flagged'),
          hasAttachments: JSON.stringify(msg.bodyStructure || {}).includes('"disposition":"attachment"'),
          flags: Array.from(msg.flags)
        });
      }

      // Trier par date décroissante dans la page chargée.
      messages.sort((a, b) => new Date(b.date) - new Date(a.date));
      return {
        emails: messages,
        total,
        hasMore
      };
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
      let parsedMessage = null;
      
      if (message.source) {
        try {
          const parsed = await simpleParser(message.source);
          parsedMessage = parsed;
          
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
        from: parsedMessage?.from?.value?.[0]?.address || message.envelope.from?.[0]?.address || 'Inconnu',
        fromName: parsedMessage?.from?.value?.[0]?.name || message.envelope.from?.[0]?.name || '',
        to: formatAddressList(parsedMessage?.to?.value || message.envelope.to),
        cc: formatAddressList(parsedMessage?.cc?.value || message.envelope.cc),
        bcc: getMessageHeader(message.source, 'x-retromail-bcc'),
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

async function appendSentCopy(session, mailData) {
  const client = new ImapFlow({
    ...IMAP_CONFIG,
    auth: { user: session.email, pass: session.password }
  });

  try {
    const rawTransporter = nodemailer.createTransport({
      streamTransport: true,
      buffer: true,
      newline: 'unix'
    });
    const rawInfo = await rawTransporter.sendMail(mailData);

    await client.connect();
    const sentFolder = await findFolderName(client, 'SENT');
    await client.append(sentFolder, rawInfo.message, ['\\Seen'], new Date());
    console.log(`✅ Copie ajoutée au dossier Envoyés (${sentFolder})`);
    return { success: true, folder: sentFolder };
  } catch (error) {
    console.warn('⚠️ Copie dans Envoyés impossible:', error.message);
    return { success: false, error: error.message };
  } finally {
    if (client.usable) {
      await client.logout().catch(() => {});
    }
  }
}

/**
 * Envoyer un email
 * @param {string} userId - ID utilisateur
 * @param {object} mailOptions - Options de l'email { to, subject, body, html, attachments, fromName, profilePhoto }
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

    const { html: htmlWithCids, inlineAttachments } = extractInlineImages(
      mailOptions.html || plainTextToHtml(mailOptions.body)
    );
    const processedAttachments = [...normalizeMailAttachments(mailOptions.attachments), ...inlineAttachments];

    console.log(`📧 Envoi email avec ${processedAttachments.length} pièce(s) jointe(s)`);

    const mailData = {
      from: fromAddress,
      to: mailOptions.to,
      cc: mailOptions.cc || undefined,
      bcc: mailOptions.bcc || undefined,
      envelope: {
        from: session.email,
        to: [...mailOptions.to, ...(mailOptions.cc || []), ...(mailOptions.bcc || [])]
      },
      subject: mailOptions.subject,
      text: mailOptions.body,
      html: htmlWithCids,
      attachments: processedAttachments,
      headers: {}
    };

    // Envoyer l'email
    const info = await transporter.sendMail(mailData);
    const sentCopy = await appendSentCopy(session, {
      ...mailData,
      headers: {
        ...mailData.headers,
        ...(mailOptions.bcc?.length ? { 'X-RetroMail-Bcc': mailOptions.bcc.join(', ') } : {})
      }
    });

    console.log(`✅ Email envoyé: ${info.messageId} (${processedAttachments.length} pièce(s) jointe(s))`);
    return { success: true, messageId: info.messageId, attachmentCount: processedAttachments.length - inlineAttachments.length, sentCopy };
  } catch (error) {
    console.error('❌ Erreur envoi email:', error.message);
    throw new Error(`Impossible d'envoyer l'email: ${error.message}`);
  } finally {
    transporter.close();
  }
}

const withMailbox = async (userId, work) => {
  const session = getMailSession(userId);
  const client = new ImapFlow({
    ...IMAP_CONFIG,
    auth: { user: session.email, pass: session.password }
  });
  try {
    await client.connect();
    return await work(client);
  } finally {
    if (client.usable) await client.logout().catch(() => {});
  }
};

/**
 * Supprimer un email : déplacé vers la corbeille, ou supprimé définitivement
 * s'il se trouve déjà dans la corbeille ou les indésirables.
 * @param {string} userId - ID utilisateur
 * @param {string} emailId - UID de l'email
 * @param {string} folder - Dossier IMAP logique
 */
export async function deleteEmail(userId, emailId, folder = 'INBOX') {
  try {
    return await withMailbox(userId, async (client) => {
      const realFolder = await findFolderName(client, folder);
      const trashFolder = await findFolderName(client, 'TRASH');
      const permanent = ['TRASH', 'SPAM'].includes(folder) || realFolder === trashFolder;

      const lock = await client.getMailboxLock(realFolder);
      try {
        if (permanent) {
          await client.messageFlagsAdd(emailId, ['\\Deleted'], { uid: true });
          await client.messageDelete(emailId, { uid: true });
        } else {
          await client.messageMove(emailId, trashFolder, { uid: true });
        }
        return { success: true, permanent };
      } finally {
        lock.release();
      }
    });
  } catch (error) {
    console.error('❌ Erreur suppression email:', error.message);
    throw new Error(`Impossible de supprimer l'email: ${error.message}`);
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
  try {
    return await withMailbox(userId, async (client) => {
      const realFromFolder = await findFolderName(client, fromFolder);
      const realToFolder = await findFolderName(client, toFolder, { createIfMissing: toFolder === 'ARCHIVE' });

      const lock = await client.getMailboxLock(realFromFolder);
      try {
        await client.messageMove(emailId, realToFolder, { uid: true });
        return { success: true };
      } finally {
        lock.release();
      }
    });
  } catch (error) {
    console.error('❌ Erreur déplacement email:', error.message);
    throw new Error(`Impossible de déplacer l'email: ${error.message}`);
  }
}

/**
 * Modifier les indicateurs d'un email (lu / non lu, étoile)
 * @param {{ seen?: boolean, flagged?: boolean }} changes
 */
export async function setEmailFlags(userId, emailId, folder, changes = {}) {
  try {
    return await withMailbox(userId, async (client) => {
      const realFolder = await findFolderName(client, folder);
      const lock = await client.getMailboxLock(realFolder);
      try {
        const apply = async (flag, enabled) => {
          if (enabled === undefined) return;
          if (enabled) await client.messageFlagsAdd(emailId, [flag], { uid: true });
          else await client.messageFlagsRemove(emailId, [flag], { uid: true });
        };
        await apply('\\Seen', changes.seen);
        await apply('\\Flagged', changes.flagged);
        return { success: true };
      } finally {
        lock.release();
      }
    });
  } catch (error) {
    console.error('❌ Erreur mise à jour indicateurs:', error.message);
    throw new Error(`Impossible de mettre à jour l'email: ${error.message}`);
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







