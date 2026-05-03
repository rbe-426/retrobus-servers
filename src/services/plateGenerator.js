/**
 * Service de génération d'images de plaques d'immatriculation françaises
 * Génère des SVG dynamiques avec l'immatriculation injectée
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ASSETS_PATH = path.join(__dirname, '../../assets');

/**
 * Génère un SVG de plaque d'immatriculation française moderne
 * @param {string} immat - Numéro d'immatriculation (ex: "FG-920-RE")
 * @param {string} dept - Département (ex: "91")
 * @param {string} region - Région (ex: "IDF")
 * @returns {string} SVG complet
 */
export function generatePlateSVG(immat = "FG-920-RE", dept = "91", region = "IDF") {
  // Formater l'immatriculation avec espaces (FG 920 RE)
  let plateText = immat.toUpperCase().replace(/[-\s]/g, '');
  
  // Format FIV standard (AA123BB) → AA 123 BB
  if (/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(plateText)) {
    plateText = `${plateText.substring(0, 2)} ${plateText.substring(2, 5)} ${plateText.substring(5, 7)}`;
  } 
  // Format ancien (1234AB75) → 1234 AB 75
  else if (/^\d+[A-Z]+\d*$/.test(plateText)) {
    const match = plateText.match(/^(\d+)([A-Z]+)(\d*)$/);
    if (match) {
      plateText = match[3] ? `${match[1]} ${match[2]} ${match[3]}` : `${match[1]} ${match[2]}`;
    }
  }
  
  return `
  <svg viewBox="0 0 520 110" xmlns="http://www.w3.org/2000/svg">

    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="100%" stop-color="#f2f2f2"/>
      </linearGradient>

      <filter id="shadow">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.25"/>
      </filter>
    </defs>

    <!-- Fond -->
    <rect width="520" height="110" rx="12"
          fill="url(#bg)" stroke="#000" stroke-width="3"
          filter="url(#shadow)"/>

    <!-- Bande gauche -->
    <rect width="55" height="110" fill="#003399"/>

    <!-- F -->
    <text x="27.5" y="70"
          font-size="42"
          text-anchor="middle"
          fill="#fff"
          font-family="FE-Schrift, Arial, sans-serif"
          font-weight="bold">F</text>

    <!-- Bande droite -->
    <rect x="465" width="55" height="110" fill="#003399"/>

    <!-- Département -->
    <text x="492" y="65"
          font-size="28"
          text-anchor="middle"
          fill="#fff"
          font-family="FE-Schrift, Arial, sans-serif">
      ${dept}
    </text>

    <!-- Région -->
    <text x="492" y="90"
          font-size="14"
          text-anchor="middle"
          fill="#fff"
          font-family="Arial, sans-serif">
      ${region}
    </text>

    <!-- Immat -->
    <text x="260" y="75"
          text-anchor="middle"
          font-size="58"
          fill="#111"
          font-weight="bold"
          letter-spacing="6"
          font-family="FE-Schrift, Arial, sans-serif">
      ${plateText}
    </text>

  </svg>
  `;
}

/**
 * Stream le SVG directement dans la réponse HTTP
 * @param {string} immat - Numéro d'immatriculation
 * @param {string} dept - Département (ex: "91")
 * @param {string} region - Région (ex: "IDF")
 * @param {Response} res - Objet Response Express
 */
export function streamPlateSVG(immat, dept = "91", region = "IDF", res) {
  try {
    const svg = generatePlateSVG(immat, dept, region);
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache 24h
    res.send(svg);
    
    console.log(`✅ Plaque SVG générée: ${immat} (${dept} - ${region})`);
  } catch (error) {
    console.error('❌ Erreur génération plaque SVG:', error);
    res.status(500).json({ error: 'Erreur lors de la génération de la plaque' });
  }
}

/**
 * Détecte le format de plaque (conservé pour compatibilité)
 */
export function detectPlateFormat(immat) {
  const normalized = immat.replace(/[\s-]/g, '');
  
  if (/^[A-Z]{2}\d{3}[A-Z]{2}$/i.test(normalized)) {
    return 'standard';
  }
  
  if (/^\d{1,4}[A-Z]{1,3}\d{0,3}$/i.test(normalized)) {
    return 'old';
  }
  
  return 'standard';
}
