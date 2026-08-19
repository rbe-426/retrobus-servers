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

function inferTransactionType(description, amount, sectionHint = null) {
  if (sectionHint === 'CREDIT' || sectionHint === 'DEBIT') {
    return sectionHint;
  }

  const descLower = description.toLowerCase();
  const isCreditKeyword = /\b(recu|recue|depot|espece|remise|vir sepa recu|vir inst recu|vir sct inst recu|cheque recu)\b/.test(descLower);
  const isDebitKeyword = /\b(emis|emise|prlv|prelevement|retrait|cb|carte|paiement|remboursement|commission|commissions|frais|cotisation|cheque emis|vir sepa emis|vir inst emis|vir sct inst emis)\b/.test(descLower);

  if (isCreditKeyword && !isDebitKeyword) return 'CREDIT';
  if (isDebitKeyword && !isCreditKeyword) return 'DEBIT';
  return amount >= 0 ? 'CREDIT' : 'DEBIT';
}

function normalizeTransactionDescription(description) {
  return String(description || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*\/\s*/g, '/')
    .trim()
    .toUpperCase();
}

function deduplicateTransactions(transactions) {
  const seen = new Set();
  const uniqueTransactions = [];

  for (const transaction of transactions) {
    // Clé de déduplication plus agressive pour éviter les faux doublons
    // - Date exacte
    // - Montant arrondi à 2 décimales
    // - Type (DEBIT/CREDIT)
    // - Premiers 40 caractères de la description normalisée (pour ignorer variations de fin)
    const normalizedDesc = normalizeTransactionDescription(transaction.description);
    const key = [
      transaction.date,
      Number(transaction.amount).toFixed(2),
      transaction.type,
      normalizedDesc.substring(0, 40) // Limiter à 40 caractères pour tolérer variations
    ].join('|');

    if (seen.has(key)) {
      // console.log(`🔄 Doublon ignoré: ${transaction.description.substring(0, 50)}`);
      continue;
    }

    seen.add(key);
    uniqueTransactions.push(transaction);
  }

  return uniqueTransactions.sort((left, right) => {
    const dateDiff = new Date(left.date) - new Date(right.date);
    if (dateDiff !== 0) return dateDiff;
    return normalizeTransactionDescription(left.description).localeCompare(normalizeTransactionDescription(right.description));
  });
}

function normalizeBNPLine(line) {
  return line
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function getBNPSectionType(line) {
  if (/^\d{2}\.\d{2}\.\d{2}\s+/.test(line)) {
    return null;
  }

  const normalized = normalizeBNPLine(line);

  if (
    normalized.includes('VIREMENTS RECUS') ||
    normalized.includes('VIREMENTS RECUS') ||
    normalized.includes('RETROCESSION')
  ) {
    return 'CREDIT';
  }

  if (
    normalized.includes('VIREMENTS EMIS') ||
    normalized.includes('VIREMENTS EMIS') ||
    normalized.includes('PRELEVEMENTS') ||
    normalized.includes('COMMISSIONS') ||
    normalized.includes('INTERETS ET COMMISSIONS') ||
    normalized.includes('FRAIS')
  ) {
    return 'DEBIT';
  }

  return null;
}

function isIgnorableBNPLine(line) {
  const normalized = normalizeBNPLine(line);

  return (
    !normalized ||
    normalized.startsWith('R ELEVE') ||
    normalized.startsWith('RELEVE') ||
    normalized.startsWith('PERIODE DU') ||
    normalized.startsWith('SOLDE AU') ||
    normalized.startsWith('SOUS TOTAL') ||
    normalized.startsWith('TOTAL') ||
    normalized.startsWith('BNP PARIBAS SA') ||
    normalized.startsWith('P. ') ||
    normalized.startsWith('D ATE') ||
    normalized.startsWith('DATE') ||
    normalized.startsWith('COMPTABLE') ||
    normalized.startsWith('VALEUR') ||
    normalized.startsWith('D EBIT') ||
    normalized.startsWith('C REDIT') ||
    /^\d+\s*\(SERVICE GRATUIT/i.test(normalized) ||
    /^[A-Z0-9]{10,}$/.test(normalized)
  );
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

      // Nettoyer légèrement la description (garder le maximum d'info)
      description = description
        .replace(/\s+/g, ' ') // Normaliser les espaces
        .replace(/^\d{6,}\s*/, '') // Supprimer code opération en début
        .replace(/NOTPROVIDED/g, '') // Supprimer ce code inutile
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
        type = inferTransactionType(description, val);
        amount = Math.abs(val);
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

export function parseBNPTransactionsFromText(rawText) {
  const transactions = [];
  const lines = rawText
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  let currentSectionType = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const sectionType = getBNPSectionType(line);
    if (sectionType) {
      currentSectionType = sectionType;
      continue;
    }

    if (isIgnorableBNPLine(line)) {
      continue;
    }

    const fullLineMatch = line.match(/^(\d{2}\.\d{2}\.\d{2})\s+(.+?)\s+(\d{2}\.\d{2}\.\d{2})\s+([+-]?\d[\d\s]*,\d{2})$/);
    if (fullLineMatch) {
      const [, rawDate, descriptionPart, , rawAmount] = fullLineMatch;
      const date = parseDate(rawDate);
      const amount = parseMontant(rawAmount);

      if (date && amount !== null && Math.abs(amount) >= 0.01) {
        const description = descriptionPart
          .replace(/\s+/g, ' ')
          .replace(/^\d{6,}\s*/, '')
          .replace(/NOTPROVIDED/g, '')
          .trim();

        if (description.length >= 3) {
          transactions.push({
            date,
            description,
            type: inferTransactionType(description, amount, currentSectionType),
            amount: Math.abs(Math.round(amount * 100) / 100),
            category: categorizeTransaction(description),
            selected: true,
          });
        }
      }
      continue;
    }

    const compactLineMatch = line.match(/^(\d{2}\.\d{2}\.\d{2})\s+(.+?)\s+([+-]?\d[\d\s]*,\d{2})$/);
    if (compactLineMatch) {
      const [, rawDate, descriptionPart, rawAmount] = compactLineMatch;
      const date = parseDate(rawDate);
      const amount = parseMontant(rawAmount);

      if (date && amount !== null && Math.abs(amount) >= 0.01) {
        const description = descriptionPart
          .replace(/\s+/g, ' ')
          .replace(/^\d{6,}\s*/, '')
          .replace(/NOTPROVIDED/g, '')
          .trim();

        if (description.length >= 3) {
          transactions.push({
            date,
            description,
            type: inferTransactionType(description, amount, currentSectionType),
            amount: Math.abs(Math.round(amount * 100) / 100),
            category: categorizeTransaction(description),
            selected: true,
          });
        }
      }
      continue;
    }

    const startMatch = line.match(/^(\d{2}\.\d{2}\.\d{2})\s+(.+)$/);
    if (!startMatch) {
      continue;
    }

    if (/^\d{2}\.\d{2}\.\d{2}\s+[+-]?\d[\d\s]*,\d{2}$/.test(line)) {
      continue;
    }

    const [, rawDate, firstDescriptionPart] = startMatch;
    const date = parseDate(rawDate);
    if (!date) {
      continue;
    }

    const descriptionParts = [firstDescriptionPart];
    let amount = null;
    let consumedUntil = i;

    for (let j = i + 1; j < lines.length && j <= i + 12; j++) {
      const nextLine = lines[j];

      if (getBNPSectionType(nextLine)) {
        break;
      }

      if (isIgnorableBNPLine(nextLine)) {
        if (/^(Sous total|TOTAL|SOLDE)/i.test(nextLine)) {
          break;
        }
        continue;
      }

      if (/^(Sous total|TOTAL|SOLDE)/i.test(nextLine)) {
        break;
      }

      const endMatch = nextLine.match(/^(\d{2}\.\d{2}\.\d{2})\s+([+-]?\d[\d\s]*,\d{2})$/);
      if (endMatch) {
        amount = parseMontant(endMatch[2]);
        consumedUntil = j;
        break;
      }

      if (/^\d{2}\.\d{2}\.\d{2}\s+/.test(nextLine)) {
        break;
      }

      if (/^(P\.\s*\d+\/\d+|\d+\s*\(service gratuit|SORPSITSPREPFC)/i.test(nextLine)) {
        continue;
      }

      descriptionParts.push(nextLine);
    }

    if (amount === null || Math.abs(amount) < 0.01) {
      continue;
    }

    const description = descriptionParts
      .join(' ')
      .replace(/\s+/g, ' ')
      .replace(/^\d{6,}\s*/, '')
      .replace(/NOTPROVIDED/g, '')
      .trim();

    if (description.length < 3) {
      continue;
    }

    transactions.push({
      date,
      description,
      type: inferTransactionType(description, amount, currentSectionType),
      amount: Math.abs(Math.round(amount * 100) / 100),
      category: categorizeTransaction(description),
      selected: true,
    });

    i = consumedUntil;
  }

  return transactions;
}

function parseBNPTransactionsFromLooseText(rawText) {
  const normalizedText = rawText.replace(/\r/g, '');
  const pattern = /(\d{2}\.\d{2}\.\d{2})\s+(.+?)(?=(?:\s+\d{2}\.\d{2}\.\d{2}\s+[+-]?\d[\d\s]*,\d{2})|(?:\n\d{2}\.\d{2}\.\d{2}\s)|$)/gs;
  const transactions = [];

  let match;
  while ((match = pattern.exec(normalizedText)) !== null) {
    const [, rawDate, body] = match;
    const trimmedBody = body.replace(/\s+/g, ' ').trim();
    const amountMatch = trimmedBody.match(/(.+?)\s+(\d{2}\.\d{2}\.\d{2})\s+([+-]?\d[\d\s]*,\d{2})$/);
    if (!amountMatch) {
      continue;
    }

    const date = parseDate(rawDate);
    const amount = parseMontant(amountMatch[3]);
    if (!date || amount === null || Math.abs(amount) < 0.01) {
      continue;
    }

    const description = amountMatch[1]
      .replace(/\s+/g, ' ')
  .replace(/^\d{6,}\s*/, '')
      .replace(/NOTPROVIDED/g, '')
      .trim();

    if (description.length < 3) {
      continue;
    }

    transactions.push({
      date,
      description,
      type: inferTransactionType(description, amount),
      amount: Math.abs(Math.round(amount * 100) / 100),
      category: categorizeTransaction(description),
      selected: true,
    });
  }

  return transactions;
}

/**
 * Extraction spécifique pour BNP Paribas (format tabulaire multi-lignes)
 * Format : 
 *   Ligne 1: Date opé | Début libellé
 *   Lignes suivantes: Suite du libellé
 *   Dernière ligne: Date valeur | Montant
 */
function extractBNPTableData(allItems) {
  const transactions = [];
  
  console.log(`🔍 Extraction BNP - Total items: ${allItems.length}`);
  
  // Grouper les items par ligne (Y position)
  const lineGroups = [];
  let currentLineY = null;
  let currentLineItems = [];
  
  for (const item of allItems) {
    const y = item.transform[5];
    
    // Nouvelle ligne si Y diffère de plus de 5px
    if (currentLineY !== null && Math.abs(y - currentLineY) > 5) {
      if (currentLineItems.length > 0) {
        lineGroups.push([...currentLineItems]);
      }
      currentLineItems = [];
    }
    
    currentLineItems.push(item);
    currentLineY = y;
  }
  
  // Ajouter la dernière ligne
  if (currentLineItems.length > 0) {
    lineGroups.push(currentLineItems);
  }
  
  console.log(`📋 Lignes groupées: ${lineGroups.length}`);
  
  // Convertir les lignes en texte
  const lines = lineGroups.map(lineItems => {
    const sortedItems = lineItems.sort((a, b) => a.transform[4] - b.transform[4]);
    return sortedItems.map(item => item.str.trim()).filter(Boolean);
  });
  
  // Debug: afficher les 50 premières lignes
  lines.slice(0, 50).forEach((texts, idx) => {
    console.log(`Ligne ${idx + 1}: [${texts.join(' | ')}]`);
  });
  
  // Parcourir les lignes et détecter les transactions multi-lignes
  let i = 0;
  while (i < lines.length) {
    const texts = lines[i];
    
    // Chercher une ligne qui commence par une date (début de transaction)
    const firstText = texts[0];
    if (!/^\d{2}\.\d{2}\.\d{2}$/.test(firstText)) {
      i++;
      continue;
    }
    
    const dateOpe = parseDate(firstText);
    if (!dateOpe) {
      i++;
      continue;
    }
    
    // Vérifier si c'est une ligne complète (date + libellé + date valeur + montant)
    const lastText = texts[texts.length - 1];
    if (/^[+-]?\d[\d\s]*,\d{2}$/.test(lastText)) {
      // Ligne complète sur une seule ligne
      const amount = parseMontant(lastText);
      if (amount && Math.abs(amount) >= 0.01) {
        // Colonnes du milieu = libellé
        const descParts = texts.slice(1, -1).filter(part => !/^\d{2}\.\d{2}\.\d{2}$/.test(part));
        const description = descParts.join(' ').replace(/\s+/g, ' ').trim();
        
        if (description.length >= 3) {
          const descLower = description.toLowerCase();
          const isCreditKeyword = /\b(recu|recue|depot|espece|remise|vir sepa recu|vir inst recu|vir sct inst recu|cheque recu)\b/.test(descLower);
          const isDebitKeyword = /\b(emis|emise|prlv|prelevement|retrait|cb|carte|paiement|remboursement|commission|commissions|frais|cotisation|cheque emis|vir sepa emis|vir inst emis|vir sct inst emis)\b/.test(descLower);
          
          let type;
          if (isCreditKeyword && !isDebitKeyword) {
            type = 'CREDIT';
          } else if (isDebitKeyword && !isCreditKeyword) {
            type = 'DEBIT';
          } else {
            type = amount >= 0 ? 'CREDIT' : 'DEBIT';
          }
          
          transactions.push({
            date: dateOpe,
            description,
            type,
            amount: Math.abs(Math.round(amount * 100) / 100),
            category: categorizeTransaction(description),
            selected: true,
          });
          
          console.log(`✅ Transaction complète ligne ${i + 1}: ${dateOpe} | ${description} | ${amount}€`);
        }
      }
      i++;
      continue;
    }
    
    // Transaction multi-lignes : accumuler jusqu'à trouver la ligne avec montant
    let descriptionParts = texts.slice(1); // Tout sauf la première colonne (date)
    let j = i + 1;
    let foundEnd = false;
    
    // Chercher les lignes suivantes jusqu'à trouver date + montant
    while (j < lines.length && j < i + 10) { // Max 10 lignes par transaction
      const nextLine = lines[j];
      
      // Vérifier si dernière colonne est un montant
      const lastCol = nextLine[nextLine.length - 1];
      if (/^[+-]?\d[\d\s]*,\d{2}$/.test(lastCol)) {
        // C'est la ligne de fin avec date valeur + montant
        const amount = parseMontant(lastCol);
        
        if (amount && Math.abs(amount) >= 0.01) {
          // Combiner toutes les parties du libellé
          const description = descriptionParts
            .join(' ')
            .replace(/\s+/g, ' ')
            .replace(/^\d{6,}\s*/, '')
            .replace(/NOTPROVIDED/g, '')
            .trim();
          
          if (description.length >= 3) {
            const descLower = description.toLowerCase();
            const isCreditKeyword = /\b(recu|recue|depot|espece|remise|vir sepa recu|vir inst recu|vir sct inst recu|cheque recu)\b/.test(descLower);
            const isDebitKeyword = /\b(emis|emise|prlv|prelevement|retrait|cb|carte|paiement|remboursement|commission|commissions|frais|cotisation|cheque emis|vir sepa emis|vir inst emis|vir sct inst emis)\b/.test(descLower);
            
            let type;
            if (isCreditKeyword && !isDebitKeyword) {
              type = 'CREDIT';
            } else if (isDebitKeyword && !isCreditKeyword) {
              type = 'DEBIT';
            } else {
              type = amount >= 0 ? 'CREDIT' : 'DEBIT';
            }
            
            transactions.push({
              date: dateOpe,
              description,
              type,
              amount: Math.abs(Math.round(amount * 100) / 100),
              category: categorizeTransaction(description),
              selected: true,
            });
            
            console.log(`✅ Transaction multi-lignes ${i + 1}-${j + 1}: ${dateOpe} | ${description} | ${amount}€`);
          }
        }
        
        foundEnd = true;
        i = j + 1; // Continuer après cette transaction
        break;
      }
      
      // Ligne intermédiaire de libellé
      descriptionParts.push(...nextLine);
      j++;
    }
    
    if (!foundEnd) {
      // Pas de fin trouvée, passer à la ligne suivante
      i++;
    }
  }
  
  console.log(`📊 Total transactions BNP: ${transactions.length}`);
  
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
    
    // Collecter tous les items de toutes les pages
    let allItems = [];
    let fullText = '';
    
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Stocker les items avec leurs positions pour extraction tabulaire
      allItems.push(...textContent.items);
      
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
    
    // Utiliser l'extracteur approprié selon la banque
    let transactions;
    if (bank === 'BNP Paribas') {
      console.log('🏦 Utilisation des extracteurs fusionnés BNP Paribas');
      const bnpTextTransactions = parseBNPTransactionsFromText(fullText);
      const bnpLooseTransactions = parseBNPTransactionsFromLooseText(fullText);
      const bnpTableTransactions = extractBNPTableData(allItems);
      const genericTransactions = parseTransactionsFromText(fullText);

      console.log(`📊 BNP texte structuré: ${bnpTextTransactions.length}`);
      console.log(`📊 BNP texte souple: ${bnpLooseTransactions.length}`);
      console.log(`📊 BNP tabulaire: ${bnpTableTransactions.length}`);
      console.log(`📊 Générique: ${genericTransactions.length}`);

      // Stratégie intelligente : prioriser l'extracteur qui donne le plus de résultats
      // et ne fusionner que si nécessaire pour compléter
      const extractors = [
        { name: 'texte structuré', transactions: bnpTextTransactions },
        { name: 'tabulaire', transactions: bnpTableTransactions },
        { name: 'texte souple', transactions: bnpLooseTransactions },
        { name: 'générique', transactions: genericTransactions }
      ].sort((a, b) => b.transactions.length - a.transactions.length);

      const primaryExtractor = extractors[0];
      console.log(`🎯 Extracteur principal: ${primaryExtractor.name} (${primaryExtractor.transactions.length} tx)`);

      // Si l'extracteur principal a trouvé au moins 5 transactions, l'utiliser seul
      // Sinon fusionner les 2 meilleurs extracteurs pour compléter
      if (primaryExtractor.transactions.length >= 5) {
        transactions = deduplicateTransactions(primaryExtractor.transactions);
      } else {
        console.log('⚠️ Peu de transactions trouvées, fusion des 2 meilleurs extracteurs');
        transactions = deduplicateTransactions([
          ...extractors[0].transactions,
          ...extractors[1].transactions
        ]);
      }

      console.log(`📊 BNP final après déduplication: ${transactions.length}`);
    } else {
      transactions = parseTransactionsFromText(fullText);
    }

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
