/**
 * bankStatementParser.js
 * Analyse les relevés bancaires PDF français et extrait les transactions.
 * Compatible avec les formats courants : Crédit Agricole, LCL, BNP, SG, CIC, Banque Postale, Caisse d'Épargne.
 */

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// ─── Catégories automatiques par mot-clé dans la description ──────────────────
const CATEGORY_RULES = [
  { keywords: ['adhésion', 'cotisation', 'membre', 'inscription'], category: 'ADHESION' },
  { keywords: ['carburant', 'essence', 'gazole', 'diesel', 'total', 'shell', 'bp station', 'esso', 'leclerc carb'], category: 'CARBURANT' },
  { keywords: ['assurance', 'macif', 'maif', 'groupama', 'axa', 'allianz', 'mma'], category: 'ASSURANCE' },
  { keywords: ['réparation', 'maintenance', 'entretien', 'atelier', 'garage', 'mécanique', 'pièce', 'piece auto'], category: 'MAINTENANCE' },
  { keywords: ['loyer', 'location', 'bail', 'local', 'hangar', 'box'], category: 'LOYER' },
  { keywords: ['virement', 'subvention', 'don', 'sponsoring', 'mécénat'], category: 'SUBVENTION' },
  { keywords: ['événement', 'evenement', 'manifestation', 'salon', 'expo', 'billet', 'ticket'], category: 'EVENEMENT' },
  { keywords: ['fourniture', 'papeterie', 'bureau', 'amazon', 'fnac', 'leclerc'], category: 'FOURNITURES' },
  { keywords: ['communication', 'publicité', 'pub', 'impression', 'flyer', 'affiche'], category: 'COMMUNICATION' },
  { keywords: ['transport', 'sncf', 'ratp', 'taxi', 'uber', 'péage', 'autoroute'], category: 'TRANSPORT' },
  { keywords: ['restauration', 'repas', 'restaurant', 'traiteur', 'buffet', 'café'], category: 'RESTAURATION' },
  { keywords: ['vente', 'merchandising', 'boutique', 'shop', 'merch'], category: 'MERCHANDISING' },
];

/**
 * Détermine la catégorie à partir du libellé de la transaction
 */
function categorizeTransaction(description) {
  const lower = description.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some(kw => lower.includes(kw))) {
      return rule.category;
    }
  }
  return 'AUTRE';
}

/**
 * Parse une date au format DD/MM/YYYY, DD/MM/YY ou DD.MM.YY (BNP) → ISO string
 */
function parseDate(str) {
  // Support / et . comme séparateurs
  const m = str.match(/^(\d{2})[\/.](\d{2})[\/.](\d{2,4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const year = y.length === 2 ? (parseInt(y) > 50 ? '19' + y : '20' + y) : y;
  const iso = `${year}-${mo}-${d}`;
  return isNaN(Date.parse(iso)) ? null : iso;
}

/**
 * Convertit une chaîne de montant français en nombre
 * "1 234,56" → 1234.56 | "-1 234,56" → -1234.56
 */
function parseMontant(str) {
  if (!str) return null;
  const cleaned = str.replace(/\s/g, '').replace(',', '.').replace(/[^\d.\-+]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

/**
 * Patterns multi-banques pour détecter une ligne de transaction.
 *
 * Groupe attendu: date | description | débit | crédit  (ou variante avec montant signé)
 * Certaines banques n'ont qu'un seul montant, signé ou non.
 */
const TRANSACTION_PATTERNS = [
  // Format BNP Paribas: DD.MM.YY LIBELLÉ DD.MM.YY MONTANT
  /^(\d{2}\.\d{2}\.\d{2})\s+(.+?)\s+\d{2}\.\d{2}\.\d{2}\s+(\d[\d\s]*,\d{2})\s*$/,
  // Format standard: DATE LIBELLÉ DÉBIT CRÉDIT  (ex: Crédit Agricole, CIC, SG)
  /^(\d{2}\/\d{2}\/\d{2,4})\s+(.+?)\s+(\d[\d\s]*,\d{2})\s+(\d[\d\s]*,\d{2})\s*$/,
  // Format: DATE LIBELLÉ MONTANT_SIGNÉ  (ex: LCL, Caisse d'Épargne, Boursorama)
  /^(\d{2}\/\d{2}\/\d{2,4})\s+(.+?)\s+([+-]?\d[\d\s]*,\d{2})\s*$/,
  // Format: DATE LIBELLÉ MONTANTNÉGATIF (sans signe, débit seulement)
  /^(\d{2}\/\d{2}\/\d{2,4})\s+(.+?)\s+(\d{1,3}(?:\s\d{3})*,\d{2})\s*$/,
  // Format Banque Postale: DD/MM LIBELLÉ MONTANT
  /^(\d{2}\/\d{2})\s+(.+?)\s+([+-]?\d[\d\s]*,\d{2})\s*$/,
];

/**
 * Essaie de détecter le format du relevé
 */
function detectBankFormat(text) {
  const textLower = text.toLowerCase();
  if (textLower.includes('crédit agricole') || textLower.includes('credit agricole')) return 'Crédit Agricole';
  if (textLower.includes('lcl')) return 'LCL';
  if (textLower.includes('bnp paribas') || textLower.includes('bnpparibas')) return 'BNP Paribas';
  if (textLower.includes('société générale') || textLower.includes('societe generale')) return 'Société Générale';
  if (textLower.includes('cic')) return 'CIC';
  if (textLower.includes('banque postale') || textLower.includes('la poste')) return 'La Banque Postale';
  if (textLower.includes("caisse d'épargne") || textLower.includes('caisse depargne')) return "Caisse d'Épargne";
  if (textLower.includes('boursorama')) return 'Boursorama';
  if (textLower.includes('hello bank')) return 'Hello Bank';
  if (textLower.includes('fortuneo')) return 'Fortuneo';
  return 'Banque inconnue';
}

/**
 * Extrait la période couverte par le relevé (mois/année)
 */
function extractPeriod(text) {
  const patterns = [
    /du\s+(\d{2}\/\d{2}\/\d{4})\s+au\s+(\d{2}\/\d{2}\/\d{4})/i,
    /(\d{2}\/\d{2}\/\d{4})\s*[-–]\s*(\d{2}\/\d{2}\/\d{4})/,
    /(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[0];
  }
  return null;
}

/**
 * Analyse le texte extrait du PDF et retourne les transactions détectées.
 */
function parseTransactionsFromText(rawText) {
  const transactions = [];
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const currentYear = new Date().getFullYear();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Tenter chaque pattern
    for (const pattern of TRANSACTION_PATTERNS) {
      const m = line.match(pattern);
      if (!m) continue;

      let [, rawDate, description, col3, col4] = m;

      // Déterminer la date (si format DD/MM ajouter l'année courante)
      if (/^\d{2}\/\d{2}$/.test(rawDate)) rawDate += `/${currentYear}`;
      const date = parseDate(rawDate);
      if (!date) continue;

      // Nettoyer la description (supprimer les libellés parasites courants)
      description = description
        .replace(/\s+/g, ' ')
        .replace(/^\d{6,}\s*/, '') // supprimer code opération
        .replace(/\bVIR\b|\bCB\b|\bPRL\b|\bCHQ\b|\bREM\b/g, '') // codes comptables
        .replace(/\bSCT\b|\bINST\b|\bRECU\b|\bSEPA\b/g, '') // codes BNP
        .replace(/\/FRM\s+.*?\/EID/g, '') // /FRM ... /EID (BNP)
        .replace(/\/MOTIF\s+/g, '') // /MOTIF (BNP)
        .replace(/\/REFBEN\s+/g, '') // /REFBEN (BNP)
        .replace(/\/ORIG\s+/g, '') // /ORIG (BNP)
        .replace(/\/RNF\s+/g, '') // /RNF (BNP)
        .replace(/NOTPROVIDED/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (description.length < 3) continue;

      let type, amount;

      if (col4 !== undefined) {
        // Deux colonnes: débit + crédit
        const debit = parseMontant(col3);
        const credit = parseMontant(col4);
        if (credit && credit > 0 && (!debit || debit === 0)) {
          type = 'CREDIT';
          amount = credit;
        } else if (debit && debit > 0) {
          type = 'DEBIT';
          amount = debit;
        } else {
          continue;
        }
      } else {
        // Montant unique - détecter le type par heuristiques sur le libellé
        const val = parseMontant(col3);
        if (val === null) continue;
        
        // Déterminer si c'est un DEBIT ou CREDIT basé sur le libellé
        const descLower = description.toLowerCase();
        const isCreditKeyword = /\b(recu|virement|depot|espece|cheque recu|remise|vir sepa recu|vir inst recu)\b/.test(descLower);
        const isDebitKeyword = /\b(prlv|prelevement|retrait|cb|carte|paiement|remboursement|commission|frais|cotisation|cheque emis)\b/.test(descLower);
        
        if (isCreditKeyword && !isDebitKeyword) {
          type = 'CREDIT';
          amount = Math.abs(val);
        } else if (isDebitKeyword && !isCreditKeyword) {
          type = 'DEBIT';
          amount = Math.abs(val);
        } else {
          // Par défaut: positif = CREDIT, négatif = DEBIT
          if (val >= 0) {
            type = 'CREDIT';
            amount = val;
          } else {
            type = 'DEBIT';
            amount = Math.abs(val);
          }
        }
      }

      if (!amount || amount <= 0) continue;

      transactions.push({
        date,
        description,
        type,
        amount: Math.round(amount * 100) / 100,
        category: categorizeTransaction(description),
        selected: true, // sélectionné par défaut pour import
      });

      break; // pattern trouvé, passer à la ligne suivante
    }
  }

  return transactions;
}

/**
 * Point d'entrée principal.
 * @param {Buffer} pdfBuffer - Contenu binaire du PDF
 * @returns {{ bank, period, transactions, rawLineCount }}
 */
export async function parseBankStatementPDF(pdfBuffer) {
  try {
    // Load the PDF using pdfjs-dist
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    });
    
    const pdfDocument = await loadingTask.promise;
    const numPages = pdfDocument.numPages;
    
    // Extract text from all pages with better line preservation
    let fullText = '';
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Trier les items par position Y (pour préserver l'ordre des lignes)
      const items = textContent.items.sort((a, b) => {
        const yDiff = b.transform[5] - a.transform[5]; // Transform[5] = Y position
        if (Math.abs(yDiff) > 5) return yDiff > 0 ? 1 : -1; // Nouvelle ligne si Y diffère de > 5px
        return a.transform[4] - b.transform[4]; // Sinon trier par X
      });
      
      // Reconstruire le texte ligne par ligne
      let currentY = null;
      let currentLine = '';
      
      for (const item of items) {
        const y = item.transform[5];
        
        // Nouvelle ligne si Y diffère significativement
        if (currentY !== null && Math.abs(y - currentY) > 5) {
          if (currentLine.trim()) {
            fullText += currentLine.trim() + '\n';
          }
          currentLine = '';
        }
        
        currentLine += item.str + ' ';
        currentY = y;
      }
      
      // Ajouter la dernière ligne de la page
      if (currentLine.trim()) {
        fullText += currentLine.trim() + '\n';
      }
    }

    // Debug: Log first 2000 chars of extracted text
    console.log('📄 PDF Text Extract (first 2000 chars):');
    console.log(fullText.substring(0, 2000));
    console.log('...');

    const bank = detectBankFormat(fullText);
    const period = extractPeriod(fullText);
    const transactions = parseTransactionsFromText(fullText);

    console.log(`✅ Parsed: ${bank}, ${period}, ${transactions.length} transactions`);

    return {
      bank,
      period,
      transactions,
      rawLineCount: fullText.split('\n').filter(l => l.trim()).length,
      pageCount: numPages,
    };
  } catch (error) {
    console.error('Erreur parsing PDF:', error);
    throw new Error(`Impossible de parser le PDF: ${error.message}`);
  }
}
