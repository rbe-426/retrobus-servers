import XLSX from 'xlsx';

const CATEGORY_RULES = [
  { keywords: ['adhesion', 'cotisation', 'membre', 'inscription'], category: 'ADHESION' },
  { keywords: ['carburant', 'essence', 'gazole', 'diesel', 'total', 'shell', 'esso'], category: 'CARBURANT' },
  { keywords: ['assurance', 'macif', 'maif', 'groupama', 'axa', 'allianz'], category: 'ASSURANCE' },
  { keywords: ['reparation', 'maintenance', 'entretien', 'atelier', 'garage', 'mecanique', 'piece auto'], category: 'MAINTENANCE' },
  { keywords: ['loyer', 'location', 'bail', 'hangar'], category: 'LOYER' },
  { keywords: ['subvention', 'don', 'sponsoring', 'mecenat'], category: 'SUBVENTION' },
  { keywords: ['evenement', 'manifestation', 'salon', 'expo', 'billet', 'ticket'], category: 'EVENEMENT' },
  { keywords: ['fourniture', 'papeterie', 'bureau', 'amazon', 'fnac'], category: 'FOURNITURES' },
  { keywords: ['communication', 'publicite', 'impression', 'flyer', 'affiche'], category: 'COMMUNICATION' },
  { keywords: ['sncf', 'ratp', 'taxi', 'uber', 'peage', 'autoroute'], category: 'TRANSPORT' },
  { keywords: ['restaurant', 'traiteur', 'buffet', 'cafe'], category: 'RESTAURATION' },
  { keywords: ['vente', 'merchandising', 'boutique', 'shop'], category: 'MERCHANDISING' },
];

const normalizeText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const categorizeTransaction = (description) => {
  const text = normalizeText(description).toLowerCase();
  return CATEGORY_RULES.find(({ keywords }) => keywords.some((keyword) => text.includes(keyword)))?.category || 'AUTRE';
};

const parseAmount = (value) => {
  const amount = Number(String(value ?? '').replace(/\s/g, '').replace(',', '.').replace(/[^\d.+-]/g, ''));
  return Number.isFinite(amount) ? amount : null;
};

const parseDate = (value) => {
  const text = String(value || '').trim();
  const ofxMatch = text.match(/^(\d{4})(\d{2})(\d{2})/);
  if (ofxMatch) return `${ofxMatch[1]}-${ofxMatch[2]}-${ofxMatch[3]}`;
  const frenchMatch = text.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/);
  if (frenchMatch) {
    const year = frenchMatch[3].length === 2 ? `20${frenchMatch[3]}` : frenchMatch[3];
    return `${year}-${frenchMatch[2].padStart(2, '0')}-${frenchMatch[1].padStart(2, '0')}`;
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};

const toTransaction = ({ date, amount, description, type }) => {
  const parsedAmount = parseAmount(amount);
  const parsedDate = parseDate(date);
  const normalizedType = String(type || '').toUpperCase();
  if (!parsedDate || parsedAmount === null || !description) return null;
  return {
    date: parsedDate,
    amount: Math.abs(parsedAmount),
    description: normalizeText(description),
    type: normalizedType.includes('DEBIT') || parsedAmount < 0 ? 'DEBIT' : 'CREDIT',
    category: categorizeTransaction(description),
  };
};

const deduplicateTransactions = (transactions) => {
  const seen = new Set();
  return transactions.filter((transaction) => {
    const key = `${transaction.date}|${transaction.amount.toFixed(2)}|${transaction.type}|${transaction.description.toUpperCase().slice(0, 60)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((left, right) => left.date.localeCompare(right.date));
};

const tagValue = (record, tag) => record.match(new RegExp(`<${tag}[^>]*>\\s*([^<\\r\\n]+)`, 'i'))?.[1]?.trim() || '';

const parseOfx = (content) => {
  const records = content.match(/<STMTTRN>[\s\S]*?(?=<STMTTRN>|<\/BANKTRANLIST>|$)/gi) || [];
  const transactions = records.map((record) => toTransaction({
    date: tagValue(record, 'DTPOSTED'),
    amount: tagValue(record, 'TRNAMT'),
    type: tagValue(record, 'TRNTYPE'),
    description: tagValue(record, 'NAME') || tagValue(record, 'MEMO') || tagValue(record, 'FITID'),
  })).filter(Boolean);
  return { bank: 'OFX', period: null, transactions: deduplicateTransactions(transactions) };
};

const findColumn = (headers, patterns) => headers.findIndex((header) => patterns.some((pattern) => pattern.test(header)));

const parseTabularRows = (rows, bank) => {
  if (!rows.length) return { bank, period: null, transactions: [] };
  const headers = rows[0].map((value) => normalizeText(value).toLowerCase());
  const dateIndex = findColumn(headers, [/date/, /operation/]);
  const descriptionIndex = findColumn(headers, [/libelle/, /description/, /operation/, /intitule/, /nom/]);
  const amountIndex = findColumn(headers, [/montant/, /amount/, /debit.*credit/]);
  const debitIndex = findColumn(headers, [/^debit$/, /debit/]);
  const creditIndex = findColumn(headers, [/^credit$/, /credit/]);
  const transactions = rows.slice(1).map((row) => {
    const amount = amountIndex >= 0 ? row[amountIndex] : (row[creditIndex] || row[debitIndex]);
    return toTransaction({
      date: row[dateIndex],
      description: row[descriptionIndex],
      amount,
      type: debitIndex >= 0 && row[debitIndex] ? 'DEBIT' : 'CREDIT',
    });
  }).filter(Boolean);
  return { bank, period: null, transactions: deduplicateTransactions(transactions) };
};

const parseCsv = (content) => {
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  const separator = lines[0]?.split(';').length >= lines[0]?.split(',').length ? ';' : ',';
  const rows = lines.map((line) => line.split(separator).map((cell) => cell.trim().replace(/^"|"$/g, '').replace(/""/g, '"')));
  return parseTabularRows(rows, 'CSV');
};

const parseSpreadsheet = (buffer) => {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  return parseTabularRows(rows, 'XLS');
};

export const parseBankStatementFile = async (file) => {
  const name = String(file.originalname || '').toLowerCase();
  if (name.endsWith('.ofx')) return parseOfx(file.buffer.toString('utf8'));
  if (name.endsWith('.csv')) return parseCsv(file.buffer.toString('utf8'));
  if (name.endsWith('.xls') || name.endsWith('.xlsx')) return parseSpreadsheet(file.buffer);
  throw new Error('Format non pris en charge. Utilisez un relevé OFX, CSV, XLS ou XLSX.');
};