/**
 * notificationService.js
 * Service for sending automated email notifications using templates
 */

import { PrismaClient } from '@prisma/client';
import { sendEmail, getMailSession } from './mailService.js';

const prisma = new PrismaClient();

/**
 * Configuration for noreply account
 * This should be set when the noreply account is connected
 */
let noreplyUserId = null;

/**
 * Set the user ID for noreply account
 * Call this when noreply@association-rbe.fr is connected
 */
export function setNoreplyUserId(userId) {
  noreplyUserId = userId;
  console.log(`✅ NoReply user ID configured: ${userId}`);
}

/**
 * Get the noreply user ID (for checking if connected)
 */
export function getNoreplyUserId() {
  return noreplyUserId;
}

/**
 * Send an automated email using a template
 * @param {string} templateName - Name of the template to use
 * @param {string} recipientEmail - Email address to send to
 * @param {object} data - Data to replace variables in the template
 * @param {string} fromName - Display name for sender (default: 'RétroBus Essonne')
 * @returns {Promise<boolean>} - True if sent successfully
 */
export async function sendTemplatedEmail(templateName, recipientEmail, data = {}, fromName = 'RétroBus Essonne') {
  try {
    // Check if noreply account is connected
    if (!noreplyUserId) {
      console.warn('⚠️ NoReply account not connected, email notification skipped');
      return false;
    }
    
    // Verify session exists
    const session = getMailSession(noreplyUserId);
    if (!session) {
      console.warn('⚠️ NoReply session not found, email notification skipped');
      return false;
    }
    
    // Fetch template
    const template = await prisma.emailTemplate.findUnique({
      where: { name: templateName }
    });
    
    if (!template) {
      console.error(`❌ Template not found: ${templateName}`);
      return false;
    }
    
    if (!template.active) {
      console.warn(`⚠️ Template is not active: ${templateName}`);
      return false;
    }
    
    // Replace variables
    const subject = replaceVariables(template.subject, data);
    const body = replaceVariables(template.body, data);

    // If the template body is already HTML, keep it as-is.
    const htmlTemplate = isHtmlLike(body);
    const html = htmlTemplate ? body : convertTextToHtml(body, data);
    const textBody = htmlTemplate ? htmlToText(body) : body;
    
    // Send email
    await sendEmail(noreplyUserId, {
      to: recipientEmail,
      subject,
      body: textBody,
      html,
      fromName
    });
    
    console.log(`✅ Automated email sent: ${templateName} to ${recipientEmail}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send templated email (${templateName}):`, error.message);
    return false;
  }
}

export async function sendRetromailPasswordResetEmail(recipientEmail, member, temporaryPassword) {
  try {
    if (!noreplyUserId) {
      console.warn('⚠️ NoReply account not connected, RétroMail reset email not sent');
      return false;
    }

    const mailbox = `${member.matricule}@association-rbe.fr`;
    const firstName = String(member.firstName || '').trim();
    const text = [
      `Bonjour ${firstName},`,
      '',
      'Votre mot de passe RétroMail a été réinitialisé par l’administration.',
      `Boîte RétroMail : ${mailbox}`,
      `Mot de passe provisoire : ${temporaryPassword}`,
      '',
      'Connectez-vous à RétroMail avec ce mot de passe provisoire. Vous devrez immédiatement choisir votre nouveau mot de passe.',
      '',
      'RétroBus Essonne'
    ].join('\n');

    await sendEmail(noreplyUserId, {
      to: recipientEmail,
      subject: 'RétroMail - Réinitialisation de votre mot de passe',
      body: text,
      html: convertTextToHtml(text),
      fromName: 'RétroBus Essonne - RétroMail'
    });
    return true;
  } catch (error) {
    console.error('❌ Failed to send RétroMail password reset email:', error.message);
    return false;
  }
}

/**
 * Helper function to replace variables in text
 * Supports {{variable}} and {{object.property}} syntax
 */
function replaceVariables(text, data) {
  return text.replace(/\{\{([^}]+)\}\}/g, (match, varPath) => {
    const parts = varPath.trim().split('.');
    let value = data;
    
    for (const part of parts) {
      value = value?.[part];
    }
    
    return value !== undefined && value !== null ? String(value) : match;
  });
}

function isHtmlLike(content = '') {
  const sample = String(content || '').trim();
  return /<html|<body|<table|<div|<!doctype html/i.test(sample);
}

function htmlToText(html = '') {
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Helper function to convert plain text to styled HTML
 * Adds RétroBus branding and formatting
 */
function convertTextToHtml(text, data = {}) {
  const lines = text.split('\n');
  let html = '<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">';
  
  // RétroBus Essonne header with logo
  html += '<div style="text-align: center; margin-bottom: 30px; padding: 25px; background: linear-gradient(135deg, #d30c4c 0%, #9a0a38 100%); border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">';
  html += '<h1 style="color: white; margin: 0; font-size: 32px; font-weight: bold; text-shadow: 2px 2px 4px rgba(0,0,0,0.2);">🚌 RétroBus Essonne</h1>';
  html += '<p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">Association de préservation du patrimoine routier</p>';
  html += '</div>';
  
  // Content with styling
  html += '<div style="background: #ffffff; padding: 30px; border-radius: 10px; border-left: 4px solid #d30c4c; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">';
  
  for (const line of lines) {
    if (line.trim() === '') {
      html += '<br>';
    } else if (line.startsWith('# ')) {
      html += '<h2 style="color: #d30c4c; margin-top: 20px; margin-bottom: 15px; font-size: 24px; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;">' + line.substring(2) + '</h2>';
    } else if (line.startsWith('## ')) {
      html += '<h3 style="color: #333; margin-top: 15px; margin-bottom: 10px; font-size: 18px;">' + line.substring(3) + '</h3>';
    } else if (line.startsWith('- ')) {
      html += '<p style="margin: 8px 0; padding-left: 20px; color: #555;">• ' + line.substring(2) + '</p>';
    } else if (line.startsWith('**') && line.endsWith('**')) {
      html += '<p style="margin: 15px 0; padding: 15px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 5px; font-weight: bold; color: #856404;">' + line.replace(/\*\*/g, '') + '</p>';
    } else if (line.startsWith('---')) {
      html += '<hr style="border: none; border-top: 2px solid #e0e0e0; margin: 25px 0;">';
    } else {
      html += '<p style="margin: 12px 0; color: #444; line-height: 1.7;">' + line + '</p>';
    }
  }
  
  html += '</div>';
  
  // Action button (if link is provided in data)
  if (data.actionLink && data.actionText) {
    html += '<div style="text-align: center; margin: 30px 0;">';
    html += `<a href="${data.actionLink}" style="display: inline-block; padding: 15px 40px; background: #d30c4c; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 8px rgba(211, 12, 76, 0.3); transition: all 0.3s;">${data.actionText}</a>`;
    html += '</div>';
  }
  
  // Footer
  html += '<div style="margin-top: 40px; padding-top: 25px; border-top: 2px solid #f0f0f0; text-align: center; color: #777; font-size: 13px;">';
  html += '<p style="margin: 5px 0; font-weight: bold; color: #555;">RétroBus Essonne</p>';
  html += '<p style="margin: 5px 0;">Association loi 1901 - Préservation du patrimoine routier</p>';
  html += '<p style="margin: 10px 0;">📧 <a href="mailto:contact@association-rbe.fr" style="color: #d30c4c; text-decoration: none;">contact@association-rbe.fr</a> | 🌐 <a href="https://www.association-rbe.fr" style="color: #d30c4c; text-decoration: none;">www.association-rbe.fr</a></p>';
  html += '<p style="margin: 15px 0 5px 0; font-size: 11px; color: #999; font-style: italic;">Cet email a été envoyé automatiquement, merci de ne pas répondre directement.</p>';
  html += '<p style="margin: 5px 0; font-size: 11px; color: #999;">Pour toute question, contactez-nous via notre site web ou notre adresse email.</p>';
  html += '</div>';
  
  html += '</div>';
  
  return html;
}

/**
 * Pre-defined notification functions for common events
 */

/**
 * Send expense report confirmation email
 * @param {object} expense - Expense report data
 * @param {object} member - Member who submitted the expense
 */
export async function sendExpenseReportNotification(expense, member) {
  return sendTemplatedEmail(
    'expense_report_submitted',
    member.email,
    {
      member: {
        name: `${member.prenom} ${member.nom}`,
        firstName: member.prenom,
        lastName: member.nom
      },
      expense: {
        id: expense.id,
        amount: expense.montant?.toFixed(2) + ' €',
        description: expense.description || 'Note de frais',
        date: new Date(expense.date).toLocaleDateString('fr-FR'),
        status: expense.statut || 'EN_ATTENTE'
      },
      actionLink: `https://www.retrobus-interne.fr/admin/finance`,
      actionText: 'Voir mes notes de frais'
    },
    'RétroBus Essonne'
  );
}

/**
 * Send vehicle reservation confirmation
 * @param {object} reservation - Reservation data
 * @param {object} member - Member who made the reservation
 * @param {object} vehicle - Vehicle data
 */
export async function sendVehicleReservationNotification(reservation, member, vehicle) {
  return sendTemplatedEmail(
    'vehicle_reservation_confirmed',
    member.email,
    {
      member: {
        name: `${member.prenom} ${member.nom}`
      },
      vehicle: {
        name: vehicle.nom || vehicle.parc,
        plate: vehicle.immatriculation
      },
      reservation: {
        date: new Date(reservation.date).toLocaleDateString('fr-FR'),
        startTime: reservation.startTime,
        endTime: reservation.endTime
      },
      actionLink: `https://www.retrobus-interne.fr/admin/reservations`,
      actionText: 'Voir ma réservation'
    }
  );
}

/**
 * Send event invitation
 * @param {object} event - Event data
 * @param {object} member - Member to invite
 */
export async function sendEventInvitationNotification(event, member) {
  return sendTemplatedEmail(
    'event_invitation',
    member.email,
    {
      member: {
        name: `${member.prenom} ${member.nom}`
      },
      event: {
        name: event.title,
        date: new Date(event.date).toLocaleDateString('fr-FR'),
        location: event.location || 'À définir',
        description: event.description || ''
      },
      actionLink: event.helloAssoUrl || `https://www.retrobus-interne.fr/events/${event.id}`,
      actionText: 'Voir l\'événement'
    }
  );
}

/**
 * Send membership renewal reminder
 * @param {object} member - Member data
 */
export async function sendMembershipRenewalNotification(member) {
  return sendTemplatedEmail(
    'membership_renewal_reminder',
    member.email,
    {
      member: {
        name: `${member.prenom} ${member.nom}`,
        number: member.numero_adherent,
        type: member.type_adhesion || 'Standard'
      },
      membership: {
        expiry: member.date_fin_adhesion ? new Date(member.date_fin_adhesion).toLocaleDateString('fr-FR') : 'Non définie'
      },
      actionLink: `https://www.association-rbe.fr/adhesion`,
      actionText: 'Renouveler mon adhésion'
    }
  );
}

/**
 * Send welcome email to new member
 * @param {object} member - New member data
 */
export async function sendWelcomeNotification(member) {
  return sendTemplatedEmail(
    'member_welcome',
    member.email,
    {
      member: {
        name: `${member.prenom} ${member.nom}`,
        firstName: member.prenom,
        number: member.numero_adherent
      },
      actionLink: `https://www.retrobus-interne.fr`,
      actionText: 'Accéder à mon espace'
    }
  );
}

export default {
  sendTemplatedEmail,
  sendRetromailPasswordResetEmail,
  sendExpenseReportNotification,
  sendVehicleReservationNotification,
  sendEventInvitationNotification,
  sendMembershipRenewalNotification,
  sendWelcomeNotification,
  setNoreplyUserId,
  getNoreplyUserId
};
