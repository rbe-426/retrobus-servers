/**
 * Service de gestion des templates de documents
 * Permet de gérer des modèles Word et de les pré-remplir avec des données d'adhérents
 * 
 * Fonctionnalités :
 * - Upload de templates Word (.docx)
 * - Remplacement de variables {{variable}} dans les templates
 * - Génération de documents personnalisés
 * - Envoi par email/SMS avec lien de téléchargement
 */

import fs from 'fs/promises';
import path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

// Dossier de stockage des templates
const TEMPLATES_DIR = path.join(process.cwd(), 'uploads', 'templates');
const GENERATED_DIR = path.join(process.cwd(), 'uploads', 'generated');

/**
 * Initialiser les dossiers de templates
 */
export const initTemplatesDirectories = async () => {
  try {
    await fs.mkdir(TEMPLATES_DIR, { recursive: true });
    await fs.mkdir(GENERATED_DIR, { recursive: true });
    console.log('✅ Templates directories initialized');
  } catch (error) {
    console.error('❌ Error initializing templates directories:', error);
  }
};

/**
 * Liste tous les templates disponibles
 * @returns {Promise<Array>} Liste des templates avec métadonnées
 */
export const listTemplates = async () => {
  try {
    const files = await fs.readdir(TEMPLATES_DIR);
    const templates = [];

    for (const file of files) {
      if (file.endsWith('.docx') || file.endsWith('.json')) {
        const stats = await fs.stat(path.join(TEMPLATES_DIR, file));
        
        // Si c'est un fichier .docx, chercher son .json de métadonnées
        if (file.endsWith('.docx')) {
          const metaFile = file.replace('.docx', '.json');
          let metadata = {
            id: file.replace('.docx', ''),
            name: file,
            type: 'adhesion',
            description: 'Template Word',
            createdAt: stats.birthtime,
            size: stats.size
          };

          try {
            const metaPath = path.join(TEMPLATES_DIR, metaFile);
            const metaContent = await fs.readFile(metaPath, 'utf-8');
            metadata = { ...metadata, ...JSON.parse(metaContent) };
          } catch {}

          templates.push(metadata);
        }
      }
    }

    return templates;
  } catch (error) {
    console.error('❌ Error listing templates:', error);
    return [];
  }
};

/**
 * Sauvegarde un template uploadé
 * @param {string} templateId - ID unique du template
 * @param {Buffer} fileBuffer - Contenu du fichier
 * @param {object} metadata - Métadonnées du template
 * @returns {Promise<object>} Template créé
 */
export const saveTemplate = async (templateId, fileBuffer, metadata = {}) => {
  try {
    const templatePath = path.join(TEMPLATES_DIR, `${templateId}.docx`);
    await fs.writeFile(templatePath, fileBuffer);

    // Sauvegarder les métadonnées
    const metaPath = path.join(TEMPLATES_DIR, `${templateId}.json`);
    const metaData = {
      id: templateId,
      name: metadata.name || `${templateId}.docx`,
      type: metadata.type || 'adhesion',
      description: metadata.description || '',
      variables: metadata.variables || [],
      createdAt: new Date().toISOString(),
      size: fileBuffer.length
    };
    await fs.writeFile(metaPath, JSON.stringify(metaData, null, 2));

    console.log(`✅ Template saved: ${templateId}`);
    return metaData;
  } catch (error) {
    console.error('❌ Error saving template:', error);
    throw error;
  }
};

/**
 * Génère un document à partir d'un template
 * @param {string} templateId - ID du template
 * @param {object} data - Données pour remplir le template
 * @param {string} outputFilename - Nom du fichier généré
 * @returns {Promise<string>} Chemin du fichier généré
 */
export const generateDocument = async (templateId, data, outputFilename) => {
  try {
    // Lire le template
    const templatePath = path.join(TEMPLATES_DIR, `${templateId}.docx`);
    const content = await fs.readFile(templatePath, 'binary');

    // Charger avec PizZip
    const zip = new PizZip(content);
    
    // Créer l'instance Docxtemplater
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '' // Remplacer les variables undefined par ''
    });

    // Formater les données
    const formattedData = formatDataForTemplate(data);

    // Remplir le template
    doc.render(formattedData);

    // Générer le buffer du document
    const buffer = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE'
    });

    // Sauvegarder le document généré
    const outputPath = path.join(GENERATED_DIR, outputFilename);
    await fs.writeFile(outputPath, buffer);

    console.log(`✅ Document generated: ${outputFilename}`);
    return outputPath;
  } catch (error) {
    console.error('❌ Error generating document:', error);
    throw error;
  }
};

/**
 * Formate les données d'un adhérent pour le template
 * @param {object} data - Données brutes
 * @returns {object} Données formatées
 */
const formatDataForTemplate = (data) => {
  const formatted = {
    // Informations personnelles
    firstName: data.firstName || '',
    lastName: data.lastName || '',
    fullName: `${data.firstName || ''} ${data.lastName || ''}`.trim(),
    email: data.email || '',
    phone: data.phone || '',
    birthDate: data.birthDate ? new Date(data.birthDate).toLocaleDateString('fr-FR') : '',
    
    // Adresse
    address: data.address || '',
    city: data.city || '',
    postalCode: data.postalCode || '',
    fullAddress: [data.address, `${data.postalCode} ${data.city}`].filter(Boolean).join(', '),
    
    // Identifiants
    matricule: data.matricule || '',
    memberNumber: data.memberNumber || '',
    
    // Adhésion
    membershipType: data.membershipType || 'STANDARD',
    membershipStatus: data.membershipStatus || 'ACTIVE',
    membershipStartDate: data.membershipStartDate ? new Date(data.membershipStartDate).toLocaleDateString('fr-FR') : '',
    membershipEndDate: data.membershipEndDate ? new Date(data.membershipEndDate).toLocaleDateString('fr-FR') : '',
    
    // Paiement
    paymentAmount: data.paymentAmount || '0',
    paymentMethod: data.paymentMethod || '',
    isExempted: data.isExempted ? 'Oui' : 'Non',
    exemptionReason: data.exemptionReason || '',
    
    // Stage (si applicable)
    internshipStartDate: data.internshipStartDate ? new Date(data.internshipStartDate).toLocaleDateString('fr-FR') : '',
    internshipEndDate: data.internshipEndDate ? new Date(data.internshipEndDate).toLocaleDateString('fr-FR') : '',
    internshipType: data.internshipType || '',
    supervisor: data.supervisor || '',
    
    // Dates système
    today: new Date().toLocaleDateString('fr-FR'),
    currentYear: new Date().getFullYear(),
    
    // Association (à personnaliser)
    associationName: 'RETROBUS ESSONNE',
    associationAddress: '2 Rue du Petit Pont, 91100 Corbeil-Essonnes',
    associationEmail: 'contact@retrobus-essonne.fr',
    associationPhone: '07 60 82 11 62'
  };

  return formatted;
};

/**
 * Supprime un template
 * @param {string} templateId - ID du template à supprimer
 * @returns {Promise<boolean>} True si supprimé
 */
export const deleteTemplate = async (templateId) => {
  try {
    const templatePath = path.join(TEMPLATES_DIR, `${templateId}.docx`);
    const metaPath = path.join(TEMPLATES_DIR, `${templateId}.json`);
    
    await fs.unlink(templatePath).catch(() => {});
    await fs.unlink(metaPath).catch(() => {});
    
    console.log(`✅ Template deleted: ${templateId}`);
    return true;
  } catch (error) {
    console.error('❌ Error deleting template:', error);
    return false;
  }
};

/**
 * Variables disponibles pour les templates
 * @returns {object} Liste des variables avec descriptions
 */
export const getAvailableVariables = () => {
  return {
    // Informations personnelles
    firstName: 'Prénom',
    lastName: 'Nom',
    fullName: 'Nom complet (Prénom + Nom)',
    email: 'Adresse email',
    phone: 'Numéro de téléphone',
    birthDate: 'Date de naissance (format JJ/MM/AAAA)',
    
    // Adresse
    address: 'Adresse',
    city: 'Ville',
    postalCode: 'Code postal',
    fullAddress: 'Adresse complète',
    
    // Identifiants
    matricule: 'Matricule',
    memberNumber: 'Numéro d\'adhérent',
    
    // Adhésion
    membershipType: 'Type d\'adhésion',
    membershipStatus: 'Statut d\'adhésion',
    membershipStartDate: 'Date de début d\'adhésion',
    membershipEndDate: 'Date de fin d\'adhésion',
    
    // Paiement
    paymentAmount: 'Montant cotisation',
    paymentMethod: 'Mode de paiement',
    isExempted: 'Exonération (Oui/Non)',
    exemptionReason: 'Motif d\'exonération',
    
    // Stage
    internshipStartDate: 'Date de début de stage',
    internshipEndDate: 'Date de fin de stage',
    internshipType: 'Type de stage',
    supervisor: 'Tuteur/Responsable',
    
    // Dates système
    today: 'Date du jour',
    currentYear: 'Année en cours',
    
    // Association
    associationName: 'Nom de l\'association',
    associationAddress: 'Adresse de l\'association',
    associationEmail: 'Email de l\'association',
    associationPhone: 'Téléphone de l\'association'
  };
};
