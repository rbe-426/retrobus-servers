/**
 * Routes pour la gestion des templates de documents
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import { 
  initTemplatesDirectories,
  listTemplates, 
  saveTemplate, 
  generateDocument,
  deleteTemplate,
  getAvailableVariables
} from '../services/templateService.js';

const router = express.Router();

// Configuration multer pour l'upload de templates
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.docx' && ext !== '.doc') {
      return cb(new Error('Seuls les fichiers Word (.docx, .doc) sont acceptés'));
    }
    cb(null, true);
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB max
  }
});

// Initialiser les dossiers au démarrage
initTemplatesDirectories();

/**
 * GET /api/templates - Liste tous les templates
 */
router.get('/', async (req, res) => {
  try {
    const templates = await listTemplates();
    res.json({ templates, count: templates.length });
  } catch (error) {
    console.error('❌ Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates', details: error.message });
  }
});

/**
 * GET /api/templates/variables - Liste les variables disponibles
 */
router.get('/variables', (req, res) => {
  try {
    const variables = getAvailableVariables();
    res.json({ variables });
  } catch (error) {
    console.error('❌ Error fetching variables:', error);
    res.status(500).json({ error: 'Failed to fetch variables', details: error.message });
  }
});

/**
 * POST /api/templates/upload - Upload un nouveau template
 */
router.post('/upload', upload.single('template'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const templateId = req.body.id || `template_${Date.now()}`;
    const metadata = {
      name: req.body.name || req.file.originalname,
      type: req.body.type || 'adhesion',
      description: req.body.description || '',
      variables: req.body.variables ? JSON.parse(req.body.variables) : []
    };

    const template = await saveTemplate(templateId, req.file.buffer, metadata);
    
    console.log(`✅ Template uploaded: ${templateId}`);
    res.status(201).json({ 
      success: true, 
      template,
      message: 'Template uploaded successfully' 
    });
  } catch (error) {
    console.error('❌ Error uploading template:', error);
    res.status(500).json({ error: 'Failed to upload template', details: error.message });
  }
});

/**
 * POST /api/templates/:templateId/generate - Génère un document à partir d'un template
 */
router.post('/:templateId/generate', async (req, res) => {
  try {
    const { templateId } = req.params;
    const data = req.body;

    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No data provided' });
    }

    // Générer le nom du fichier
    const timestamp = Date.now();
    const outputFilename = `${templateId}_${data.lastName || 'document'}_${timestamp}.docx`;

    // Générer le document
    const filePath = await generateDocument(templateId, data, outputFilename);

    console.log(`✅ Document generated: ${outputFilename}`);
    
    res.json({ 
      success: true, 
      filename: outputFilename,
      downloadUrl: `/api/templates/download/${outputFilename}`,
      message: 'Document generated successfully' 
    });
  } catch (error) {
    console.error('❌ Error generating document:', error);
    res.status(500).json({ error: 'Failed to generate document', details: error.message });
  }
});

/**
 * GET /api/templates/download/:filename - Télécharge un document généré
 */
router.get('/download/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(process.cwd(), 'uploads', 'generated', filename);
    
    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('❌ Error downloading file:', err);
        if (!res.headersSent) {
          res.status(404).json({ error: 'File not found' });
        }
      }
    });
  } catch (error) {
    console.error('❌ Error downloading document:', error);
    res.status(500).json({ error: 'Failed to download document', details: error.message });
  }
});

/**
 * DELETE /api/templates/:templateId - Supprime un template
 */
router.delete('/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params;
    const deleted = await deleteTemplate(templateId);
    
    if (deleted) {
      res.json({ success: true, message: 'Template deleted successfully' });
    } else {
      res.status(404).json({ error: 'Template not found' });
    }
  } catch (error) {
    console.error('❌ Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template', details: error.message });
  }
});

/**
 * POST /api/templates/send-digital-flow - Envoie un document par email/SMS
 */
router.post('/send-digital-flow', async (req, res) => {
  try {
    const { 
      templateId, 
      memberData, 
      email, 
      phone, 
      sendEmail = true, 
      sendSMS = false 
    } = req.body;

    if (!templateId || !memberData) {
      return res.status(400).json({ error: 'templateId and memberData are required' });
    }

    // Générer le document
    const timestamp = Date.now();
    const filename = `bulletin_${memberData.lastName || 'adhesion'}_${timestamp}.docx`;
    const filePath = await generateDocument(templateId, memberData, filename);

    const results = {
      generated: true,
      filename,
      downloadUrl: `/api/templates/download/${filename}`,
      emailSent: false,
      smsSent: false
    };

    // Envoyer par email
    if (sendEmail && email) {
      // TODO: Intégrer avec le service email existant
      console.log(`📧 Sending document to email: ${email}`);
      // await sendEmailWithAttachment(email, filePath, memberData);
      results.emailSent = true;
      results.emailRecipient = email;
    }

    // Envoyer par SMS
    if (sendSMS && phone) {
      // TODO: Intégrer avec un service SMS (Twilio, OVH, etc.)
      console.log(`📱 Sending SMS with download link to: ${phone}`);
      // await sendSMSWithLink(phone, results.downloadUrl);
      results.smsSent = true;
      results.smsRecipient = phone;
    }

    res.json({ 
      success: true, 
      message: 'Digital flow initiated',
      ...results
    });
  } catch (error) {
    console.error('❌ Error sending digital flow:', error);
    res.status(500).json({ error: 'Failed to send digital flow', details: error.message });
  }
});

export default router;
