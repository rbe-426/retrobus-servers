/**
 * Routes API pour RétroMail - Connexion Infomaniak
 */

import express from 'express';
import {
  createMailSession,
  getMailSession,
  deleteMailSession,
  hasMailSession,
  listEmails,
  getEmail,
  sendEmail,
  deleteEmail,
  moveEmail
} from '../services/mailService.js';
import { setNoreplyUserId } from '../services/notificationService.js';

const router = express.Router();

/**
 * Middleware pour vérifier l'authentification utilisateur
 */
const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  next();
};

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
      res.json({
        connected: true,
        email: session.email
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

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    // Valider le format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Format email invalide' });
    }

    // Créer la session
    const result = await createMailSession(userId, email, password);

    // Si c'est le compte noreply, configurer le service de notifications
    if (email === 'noreply@association-rbe.fr') {
      setNoreplyUserId(userId);
      console.log('✅ Compte NoReply configuré pour les notifications automatiques');
    }

    res.json({
      success: true,
      message: 'Connexion réussie',
      email: result.email
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
        error: 'Session mail non active. Veuillez vous reconnecter.' 
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
    console.error('Erreur liste emails:', error);
    res.status(500).json({ error: error.message });
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
 * Body: { to, subject, body, html?, attachments? }
 */
router.post('/send', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { to, subject, body, html, attachments, fromName } = req.body;

    if (!to || !subject || !body) {
      return res.status(400).json({ 
        error: 'Destinataire, objet et message requis' 
      });
    }

    if (!hasMailSession(userId)) {
      return res.status(401).json({ 
        error: 'Session mail non active. Veuillez vous reconnecter.' 
      });
    }

    const result = await sendEmail(userId, {
      to,
      subject,
      body,
      html,
      attachments,
      fromName
    });

    res.json({
      success: true,
      message: 'Email envoyé',
      messageId: result.messageId
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
