/**
 * Routes API pour RétroMail - Connexion Infomaniak
 */

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';
import {
  createMailSession,
  getMailSession,
  deleteMailSession,
  hasMailSession,
  listEmails,
  getEmail,
  sendEmail,
  deleteEmail,
  moveEmail,
  getUnreadCount
} from '../services/mailService.js';
import { changeInfomaniakMailboxPassword, getInfomaniakMailboxInfo } from '../services/infomaniakMailAdminService.js';
import { setNoreplyUserId, sendRetromailPasswordResetEmail } from '../services/notificationService.js';

const router = express.Router();
const prisma = new PrismaClient();

const normalizeRecipients = (value) => {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => normalizeRecipients(item))
      .filter(Boolean);
  }

  return String(value || '')
    .split(/[;,\n\r]+/)
    .map((recipient) => recipient.trim())
    .filter(Boolean);
};

const improveMailText = (value, context = {}) => {
  const replacements = [
    [/\bje voulais\b/gi, 'je souhaiterais'],
    [/\bje vous écris pour\b/gi, 'je me permets de vous contacter afin de'],
    [/\bmerci de me dire\b/gi, "je vous remercie de bien vouloir m'indiquer"],
    [/\bje voudrais savoir\b/gi, 'je souhaiterais savoir'],
    [/\bau plus vite\b/gi, 'dans les meilleurs délais'],
    [/\bcordialement\b/gi, 'Cordialement']
  ];

  const improvedText = value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => {
      const compactLine = line.replace(/\s+/g, ' ').trim();
      if (!compactLine) return '';

      const rewrittenLine = replacements.reduce(
        (text, [pattern, replacement]) => text.replace(pattern, replacement),
        compactLine
      );

      return rewrittenLine.charAt(0).toLocaleUpperCase('fr-FR') + rewrittenLine.slice(1);
    })
    .join('\n')
    .trim();

  const instructions = String(context.instructions || '').trim();
  const asksForGreeting = /\b(bonjour|salutation|formule d['’]appel)\b/i.test(instructions);
  const purposeMatch = instructions.match(/\b(présent(?:er|ant)|informer|demander|solliciter|proposer|confirmer|rappeler)\b[\s\S]*/i);

  if (instructions && improvedText.length <= 40 && purposeMatch) {
    const purpose = purposeMatch[0]
      .replace(/^présentant\b/i, 'présenter')
      .replace(/intentions? de préservations?\b/i, 'intentions de préservation')
      .replace(/[.\s]+$/, '');

    return `${asksForGreeting ? 'Bonjour,' : 'Madame, Monsieur,'}\n\nJe me permets de vous contacter afin de ${purpose}.\n\nJe reste à votre disposition pour toute information complémentaire.\n\nCordialement,`;
  }

  if (asksForGreeting && !/^bonjour[\s,]/i.test(improvedText)) {
    return `Bonjour,\n\n${improvedText}\n\nCordialement,`;
  }

  return improvedText;
};

const limitContextText = (value, maximumLength) => String(value || '')
  .replace(/\r\n?/g, '\n')
  .trim()
  .slice(0, maximumLength);

const normalizeImprovementContext = (value) => {
  const rawContext = value && typeof value === 'object' ? value : {};
  const conversation = rawContext.conversation && typeof rawContext.conversation === 'object'
    ? {
        subject: limitContextText(rawContext.conversation.subject, 500),
        from: limitContextText(rawContext.conversation.from, 500),
        to: limitContextText(rawContext.conversation.to, 500),
        date: limitContextText(rawContext.conversation.date, 100),
        body: limitContextText(rawContext.conversation.body, 12000)
      }
    : null;
  const conversationMessages = Array.isArray(rawContext.conversationMessages)
    ? rawContext.conversationMessages.slice(0, 8).map((message) => ({
        subject: limitContextText(message?.subject, 500),
        from: limitContextText(message?.from, 500),
        to: limitContextText(message?.to, 500),
        date: limitContextText(message?.date, 100),
        body: limitContextText(message?.body, 2500)
      }))
    : [];
  const files = Array.isArray(rawContext.files)
    ? rawContext.files.slice(0, 5).map((file) => ({
        name: limitContextText(file?.name, 255),
        content: limitContextText(file?.content, 12000)
      })).filter((file) => file.content)
    : [];

  return {
    instructions: limitContextText(rawContext.instructions, 4000),
    conversation,
    conversationMessages,
    files
  };
};

const formatImprovementContext = (context) => {
  const sections = [];

  if (context.instructions) {
    sections.push(`Consigne complémentaire :\n${context.instructions}`);
  }
  if (context.conversation) {
    sections.push(`Message auquel répondre :\nObjet : ${context.conversation.subject}\nDe : ${context.conversation.from}\nContenu :\n${context.conversation.body}`);
  }
  if (context.conversationMessages.length > 0) {
    sections.push(`Autres messages du fil :\n${context.conversationMessages.map((message) => `De : ${message.from}\nObjet : ${message.subject}\n${message.body}`).join('\n\n---\n\n')}`);
  }
  if (context.files.length > 0) {
    sections.push(`Fichiers textuels joints :\n${context.files.map((file) => `Fichier : ${file.name}\n${file.content}`).join('\n\n---\n\n')}`);
  }

  return sections.join('\n\n====\n\n');
};

const improveMailTextWithOpenAI = async (text, context) => {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  const contextText = formatImprovementContext(context);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.4,
        messages: [
          {
            role: 'system',
            content: 'Tu es un assistant de rédaction d’emails professionnels en français. Réécris le brouillon selon la consigne et le contexte fournis. Conserve les faits, les noms, les dates et les demandes. N’invente aucune information. Retourne uniquement le texte final de l’email, sans titre, explication, Markdown ni guillemets.'
          },
          {
            role: 'user',
            content: `Brouillon à améliorer :\n${text}${contextText ? `\n\nContexte :\n${contextText}` : ''}`
          }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error?.error?.message || `OpenAI a répondu ${response.status}`);
    }

    const payload = await response.json();
    const improvedText = String(payload?.choices?.[0]?.message?.content || '').trim();
    if (!improvedText) throw new Error('OpenAI n’a renvoyé aucun texte');
    return improvedText;
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Middleware pour vérifier l'authentification utilisateur
 */
const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  next();
};

const requireMailAdministrator = (req, res, next) => {
  const role = String(req.user?.role || '').toUpperCase();
  if (!['ADMIN', 'PRESIDENT'].includes(role)) {
    return res.status(403).json({ error: 'Acces reserve a l administration RétroMail.' });
  }
  next();
};

const buildRetromailAddress = (matricule) => {
  const localPart = String(matricule || '').trim().toLowerCase();
  return /^[a-z0-9][a-z0-9._-]*$/.test(localPart)
    ? `${localPart}@association-rbe.fr`
    : '';
};

const findCurrentMember = async (user) => {
  const userId = String(user?.id || '').trim();
  const email = String(user?.email || '').trim().toLowerCase();
  return prisma.members.findFirst({
    where: {
      OR: [
        ...(userId ? [{ id: userId }] : []),
        ...(email ? [{ email }] : [])
      ]
    }
  });
};

const generateRetromailTemporaryPassword = () => `${randomBytes(12).toString('base64url')}Aa1!`;

router.get('/admin/members', requireAuth, requireMailAdministrator, async (_req, res) => {
  try {
    const members = await prisma.members.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        matricule: true,
        retroMailPasswordResetRequired: true,
        retroMailPasswordResetAt: true,
        updatedAt: true
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
    });

    res.json({
      members: members.map((member) => ({
        ...member,
        mailbox: buildRetromailAddress(member.matricule),
        hasValidMailboxIdentifier: Boolean(buildRetromailAddress(member.matricule))
      }))
    });
  } catch (error) {
    console.error('Unable to list RétroMail members:', error.message);
    res.status(500).json({ error: 'Impossible de charger les adhérents RétroMail.' });
  }
});

router.get('/admin/members/:id/mailbox', requireAuth, requireMailAdministrator, async (req, res) => {
  try {
    const member = await prisma.members.findUnique({ where: { id: req.params.id } });
    if (!member) return res.status(404).json({ error: 'Adhérent introuvable.' });

    const email = buildRetromailAddress(member.matricule);
    if (!email) return res.status(400).json({ error: 'Le matricule de cet adhérent ne permet pas de construire une adresse RétroMail.' });

    const mailbox = await getInfomaniakMailboxInfo(email);
    res.json({
      member: { id: member.id, firstName: member.firstName, lastName: member.lastName, personalEmail: member.email },
      mailbox: {
        email: mailbox.email,
        exists: true,
        passwordResetRequired: member.retroMailPasswordResetRequired,
        passwordResetAt: member.retroMailPasswordResetAt
      }
    });
  } catch (error) {
    console.error('Unable to get RétroMail mailbox:', error.message);
    res.status(error.statusCode || 502).json({ error: error.message || 'Impossible de consulter la boîte RétroMail.' });
  }
});

router.post('/admin/members/:id/reset-password', requireAuth, requireMailAdministrator, async (req, res) => {
  try {
    const member = await prisma.members.findUnique({ where: { id: req.params.id } });
    if (!member) return res.status(404).json({ error: 'Adhérent introuvable.' });

    const mailbox = buildRetromailAddress(member.matricule);
    if (!mailbox) return res.status(400).json({ error: 'Le matricule de cet adhérent ne permet pas de construire une adresse RétroMail.' });

    const temporaryPassword = generateRetromailTemporaryPassword();
    await changeInfomaniakMailboxPassword(mailbox, temporaryPassword);
    await prisma.members.update({
      where: { id: member.id },
      data: { retroMailPasswordResetRequired: true, retroMailPasswordResetAt: new Date() }
    });

    const emailSent = await sendRetromailPasswordResetEmail(member.email, member, temporaryPassword);
    if (!emailSent) {
      return res.status(503).json({ error: 'Le mot de passe a été réinitialisé, mais l’email personnel n’a pas pu être envoyé. Vérifiez la connexion du compte NoReply avant de relancer la réinitialisation.' });
    }

    res.json({ success: true, mailbox, recipientEmail: member.email });
  } catch (error) {
    console.error('Unable to reset RétroMail password:', error.message);
    res.status(error.statusCode || 502).json({ error: error.message || 'Réinitialisation RétroMail impossible.' });
  }
});

router.get('/password-reset-status', requireAuth, async (req, res) => {
  try {
    const member = await findCurrentMember(req.user);
    if (!member) return res.status(404).json({ error: 'Profil adhérent introuvable.' });
    res.json({ required: member.retroMailPasswordResetRequired, mailbox: buildRetromailAddress(member.matricule) });
  } catch (error) {
    res.status(500).json({ error: 'Impossible de vérifier le statut du mot de passe RétroMail.' });
  }
});

router.post('/password-reset/complete', requireAuth, async (req, res) => {
  try {
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
    const confirmPassword = typeof req.body?.confirmPassword === 'string' ? req.body.confirmPassword : '';
    if (newPassword.length < 12) return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 12 caractères.' });
    if (newPassword !== confirmPassword) return res.status(400).json({ error: 'Les mots de passe ne correspondent pas.' });

    const member = await findCurrentMember(req.user);
    if (!member?.retroMailPasswordResetRequired) return res.status(409).json({ error: 'Aucune réinitialisation RétroMail en attente.' });

    const mailbox = buildRetromailAddress(member.matricule);
    const session = getMailSession(req.user.id);
    if (!mailbox || session.email !== mailbox) return res.status(403).json({ error: 'Connectez-vous d’abord à votre boîte RétroMail avec le mot de passe provisoire.' });

    await changeInfomaniakMailboxPassword(mailbox, newPassword);
    await prisma.members.update({
      where: { id: member.id },
      data: { retroMailPasswordResetRequired: false }
    });
    deleteMailSession(req.user.id);
    res.json({ success: true, message: 'Mot de passe RétroMail mis à jour. Connectez-vous avec votre nouveau mot de passe.' });
  } catch (error) {
    console.error('Unable to complete RétroMail password reset:', error.message);
    res.status(error.statusCode || 502).json({ error: error.message || 'Modification du mot de passe RétroMail impossible.' });
  }
});

/**
 * POST /api/mail/improve-text
 * Reformule un brouillon de façon plus claire et professionnelle.
 * Body: { text, context?: { instructions, conversation, conversationMessages, files } }
 */
router.post('/improve-text', requireAuth, async (req, res) => {
  const text = String(req.body?.text || '').trim();
  const context = normalizeImprovementContext(req.body?.context);

  if (!text) {
    return res.status(400).json({ error: 'Texte à améliorer requis' });
  }

  if (text.length > 10000) {
    return res.status(400).json({ error: 'Le texte ne peut pas dépasser 10 000 caractères' });
  }

  let improvedText;
  let provider = 'local';

  try {
    improvedText = await improveMailTextWithOpenAI(text, context);
    if (improvedText) provider = 'openai';
  } catch (error) {
    console.error('Amélioration OpenAI indisponible :', error.message);
  }

  return res.json({
    improvedText: improvedText || improveMailText(text, context),
    provider,
    contextUsed: {
      instructions: Boolean(context.instructions),
      conversation: Boolean(context.conversation?.body),
      conversationMessages: context.conversationMessages.length,
      files: context.files.map((file) => file.name)
    }
  });
});

/**
 * GET /api/mail/status
 * Vérifier si l'utilisateur a une session mail active
 */
router.get('/status', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const connected = hasMailSession(userId);
    
    if (connected) {
      const session = getMailSession(userId);
      const member = await findCurrentMember(req.user);
      res.json({
        connected: true,
        email: session.email,
        mustChangeRetromailPassword: Boolean(member?.retroMailPasswordResetRequired)
      });
    } else {
      res.json({
        connected: false
      });
    }
  } catch (error) {
    console.error('Erreur status mail:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/mail/connect
 * Connecter un compte Infomaniak
 * Body: { email, password }
 */
router.post('/connect', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { email, password } = req.body;

    const normalizeMailLogin = (rawEmail) => {
      const normalized = String(rawEmail || '').trim().toLowerCase();

      // Corrige faute de frappe frequente observee en production
      if (normalized.endsWith('@ssociation-rbe.fr')) {
        return normalized.replace('@ssociation-rbe.fr', '@association-rbe.fr');
      }

      return normalized;
    };

    const safeEmail = normalizeMailLogin(email);

    if (!safeEmail || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    // Valider le format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(safeEmail)) {
      return res.status(400).json({ error: 'Format email invalide' });
    }

    // Créer la session
    const result = await createMailSession(userId, safeEmail, password);

    // Si c'est le compte noreply, configurer le service de notifications
    if (safeEmail === 'noreply@association-rbe.fr') {
      setNoreplyUserId(userId);
      console.log('✅ Compte NoReply configuré pour les notifications automatiques');
    }

    const member = await findCurrentMember(req.user);

    res.json({
      success: true,
      message: 'Connexion réussie',
      email: result.email,
      mustChangeRetromailPassword: Boolean(member?.retroMailPasswordResetRequired)
    });
  } catch (error) {
    console.error('Erreur connexion mail:', error);
    res.status(401).json({ 
      error: error.message || 'Échec de connexion' 
    });
  }
});

/**
 * POST /api/mail/disconnect
 * Déconnecter le compte mail
 */
router.post('/disconnect', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    deleteMailSession(userId);

    res.json({
      success: true,
      message: 'Déconnexion réussie'
    });
  } catch (error) {
    console.error('Erreur déconnexion mail:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/mail/unread-count
 * Compter les emails non lus dans INBOX
 */
router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    if (!hasMailSession(userId)) {
      return res.json({ count: 0 }); // Pas connecté = 0 non lus
    }

    const count = await getUnreadCount(userId, 'INBOX');

    res.json({
      success: true,
      count
    });
  } catch (error) {
    console.error('Erreur comptage emails non lus:', error);
    // En cas d'erreur, renvoyer 0 au lieu de fail
    res.json({ count: 0 });
  }
});

/**
 * GET /api/mail/unread-count
 * Compter les emails non lus dans INBOX
 */
router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    if (!hasMailSession(userId)) {
      return res.json({ count: 0 }); // Pas connecté = 0 non lus
    }

    const count = await getUnreadCount(userId, 'INBOX');

    res.json({
      success: true,
      count
    });
  } catch (error) {
    console.error('Erreur comptage emails non lus:', error);
    // En cas d'erreur, renvoyer 0 au lieu de fail
    res.json({ count: 0 });
  }
});

/**
 * GET /api/mail/list
 * Lister les emails
 * Query params: folder (default: INBOX), limit (default: 50)
 */
router.get('/list', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const folder = req.query.folder || 'INBOX';
    const limit = parseInt(req.query.limit) || 50;

    if (!hasMailSession(userId)) {
      return res.status(401).json({ 
        error: 'Session mail non active. Veuillez vous reconnecter.',
        success: false
      });
    }

    const emails = await listEmails(userId, folder, limit);

    res.json({
      success: true,
      emails: emails.map(email => ({
        id: email.id,
        from: email.from,
        fromName: email.fromName,
        subject: email.subject,
        date: email.date,
        read: email.read,
        preview: '' // Pas de preview dans la liste
      }))
    });
  } catch (error) {
    console.error(`❌ Erreur liste emails (folder: ${req.query.folder}):`, error.message);
    
    // Si le dossier n'existe pas, retourner une liste vide au lieu d'une erreur 500
    if (error.message?.includes('Mailbox does not exist') || 
        error.message?.includes('does not exist') ||
        error.message?.includes('Unknown Mailbox')) {
      return res.json({
        success: true,
        emails: [],
        warning: `Le dossier "${req.query.folder}" n'existe pas pour ce compte.`
      });
    }
    
    res.status(500).json({ 
      error: error.message || 'Erreur lors de la récupération des emails',
      success: false
    });
  }
});

/**
 * GET /api/mail/read/:id
 * Lire un email complet
 * Query params: folder (default: INBOX)
 */
router.get('/read/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const emailId = req.params.id;
    const folder = req.query.folder || 'INBOX';

    if (!hasMailSession(userId)) {
      return res.status(401).json({ 
        error: 'Session mail non active. Veuillez vous reconnecter.' 
      });
    }

    const email = await getEmail(userId, emailId, folder);

    res.json({
      success: true,
      email
    });
  } catch (error) {
    console.error('Erreur lecture email:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/mail/send
 * Envoyer un email
 * Body: { to, cc?, bcc?, subject, body, html?, attachments?, fromName?, profilePhoto? }
 */
router.post('/send', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { to, cc, bcc, subject, body, html, attachments, fromName, profilePhoto } = req.body;
    const toRecipients = normalizeRecipients(to);
    const ccRecipients = normalizeRecipients(cc);
    const bccRecipients = normalizeRecipients(bcc);
    const normalizedSubject = String(subject || '').trim();
    const normalizedBody = String(body || '');
    const hasContent = normalizedSubject ||
      normalizedBody.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim() ||
      (Array.isArray(attachments) && attachments.length > 0);

    if (toRecipients.length === 0 || !hasContent) {
      return res.status(400).json({ 
        error: 'Destinataire et contenu requis' 
      });
    }

    if (!hasMailSession(userId)) {
      return res.status(401).json({ 
        error: 'Session mail non active. Veuillez vous reconnecter.' 
      });
    }

    const result = await sendEmail(userId, {
      to: toRecipients,
      cc: ccRecipients.length > 0 ? ccRecipients : undefined,
      bcc: bccRecipients.length > 0 ? bccRecipients : undefined,
      subject: normalizedSubject,
      body: normalizedBody,
      html,
      attachments,
      fromName,
      profilePhoto
    });

    res.json({
      success: true,
      message: 'Email envoyé',
      messageId: result.messageId,
      attachmentCount: result.attachmentCount,
      sentCopy: result.sentCopy || null
    });
  } catch (error) {
    console.error('Erreur envoi email:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/mail/delete/:id
 * Supprimer un email
 * Query params: folder (default: INBOX)
 */
router.delete('/delete/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const emailId = req.params.id;
    const folder = req.query.folder || 'INBOX';

    if (!hasMailSession(userId)) {
      return res.status(401).json({ 
        error: 'Session mail non active. Veuillez vous reconnecter.' 
      });
    }

    await deleteEmail(userId, emailId, folder);

    res.json({
      success: true,
      message: 'Email supprimé'
    });
  } catch (error) {
    console.error('Erreur suppression email:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/mail/move/:id
 * Déplacer un email vers un dossier
 * Body: { fromFolder, toFolder }
 */
router.post('/move/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const emailId = req.params.id;
    const { fromFolder, toFolder } = req.body;

    if (!fromFolder || !toFolder) {
      return res.status(400).json({ 
        error: 'Dossiers source et destination requis' 
      });
    }

    if (!hasMailSession(userId)) {
      return res.status(401).json({ 
        error: 'Session mail non active. Veuillez vous reconnecter.' 
      });
    }

    await moveEmail(userId, emailId, fromFolder, toFolder);

    res.json({
      success: true,
      message: 'Email déplacé'
    });
  } catch (error) {
    console.error('Erreur déplacement email:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
