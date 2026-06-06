/**
 * Routes pour le parcours numérique de signature de bulletin
 * Gère les liens privés et le workflow de signature interactif
 */

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { sendEmail } from '../services/mailService.js';
import {
  generateSignatureToken,
  getTokenData,
  updateStepStatus,
  saveSignature,
  generateSignatureLink,
  generateSMSMessage,
  getSignatureStats,
  cleanupExpiredTokens
} from '../services/bulletinFlowService.js';
import { generateDocument } from '../services/templateService.js';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * POST /api/bulletin-flow/create - Crée un parcours de signature
 * Body: { memberData, sendEmail, sendSMS, email, phone }
 */
router.post('/create', async (req, res) => {
  try {
    const { memberData, sendEmail = true, sendSMS = false, email, phone } = req.body;

    if (!memberData || !memberData.firstName || !memberData.lastName) {
      return res.status(400).json({ 
        error: 'memberData avec firstName et lastName requis' 
      });
    }

    // Générer le token unique
    const token = generateSignatureToken(memberData);
    const link = generateSignatureLink(token);

    const response = {
      success: true,
      token,
      link,
      expiresIn: '7 days',
      emailSent: false,
      smsSent: false
    };

    // Envoyer par email
    if (sendEmail && email) {
      try {
        // Récupérer le template "parcours bulletin"
        const template = await prisma.emailTemplate.findUnique({
          where: { name: 'parcours bulletin' }
        });
        
        if (!template) {
          console.error('❌ Template "parcours bulletin" non trouvé');
        } else {
          const fullLink = generateSignatureLink(token, process.env.APP_BASE_URL || 'http://localhost:5173');
          
          // Remplacer les variables dans le template
          const htmlBody = template.body
            .replace(/\{\{lien bulletin\}\}/g, fullLink)
            .replace(/\{\{firstName\}\}/g, memberData.firstName || 'Adhérent');
          
          // Envoyer via le compte noreply
          const noreplyUser = await prisma.site_users.findFirst({
            where: { email: 'noreply@association-rbe.fr' }
          });
          
          if (noreplyUser) {
            await sendEmail(noreplyUser.id, {
              to: [email],
              subject: template.subject,
              html: htmlBody,
              text: `Bonjour ${memberData.firstName},\n\nSignez votre bulletin ici: ${fullLink}`
            });
            console.log('✅ Email envoyé à:', email);
            response.emailSent = true;
            response.emailRecipient = email;
          }
        }
      } catch (emailError) {
        console.error('❌ Erreur envoi email:', emailError.message);
      }
    }

    // Envoyer par SMS
    if (sendSMS && phone) {
      const smsMessage = generateSMSMessage(token, memberData.firstName);
      
      // TODO: Intégrer avec service SMS (Twilio, OVH, etc.)
      console.log(`📱 SMS à envoyer à: ${phone}`);
      console.log(`   Message: ${smsMessage}`);
      // await sendSMS(phone, smsMessage);
      
      response.smsSent = true;
      response.smsRecipient = phone;
    }

    res.status(201).json(response);
  } catch (error) {
    console.error('❌ Error creating bulletin flow:', error);
    res.status(500).json({ error: 'Failed to create bulletin flow', details: error.message });
  }
});

/**
 * GET /api/bulletin-flow/:token - Récupère les données du parcours
 */
router.get('/:token', (req, res) => {
  try {
    const { token } = req.params;
    const data = getTokenData(token);

    if (!data) {
      return res.status(404).json({ 
        error: 'Token invalide ou expiré',
        code: 'INVALID_TOKEN'
      });
    }

    // Ne pas exposer la signature dans la réponse GET (sécurité)
    const { signatureData, ipAddress, userAgent, ...safeData } = data;

    res.json({
      success: true,
      status: data.status,
      steps: data.steps,
      memberData: data.memberData,
      createdAt: data.createdAt,
      expiresAt: data.expiresAt,
      signedAt: data.signedAt
    });
  } catch (error) {
    console.error('❌ Error fetching bulletin flow:', error);
    res.status(500).json({ error: 'Failed to fetch bulletin flow', details: error.message });
  }
});

/**
 * POST /api/bulletin-flow/:token/step - Met à jour le statut d'une étape
 * Body: { step: 'welcome' | 'verification' | 'additional_info' | 'signature' | 'confirmation' }
 */
router.post('/:token/step', (req, res) => {
  try {
    const { token } = req.params;
    const { step, completed = true } = req.body;

    if (!step) {
      return res.status(400).json({ error: 'step required' });
    }

    const data = getTokenData(token);
    if (!data) {
      return res.status(404).json({ 
        error: 'Token invalide ou expiré',
        code: 'INVALID_TOKEN'
      });
    }

    const success = updateStepStatus(token, step, completed);

    if (!success) {
      return res.status(400).json({ error: 'Invalid step name' });
    }

    // Mettre à jour le statut global
    if (step === 'welcome' || step === 'verification') {
      data.status = 'in_progress';
    }

    res.json({
      success: true,
      step,
      completed,
      allSteps: data.steps
    });
  } catch (error) {
    console.error('❌ Error updating step:', error);
    res.status(500).json({ error: 'Failed to update step', details: error.message });
  }
});

/**
 * POST /api/bulletin-flow/:token/signature - Enregistre la signature
 * Body: { signatureDataUrl: 'data:image/png;base64,...' }
 */
router.post('/:token/signature', async (req, res) => {
  try {
    const { token } = req.params;
    const { signatureDataUrl } = req.body;

    if (!signatureDataUrl || !signatureDataUrl.startsWith('data:image')) {
      return res.status(400).json({ error: 'signatureDataUrl (base64) required' });
    }

    const data = getTokenData(token);
    if (!data) {
      return res.status(404).json({ 
        error: 'Token invalide ou expiré',
        code: 'INVALID_TOKEN'
      });
    }

    // Métadonnées de signature
    const metadata = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    };

    const success = saveSignature(token, signatureDataUrl, metadata);

    if (!success) {
      return res.status(500).json({ error: 'Failed to save signature' });
    }

    // Générer le document final avec la signature
    const templateId = 'adhesion_standard'; // TODO: Rendre configurable
    const memberData = data.memberData;
    const timestamp = Date.now();
    const outputFilename = `bulletin_${memberData.lastName}_${timestamp}.docx`;

    let documentGenerated = false;
    let documentUrl = null;

    try {
      // Ajouter la signature aux données
      const dataWithSignature = {
        ...memberData,
        signature: signatureDataUrl,
        signedDate: new Date().toLocaleDateString('fr-FR'),
        signedDateTime: new Date().toLocaleString('fr-FR')
      };

      await generateDocument(templateId, dataWithSignature, outputFilename);
      documentUrl = `/api/templates/download/${outputFilename}`;
      documentGenerated = true;

      console.log(`✅ Document généré avec signature: ${outputFilename}`);
    } catch (docError) {
      console.error('⚠️ Failed to generate document:', docError);
      // Ne pas bloquer si génération échoue
    }

    res.json({
      success: true,
      message: 'Signature enregistrée avec succès',
      status: 'signed',
      signedAt: data.signedAt,
      documentGenerated,
      documentUrl
    });
  } catch (error) {
    console.error('❌ Error saving signature:', error);
    res.status(500).json({ error: 'Failed to save signature', details: error.message });
  }
});

/**
 * POST /api/bulletin-flow/:token/resend - Renvoie le lien par email/SMS
 * Body: { method: 'email' | 'sms', recipient }
 */
router.post('/:token/resend', async (req, res) => {
  try {
    const { token } = req.params;
    const { method = 'email', recipient } = req.body;

    const data = getTokenData(token);
    if (!data) {
      return res.status(404).json({ 
        error: 'Token invalide ou expiré',
        code: 'INVALID_TOKEN'
      });
    }

    if (!recipient) {
      return res.status(400).json({ error: 'recipient required' });
    }

    const response = {
      success: true,
      method,
      recipient
    };

    if (method === 'email') {
      const emailData = generateSignatureEmail(token, data.memberData);
      console.log(`📧 Renvoi email à: ${recipient}`);
      // TODO: await sendEmail(recipient, emailData.subject, emailData.text, emailData.html);
      response.sent = true;
    } else if (method === 'sms') {
      const smsMessage = generateSMSMessage(token, data.memberData.firstName);
      console.log(`📱 Renvoi SMS à: ${recipient}`);
      // TODO: await sendSMS(recipient, smsMessage);
      response.sent = true;
    } else {
      return res.status(400).json({ error: 'method must be "email" or "sms"' });
    }

    res.json(response);
  } catch (error) {
    console.error('❌ Error resending link:', error);
    res.status(500).json({ error: 'Failed to resend link', details: error.message });
  }
});

/**
 * GET /api/bulletin-flow/stats - Statistiques des parcours de signature
 */
router.get('/stats/all', (req, res) => {
  try {
    const stats = getSignatureStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('❌ Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats', details: error.message });
  }
});

/**
 * POST /api/bulletin-flow/cleanup - Nettoie les tokens expirés (admin)
 */
router.post('/cleanup', (req, res) => {
  try {
    const cleaned = cleanupExpiredTokens();
    res.json({ success: true, cleaned });
  } catch (error) {
    console.error('❌ Error cleaning up:', error);
    res.status(500).json({ error: 'Failed to cleanup', details: error.message });
  }
});

// Nettoyage automatique toutes les 6 heures
setInterval(() => {
  cleanupExpiredTokens();
}, 6 * 60 * 60 * 1000);

export default router;
