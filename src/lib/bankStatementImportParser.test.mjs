import XLSX from 'xlsx';
import { parseBankStatementFile } from './bankStatementImportParser.js';

const csv = await parseBankStatementFile({
  originalname: 'bnp.csv',
  buffer: Buffer.from('Date;Libellé;Montant\n12/02/2026;COTISATION ASSOCIATION;12,50\n13/02/2026;CARTE ESSO;-45,20'),
});

const ofx = await parseBankStatementFile({
  originalname: 'bnp.ofx',
  buffer: Buffer.from('<OFX><BANKTRANLIST><STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260214<TRNAMT>-21.30<NAME>GARAGE RETRO</STMTTRN></BANKTRANLIST></OFX>'),
});

const ofxXml = await parseBankStatementFile({
  originalname: 'bnp-xml.ofx',
  buffer: Buffer.from('<OFX><BANKTRANLIST><STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20260216</DTPOSTED><TRNAMT>50.00</TRNAMT><NAME>VENTE BOUTIQUE</NAME></STMTTRN></BANKTRANLIST></OFX>'),
});

const workbook = XLSX.utils.book_new();
const sheet = XLSX.utils.aoa_to_sheet([['Date', 'Libellé', 'Montant'], ['15/02/2026', 'DON ASSOCIATION', '100,00']]);
XLSX.utils.book_append_sheet(workbook, sheet, 'Releve');
const xls = await parseBankStatementFile({
  originalname: 'bnp.xls',
  buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xls' }),
});

if (csv.transactions.length !== 2 || ofx.transactions[0]?.type !== 'DEBIT' || ofxXml.transactions[0]?.type !== 'CREDIT' || xls.transactions[0]?.category !== 'SUBVENTION') {
  throw new Error('Résultat inattendu lors de l’analyse des relevés bancaires.');
}

console.log(`CSV ${csv.transactions.length}, OFX SGML ${ofx.transactions.length}, OFX XML ${ofxXml.transactions.length}, XLS ${xls.transactions.length}`);