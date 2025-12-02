import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'src', 'server.js');
const content = fs.readFileSync(filePath, 'utf-8');

// Simple string replacement for the two endpoints
const oldGet = `app.get(['/vehicles/:parc/certificat-cession','/api/vehicles/:parc/certificat-cession'], requireAuth, (req, res) => {
  const parc = req.params.parc;
  const cert = state.vehicleCertificatCession.find(c => c.parc === parc);
  res.json(cert || { parc, certificatPath: null, dateImport: null, notes: '', imported: false });
});`;

const newGet = `app.get(['/vehicles/:parc/certificat-cession','/api/vehicles/:parc/certificat-cession'], requireAuth, async (req, res) => {
  try {
    const parc = req.params.parc;
    const cert = await prisma.vehicleCessionCertificate.findUnique({
      where: { parc }
    });
    res.json(cert || { parc, certificatePath: null, dateImport: null, notes: '', imported: false });
  } catch (e) {
    console.error('Erreur lecture cession:', e);
    res.status(500).json({ error: e.message });
  }
});`;

const oldPost = `app.post(['/vehicles/:parc/certificat-cession','/api/vehicles/:parc/certificat-cession'], requireAuth, (req, res) => {
  const parc = req.params.parc;
  
  // Vérifier si déjà importé
  const existing = state.vehicleCertificatCession.find(c => c.parc === parc);
  if (existing && existing.imported) {
    return res.status(400).json({ error: 'Certificate already imported for this vehicle' });
  }
  
  const { certificatePath, notes } = req.body;
  let cert = existing || { id: uid(), parc };
  
  cert.certificatPath = certificatePath;
  cert.dateImport = new Date().toISOString();
  cert.notes = notes || '';
  cert.imported = true;
  
  if (!existing) state.vehicleCertificatCession.push(cert);
  
  debouncedSave();
  res.json(cert);
});`;

const newPost = `app.post(['/vehicles/:parc/certificat-cession','/api/vehicles/:parc/certificat-cession'], requireAuth, async (req, res) => {
  try {
    const parc = req.params.parc;
    
    // Vérifier si déjà importé
    const existing = await prisma.vehicleCessionCertificate.findUnique({
      where: { parc }
    });
    
    if (existing && existing.imported) {
      return res.status(400).json({ error: 'Certificate already imported for this vehicle' });
    }
    
    const { certificatePath, notes } = req.body;
    
    const cert = await prisma.vehicleCessionCertificate.upsert({
      where: { parc },
      update: {
        certificatePath,
        notes: notes || '',
        dateImport: new Date(),
        imported: true
      },
      create: {
        id: uid(),
        parc,
        certificatePath,
        notes: notes || '',
        dateImport: new Date(),
        imported: true
      }
    });
    
    res.json(cert);
  } catch (e) {
    console.error('Erreur sauvegarde cession:', e);
    res.status(500).json({ error: e.message });
  }
});`;

let updated = content.replace(oldGet, newGet);
if (updated === content) {
  console.error('❌ GET endpoint not found!');
  process.exit(1);
}

updated = updated.replace(oldPost, newPost);
if (updated.length === content.length) {
  console.error('⚠️  POST endpoint not found, but GET was fixed');
}

fs.writeFileSync(filePath, updated, 'utf-8');
console.log('✅ Fixed certificat-cession endpoints to use Prisma');
