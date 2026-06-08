/**
 * Routes pour le parcours numérique de signature de bulletin
 * Gère les liens privés et le workflow de signature interactif
 */

import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';
import { sendEmail, hasMailSession, getSessionUserIdByEmail } from '../services/mailService.js';
import { getNoreplyUserId } from '../services/notificationService.js';
import {
  generateSignatureToken,
  getTokenData,
  updateStepStatus,
  updateMemberData,
  saveSignature,
  generateSignatureLink,
  generateSMSMessage,
  getSignatureStats,
  cleanupExpiredTokens
} from '../services/bulletinFlowService.js';
import { generateDocument } from '../services/templateService.js';

const router = express.Router();
const prisma = new PrismaClient();
const BULLETIN_ADMIN_EMAIL = process.env.BULLETIN_ADMIN_EMAIL || 'association.rbe@gmail.com';

const resolveBulletinPublicBaseUrl = () => {
  // Priorite aux variables explicites de production
  return (
    process.env.BULLETIN_PUBLIC_BASE_URL ||
    process.env.SIGNATURE_PUBLIC_BASE_URL ||
    process.env.APP_BASE_URL ||
    null
  );
};

const resolveRequestApiBaseUrl = (req) => {
  const explicitApiBase = process.env.BULLETIN_API_BASE_URL || process.env.PUBLIC_API_BASE_URL || process.env.API_PUBLIC_BASE_URL;
  if (explicitApiBase) {
    return explicitApiBase.replace(/\/+$/, '');
  }

  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.get('host');
  if (!host) return null;

  const raw = `${proto}://${host}`;
  try {
    const parsed = new URL(raw);
    const hn = parsed.hostname.toLowerCase();
    const isLocalHost = hn === 'localhost' || hn === '127.0.0.1' || hn === '0.0.0.0';
    const isPrivateIp = /^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[0-1])\./.test(hn);

    if (isLocalHost || isPrivateIp) {
      return null;
    }

    return parsed.origin;
  } catch {
    return null;
  }
};

const applyBulletinTemplateVars = (template = '', vars = {}) => {
  if (!template || typeof template !== 'string') return '';

  const replacements = [
    {
      // Supporte: {{lien bulletin}}, {{lien_bulletin}}, {{bulletinLink}}, <lien bulletin>, &lt;lien bulletin&gt;
      pattern: /\{\{\s*(lien\s*bulletin|lien_bulletin|bulletinLink)\s*\}\}|<\s*lien\s+bulletin\s*>|&lt;\s*lien\s+bulletin\s*&gt;|&#60;\s*lien\s+bulletin\s*&#62;/gi,
      value: vars.link || ''
    },
    {
      // Supporte: {{firstName}}, {{first_name}}, <firstName>
      pattern: /\{\{\s*(firstName|first_name)\s*\}\}|<\s*firstName\s*>/gi,
      value: vars.firstName || 'Adherent'
    }
  ];

  return replacements.reduce((acc, { pattern, value }) => acc.replace(pattern, value), template);
};

const resolveNoreplySenderUserId = async () => {
  let senderUserId = getNoreplyUserId();

  if (!senderUserId) {
    senderUserId = getSessionUserIdByEmail('noreply@association-rbe.fr');
  }

  if (!senderUserId) {
    const noreplyUser = await prisma.site_users.findFirst({
      where: { email: 'noreply@association-rbe.fr' }
    });
    if (noreplyUser && hasMailSession(noreplyUser.id)) {
      senderUserId = noreplyUser.id;
    }
  }

  return senderUserId;
};

const sendAdminBulletinViaSmtpFallback = async ({
  to,
  subject,
  text,
  html,
  filename,
  buffer
}) => {
  const smtpHost = process.env.SMTP_HOST || 'mail.infomaniak.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpUser = process.env.EMAIL_USER || process.env.SMTP_USER || 'noreply@association-rbe.fr';
  const smtpPass = process.env.EMAIL_PASSWORD || process.env.SMTP_PASSWORD;

  if (!smtpPass) {
    throw new Error('SMTP_FALLBACK_MISSING_CREDENTIALS');
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    requireTLS: smtpPort !== 465,
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });

  await transporter.verify();

  await transporter.sendMail({
    from: `"RetroBus Essonne" <${smtpUser}>`,
    to,
    subject,
    text,
    html,
    attachments: [
      {
        filename,
        content: buffer,
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }
    ]
  });
};

const formatErrorDetails = (error) => {
  if (!error) return 'Unknown error';

  const nested = [];

  if (Array.isArray(error.errors)) {
    for (const item of error.errors) {
      const msg = item?.message || String(item || '');
      if (msg) nested.push(msg);
    }
  }

  if (error.cause) {
    const causeMsg = error.cause?.message || String(error.cause);
    if (causeMsg) nested.push(causeMsg);
  }

  const base = error.message || String(error);
  if (nested.length === 0) return base;

  return `${base} | nested: ${nested.join(' | ')}`;
};

/**
 * POST /api/bulletin-flow/create - Crée un parcours de signature
 * Body: { memberData, sendEmail, sendSMS, email, phone }
 */
router.post('/create', async (req, res) => {
  try {
    const { memberData, sendEmail: sendEmailFlag = true, sendSMS: sendSMSFlag = false, email, phone } = req.body;

    if (!memberData || !memberData.firstName || !memberData.lastName) {
      return res.status(400).json({ 
        error: 'memberData avec firstName et lastName requis' 
      });
    }

    // Générer le token unique
    const token = await generateSignatureToken(memberData);
    const apiBaseUrl = resolveRequestApiBaseUrl(req);
    const linkBase = resolveBulletinPublicBaseUrl() || generateSignatureLink(token).replace(/\/bulletin\/sign\/.+$/, '');
    const rawLink = generateSignatureLink(token, linkBase);
    const link = apiBaseUrl
      ? `${rawLink}?api=${encodeURIComponent(apiBaseUrl)}`
      : rawLink;

    const response = {
      success: true,
      token,
      link,
      expiresIn: '7 days',
      emailRequested: !!(sendEmailFlag && email),
      smsRequested: !!(sendSMSFlag && phone),
      emailSent: false,
      smsSent: false
    };

    // Envoyer par email
    if (sendEmailFlag && email) {
      try {
        const bulletinPublicBaseUrl = resolveBulletinPublicBaseUrl();
        const linkBaseForEmail = bulletinPublicBaseUrl || linkBase;
        const rawFullLink = generateSignatureLink(token, linkBaseForEmail);
        const fullLink = apiBaseUrl
          ? `${rawFullLink}?api=${encodeURIComponent(apiBaseUrl)}`
          : rawFullLink;

        const basicSubject = 'Votre lien de completion du bulletin d\'adhesion';
        const basicText = `Bonjour ${memberData.firstName || 'Adherent'},\n\nVeuillez completer votre bulletin via ce lien securise (valide 7 jours):\n${fullLink}\n\nAssociation RETROBUS ESSONNE`;
        const basicHtml = `
          <p>Bonjour <strong>${memberData.firstName || 'Adherent'}</strong>,</p>
          <p>Veuillez completer votre bulletin d'adhesion via ce lien securise (valide 7 jours):</p>
          <p><a href="${fullLink}">${fullLink}</a></p>
          <p>Association RETROBUS ESSONNE</p>
        `;

        // Récupérer le template "parcours bulletin"
        const template = await prisma.emailTemplate.findUnique({
          where: { name: 'parcours bulletin' }
        });

        const htmlBody = template?.body
          ? applyBulletinTemplateVars(template.body, {
              link: fullLink,
              firstName: memberData.firstName
            })
          : basicHtml;

        const subject = template?.subject
          ? applyBulletinTemplateVars(template.subject, {
              link: fullLink,
              firstName: memberData.firstName
            })
          : basicSubject;

        // Priorite: userId de la session noreply connectee
        let senderUserId = getNoreplyUserId();

        // Fallback: retrouver une session active par email noreply
        if (!senderUserId) {
          senderUserId = getSessionUserIdByEmail('noreply@association-rbe.fr');
        }

        // Fallback final: ID DB noreply si session active sur cet ID
        if (!senderUserId) {
          const noreplyUser = await prisma.site_users.findFirst({
            where: { email: 'noreply@association-rbe.fr' }
          });
          if (noreplyUser && hasMailSession(noreplyUser.id)) {
            senderUserId = noreplyUser.id;
          }
        }

        if (!senderUserId) {
          console.error('❌ Aucun compte noreply connecté pour envoi email');
          response.emailError = 'NO_NOREPLY_SESSION';
        } else {
          await sendEmail(senderUserId, {
            to: [email],
            subject,
            html: htmlBody,
            body: basicText,
            fromName: 'RetroBus Essonne'
          });

          console.log('✅ Email envoyé à:', email);
          response.emailSent = true;
          response.emailRecipient = email;
        }
      } catch (emailError) {
        console.error('❌ Erreur envoi email:', emailError.message);
        response.emailError = emailError.message;
      }
    }

    // Envoyer par SMS
    if (sendSMSFlag && phone) {
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
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const data = await getTokenData(token);

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
router.post('/:token/step', async (req, res) => {
  try {
    const { token } = req.params;
    const { step, completed = true } = req.body;

    if (!step) {
      return res.status(400).json({ error: 'step required' });
    }

    const data = await getTokenData(token);
    if (!data) {
      return res.status(404).json({ 
        error: 'Token invalide ou expiré',
        code: 'INVALID_TOKEN'
      });
    }

    const success = await updateStepStatus(token, step, completed);

    if (!success) {
      return res.status(400).json({ error: 'Invalid step name' });
    }

    const refreshed = await getTokenData(token);

    res.json({
      success: true,
      step,
      completed,
      allSteps: refreshed?.steps || data.steps
    });
  } catch (error) {
    console.error('❌ Error updating step:', error);
    res.status(500).json({ error: 'Failed to update step', details: error.message });
  }
});

/**
 * PUT /api/bulletin-flow/:token/member-data - Met a jour les informations saisies par l'adherent
 * Body: { memberData: { ... } }
 */
router.put('/:token/member-data', async (req, res) => {
  try {
    const { token } = req.params;
    const { memberData } = req.body;

    if (!memberData || typeof memberData !== 'object') {
      return res.status(400).json({ error: 'memberData object required' });
    }

    const updated = await updateMemberData(token, memberData);

    if (!updated) {
      return res.status(404).json({
        error: 'Token invalide ou expire',
        code: 'INVALID_TOKEN'
      });
    }

    res.json({
      success: true,
      memberData: updated
    });
  } catch (error) {
    console.error('❌ Error updating member data:', error);
    res.status(500).json({ error: 'Failed to update member data', details: error.message });
  }
});

/**
 * POST /api/bulletin-flow/:token/signature - Enregistre la signature
 * Body: { signatureDataUrl: 'data:image/png;base64,...' }
 */
router.post('/:token/signature', async (req, res) => {
  try {
    const { token } = req.params;
    const { signatureDataUrl, memberData: memberDataPatch } = req.body;

    if (!signatureDataUrl || !signatureDataUrl.startsWith('data:image')) {
      return res.status(400).json({ error: 'signatureDataUrl (base64) required' });
    }

    const data = await getTokenData(token);
    if (!data) {
      return res.status(404).json({ 
        error: 'Token invalide ou expiré',
        code: 'INVALID_TOKEN'
      });
    }

    if (memberDataPatch && typeof memberDataPatch === 'object') {
      await updateMemberData(token, memberDataPatch);
    }

    // Métadonnées de signature
    const metadata = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    };

    const success = await saveSignature(token, signatureDataUrl, metadata);

    if (!success) {
      return res.status(500).json({ error: 'Failed to save signature' });
    }

    const signedData = await getTokenData(token);

    // Générer le document final avec la signature
    const templateId = 'adhesion_standard'; // TODO: Rendre configurable
    const memberData = signedData?.memberData || data.memberData;
    const timestamp = Date.now();
    const outputFilename = `bulletin_${memberData.lastName}_${timestamp}.docx`;

    let documentGenerated = false;
    let documentUrl = null;
    let adminEmailSent = false;
    let adminEmailError = null;

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

      await updateMemberData(token, {
        generatedDocumentUrl: documentUrl,
        generatedDocumentFilename: outputFilename,
        generatedDocumentAt: new Date().toISOString()
      });

      try {
        const generatedPath = path.join(process.cwd(), 'uploads', 'generated', outputFilename);
        const generatedBuffer = await fs.readFile(generatedPath);
        const apiBaseUrl = resolveRequestApiBaseUrl(req);
        const absoluteDownloadUrl = apiBaseUrl ? `${apiBaseUrl}${documentUrl}` : documentUrl;
        const mailSubject = `Bulletin signé - ${memberData.firstName || ''} ${memberData.lastName || ''}`.trim();
        const mailText = `Un bulletin vient d'être signé.\n\nAdhérent: ${memberData.firstName || ''} ${memberData.lastName || ''}\nEmail: ${memberData.email || 'non renseigné'}\nTéléchargement: ${absoluteDownloadUrl}`;
        const mailHtml = `
              <p>Un bulletin vient d'être signé.</p>
              <p><strong>Adhérent:</strong> ${memberData.firstName || ''} ${memberData.lastName || ''}</p>
              <p><strong>Email:</strong> ${memberData.email || 'non renseigné'}</p>
              <p><strong>Téléchargement:</strong> <a href="${absoluteDownloadUrl}">${absoluteDownloadUrl}</a></p>
            `;

        const senderUserId = await resolveNoreplySenderUserId();
        if (senderUserId) {
          await sendEmail(senderUserId, {
            to: [BULLETIN_ADMIN_EMAIL],
            subject: mailSubject,
            body: mailText,
            html: mailHtml,
            fromName: 'RetroBus Essonne',
            attachments: [
              {
                filename: outputFilename,
                content: generatedBuffer.toString('base64'),
                contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
              }
            ]
          });

          adminEmailSent = true;
          console.log(`✅ Bulletin signé envoyé automatiquement à ${BULLETIN_ADMIN_EMAIL} (session noreply)`);
        } else {
          console.warn('⚠️ Aucune session noreply active, tentative via fallback SMTP...');
          await sendAdminBulletinViaSmtpFallback({
            to: BULLETIN_ADMIN_EMAIL,
            subject: mailSubject,
            text: mailText,
            html: mailHtml,
            filename: outputFilename,
            buffer: generatedBuffer
          });
          adminEmailSent = true;
          console.log(`✅ Bulletin signé envoyé automatiquement à ${BULLETIN_ADMIN_EMAIL} (fallback SMTP)`);
        }
      } catch (mailError) {
        try {
          console.warn('⚠️ Envoi via session impossible, tentative fallback SMTP...');
          const generatedPath = path.join(process.cwd(), 'uploads', 'generated', outputFilename);
          const generatedBuffer = await fs.readFile(generatedPath);
          const apiBaseUrl = resolveRequestApiBaseUrl(req);
          const absoluteDownloadUrl = apiBaseUrl ? `${apiBaseUrl}${documentUrl}` : documentUrl;
          const mailSubject = `Bulletin signé - ${memberData.firstName || ''} ${memberData.lastName || ''}`.trim();
          const mailText = `Un bulletin vient d'être signé.\n\nAdhérent: ${memberData.firstName || ''} ${memberData.lastName || ''}\nEmail: ${memberData.email || 'non renseigné'}\nTéléchargement: ${absoluteDownloadUrl}`;
          const mailHtml = `
              <p>Un bulletin vient d'être signé.</p>
              <p><strong>Adhérent:</strong> ${memberData.firstName || ''} ${memberData.lastName || ''}</p>
              <p><strong>Email:</strong> ${memberData.email || 'non renseigné'}</p>
              <p><strong>Téléchargement:</strong> <a href="${absoluteDownloadUrl}">${absoluteDownloadUrl}</a></p>
            `;

          await sendAdminBulletinViaSmtpFallback({
            to: BULLETIN_ADMIN_EMAIL,
            subject: mailSubject,
            text: mailText,
            html: mailHtml,
            filename: outputFilename,
            buffer: generatedBuffer
          });
          adminEmailSent = true;
          adminEmailError = null;
          console.log(`✅ Bulletin signé envoyé automatiquement à ${BULLETIN_ADMIN_EMAIL} (fallback SMTP après échec session)`);
        } catch (fallbackError) {
          adminEmailError = `${mailError.message} | fallback: ${fallbackError.message}`;
          console.error('❌ Echec envoi bulletin signé à l\'adresse admin:', adminEmailError);
        }
      }

      console.log(`✅ Document généré avec signature: ${outputFilename}`);
    } catch (docError) {
      console.error('⚠️ Failed to generate document:', docError);
      // Ne pas bloquer si génération échoue
    }

    res.json({
      success: true,
      message: 'Signature enregistrée avec succès',
      status: 'signed',
      signedAt: signedData?.signedAt || new Date().toISOString(),
      documentGenerated,
      documentUrl,
      adminEmailSent,
      adminEmailError
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

    const data = await getTokenData(token);
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
 * POST /api/bulletin-flow/member/resend-signed - Renvoie le dernier bulletin signé d'un adhérent
 * Body: { memberId?, email, recipientEmail? }
 */
router.post('/member/resend-signed', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { memberId, email, recipientEmail } = req.body || {};
    const lookupMemberId = String(memberId || '').trim();
    const lookupEmail = String(email || '').trim().toLowerCase();
    const destinationEmail = String(recipientEmail || email || '').trim().toLowerCase();

    if (!lookupEmail && !lookupMemberId) {
      return res.status(400).json({ error: 'email or memberId is required' });
    }

    if (!destinationEmail) {
      return res.status(400).json({ error: 'recipientEmail is required' });
    }

    const signedFlows = await prisma.bulletinFlowToken.findMany({
      where: { status: 'signed' },
      orderBy: { signedAt: 'desc' },
      take: 500,
      select: {
        token: true,
        signedAt: true,
        signatureData: true,
        memberData: true
      }
    });

    const candidateFlows = signedFlows.filter((flow) => {
      const md = flow.memberData || {};
      const flowEmail = String(md.email || '').trim().toLowerCase();
      const flowMemberId = String(md.id || '').trim();
      const memberMatch = !!lookupMemberId && flowMemberId && flowMemberId === lookupMemberId;
      const emailMatch = !!lookupEmail && flowEmail === lookupEmail;
      return memberMatch || emailMatch;
    });

    let matchingFlow = null;
    let filename = '';
    let generatedBuffer = null;

    for (const flow of candidateFlows) {
      const md = flow.memberData || {};
      const existingFilename = String(md.generatedDocumentFilename || '').trim();

      if (existingFilename) {
        try {
          const generatedPath = path.join(process.cwd(), 'uploads', 'generated', existingFilename);
          generatedBuffer = await fs.readFile(generatedPath);
          filename = existingFilename;
          matchingFlow = flow;
          break;
        } catch {
          // Fichier annoncé mais absent: essayer régénération
        }
      }

      if (flow.signatureData) {
        const regeneratedFilename = `bulletin_${md.lastName || 'adherent'}_${Date.now()}_resend.docx`;
        const dataWithSignature = {
          ...md,
          signature: flow.signatureData,
          signedDate: flow.signedAt ? new Date(flow.signedAt).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR'),
          signedDateTime: flow.signedAt ? new Date(flow.signedAt).toLocaleString('fr-FR') : new Date().toLocaleString('fr-FR')
        };

        await generateDocument('adhesion_standard', dataWithSignature, regeneratedFilename);
        const regeneratedPath = path.join(process.cwd(), 'uploads', 'generated', regeneratedFilename);
        generatedBuffer = await fs.readFile(regeneratedPath);
        filename = regeneratedFilename;
        matchingFlow = flow;

        await updateMemberData(flow.token, {
          generatedDocumentFilename: regeneratedFilename,
          generatedDocumentUrl: `/api/templates/download/${regeneratedFilename}`,
          generatedDocumentAt: new Date().toISOString()
        });
        break;
      }
    }

    if (!matchingFlow) {
      return res.status(404).json({ error: 'Aucun bulletin signé trouvé pour cet adhérent' });
    }

    const flowMemberData = matchingFlow.memberData || {};

    const subject = `Bulletin signé - ${flowMemberData.firstName || ''} ${flowMemberData.lastName || ''}`.trim();
    const text = `Bonjour,\n\nVeuillez trouver en pièce jointe le bulletin signé de ${flowMemberData.firstName || ''} ${flowMemberData.lastName || ''}.`;
    const html = `<p>Bonjour,</p><p>Veuillez trouver en pièce jointe le bulletin signé de <strong>${flowMemberData.firstName || ''} ${flowMemberData.lastName || ''}</strong>.</p>`;

    const senderUserId = await resolveNoreplySenderUserId();
    let sentVia = 'smtp_fallback';

    if (senderUserId) {
      await sendEmail(senderUserId, {
        to: [destinationEmail],
        subject,
        body: text,
        html,
        fromName: 'RetroBus Essonne',
        attachments: [
          {
            filename,
            content: generatedBuffer.toString('base64'),
            contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          }
        ]
      });
      sentVia = 'noreply_session';
    } else {
      await sendAdminBulletinViaSmtpFallback({
        to: destinationEmail,
        subject,
        text,
        html,
        filename,
        buffer: generatedBuffer
      });
    }

    res.json({
      success: true,
      sentTo: destinationEmail,
      sentVia,
      filename,
      signedAt: matchingFlow.signedAt
    });
  } catch (error) {
    const details = formatErrorDetails(error);
    console.error('❌ Error resending signed bulletin:', details);
    res.status(500).json({
      error: error?.message || 'Failed to resend signed bulletin',
      details
    });
  }
});

/**
 * GET /api/bulletin-flow/stats - Statistiques des parcours de signature
 */
router.get('/stats/all', async (req, res) => {
  try {
    const stats = await getSignatureStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('❌ Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats', details: error.message });
  }
});

/**
 * POST /api/bulletin-flow/cleanup - Nettoie les tokens expirés (admin)
 */
router.post('/cleanup', async (req, res) => {
  try {
    const cleaned = await cleanupExpiredTokens();
    res.json({ success: true, cleaned });
  } catch (error) {
    console.error('❌ Error cleaning up:', error);
    res.status(500).json({ error: 'Failed to cleanup', details: error.message });
  }
});

// Nettoyage automatique toutes les 6 heures
setInterval(() => {
  cleanupExpiredTokens().catch((error) => {
    console.error('❌ Error during scheduled bulletin-flow cleanup:', error);
  });
}, 6 * 60 * 60 * 1000);

export default router;
