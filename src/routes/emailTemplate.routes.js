/**
 * emailTemplate.routes.js
 * Routes for email template management and sending automated emails
 */

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { sendEmail } from '../services/mailService.js';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/email-templates
 * Get all email templates
 */
router.get('/', async (req, res) => {
  try {
    const templates = await prisma.emailTemplate.findMany({
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ]
    });
    
    res.json({ templates });
  } catch (error) {
    console.error('❌ Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates', details: error.message });
  }
});

/**
 * GET /api/email-templates/:id
 * Get a specific template by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const template = await prisma.emailTemplate.findUnique({
      where: { id }
    });
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json(template);
  } catch (error) {
    console.error('❌ Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template', details: error.message });
  }
});

/**
 * POST /api/email-templates
 * Create a new email template
 */
router.post('/', async (req, res) => {
  try {
    const { name, subject, body, description, variables, category, active } = req.body;
    
    // Validate required fields
    if (!name || !subject || !body) {
      return res.status(400).json({ error: 'Name, subject, and body are required' });
    }
    
    // Check if template with this name already exists
    const existing = await prisma.emailTemplate.findUnique({
      where: { name }
    });
    
    if (existing) {
      return res.status(400).json({ error: 'Template with this name already exists' });
    }
    
    // Create template
    const template = await prisma.emailTemplate.create({
      data: {
        name,
        subject,
        body,
        description: description || null,
        variables: variables || null,
        category: category || 'CUSTOM',
        active: active !== undefined ? active : true
      }
    });
    
    console.log(`✅ Email template created: ${name}`);
    res.status(201).json(template);
  } catch (error) {
    console.error('❌ Error creating template:', error);
    res.status(500).json({ error: 'Failed to create template', details: error.message });
  }
});

/**
 * PUT /api/email-templates/:id
 * Update an existing email template
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { subject, body, description, variables, category, active } = req.body;
    
    // Check if template exists
    const existing = await prisma.emailTemplate.findUnique({
      where: { id }
    });
    
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    // Update template (name cannot be changed)
    const template = await prisma.emailTemplate.update({
      where: { id },
      data: {
        subject: subject !== undefined ? subject : existing.subject,
        body: body !== undefined ? body : existing.body,
        description: description !== undefined ? description : existing.description,
        variables: variables !== undefined ? variables : existing.variables,
        category: category !== undefined ? category : existing.category,
        active: active !== undefined ? active : existing.active
      }
    });
    
    console.log(`✅ Email template updated: ${template.name}`);
    res.json(template);
  } catch (error) {
    console.error('❌ Error updating template:', error);
    res.status(500).json({ error: 'Failed to update template', details: error.message });
  }
});

/**
 * DELETE /api/email-templates/:id
 * Delete an email template
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if template exists
    const existing = await prisma.emailTemplate.findUnique({
      where: { id }
    });
    
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    await prisma.emailTemplate.delete({
      where: { id }
    });
    
    console.log(`✅ Email template deleted: ${existing.name}`);
    res.json({ ok: true });
  } catch (error) {
    console.error('❌ Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template', details: error.message });
  }
});

/**
 * POST /api/email-templates/preview/:name
 * Preview a template with test data
 */
router.post('/preview/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const data = req.body;
    
    // Fetch template
    const template = await prisma.emailTemplate.findUnique({
      where: { name }
    });
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    // Replace variables in subject and body
    const preview = {
      subject: replaceVariables(template.subject, data),
      body: replaceVariables(template.body, data)
    };
    
    res.json({ preview });
  } catch (error) {
    console.error('❌ Error previewing template:', error);
    res.status(500).json({ error: 'Failed to preview template', details: error.message });
  }
});

/**
 * POST /api/email-templates/send
 * Send an automated email using a template
 * Body: { templateName, recipientEmail, data, fromName }
 */
router.post('/send', async (req, res) => {
  try {
    const { templateName, recipientEmail, data, fromName } = req.body;
    
    if (!templateName || !recipientEmail) {
      return res.status(400).json({ error: 'Template name and recipient email are required' });
    }
    
    // Fetch template
    const template = await prisma.emailTemplate.findUnique({
      where: { name: templateName }
    });
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    if (!template.active) {
      return res.status(400).json({ error: 'Template is not active' });
    }
    
    // Replace variables
    const subject = replaceVariables(template.subject, data || {});
    const body = replaceVariables(template.body, data || {});
    
    // Convert to HTML for better formatting
    const html = convertTextToHtml(body);
    
    // Send email using noreply account (requires user to be connected)
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    await sendEmail(userId, {
      to: recipientEmail,
      subject,
      body,
      html,
      fromName: fromName || 'RétroBus Essonne'
    });
    
    console.log(`✅ Automated email sent: ${templateName} to ${recipientEmail}`);
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('❌ Error sending automated email:', error);
    res.status(500).json({ error: 'Failed to send email', details: error.message });
  }
});

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

/**
 * Helper function to convert plain text to basic HTML
 * Adds styling and formatting for better email display
 */
function convertTextToHtml(text) {
  const lines = text.split('\n');
  let html = '<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333; padding: 20px;">';
  
  // RétroBus Essonne header
  html += '<div style="text-align: center; margin-bottom: 30px; padding: 20px; background: linear-gradient(135deg, #d30c4c 0%, #9a0a38 100%); border-radius: 10px;">';
  html += '<h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">🚌 RétroBus Essonne</h1>';
  html += '</div>';
  
  // Content
  html += '<div style="background: #f9f9f9; padding: 25px; border-radius: 10px; border-left: 4px solid #d30c4c;">';
  
  for (const line of lines) {
    if (line.trim() === '') {
      html += '<br>';
    } else if (line.startsWith('# ')) {
      html += '<h2 style="color: #d30c4c; margin-top: 20px; margin-bottom: 10px;">' + line.substring(2) + '</h2>';
    } else if (line.startsWith('## ')) {
      html += '<h3 style="color: #333; margin-top: 15px; margin-bottom: 8px;">' + line.substring(3) + '</h3>';
    } else if (line.startsWith('- ')) {
      html += '<p style="margin: 5px 0; padding-left: 20px;">• ' + line.substring(2) + '</p>';
    } else if (line.startsWith('---')) {
      html += '<hr style="border: none; border-top: 2px solid #ddd; margin: 20px 0;">';
    } else {
      html += '<p style="margin: 10px 0;">' + line + '</p>';
    }
  }
  
  html += '</div>';
  
  // Footer
  html += '<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 12px;">';
  html += '<p>RétroBus Essonne - Association loi 1901</p>';
  html += '<p>📧 <a href="mailto:contact@association-rbe.fr" style="color: #d30c4c;">contact@association-rbe.fr</a></p>';
  html += '<p style="margin-top: 10px; font-size: 11px; color: #999;">Cet email a été envoyé automatiquement, merci de ne pas répondre.</p>';
  html += '</div>';
  
  html += '</div>';
  
  return html;
}

export default router;
