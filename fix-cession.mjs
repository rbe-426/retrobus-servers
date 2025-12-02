import fs from 'fs';

const filePath = 'C:\\Dev\\RETROBUS_ESSONNE\\interne\\api\\src\\server.js';
let content = fs.readFileSync(filePath, 'utf-8');

// Find and replace the GET endpoint
const getRegex = /app\.get\(\['\/vehicles\/:parc\/certificat-cession','\/api\/vehicles\/:parc\/certificat-cession'\], requireAuth, \(req, res\) => \{\s*const parc = req\.params\.parc;\s*const cert = state\.vehicleCertificatCession\.find\(c => c\.parc === parc\);\s*res\.json\(cert \|\| \{ parc, certificatPath: null, dateImport: null, notes: '', imported: false \}\);\s*\}\);/;

const getRepl = `app.get(['/vehicles/:parc/certificat-cession','/api/vehicles/:parc/certificat-cession'], requireAuth, async (req, res) => {
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

content = content.replace(getRegex, getRepl);

// Find and replace the POST endpoint  
const postRegex = /app\.post\(\['\/vehicles\/:parc\/certificat-cession','\/api\/vehicles\/:parc\/certificat-cession'\], requireAuth, \(req, res\) => \{\s*const parc = req\.params\.parc;\s*\/\/ Vérifier si déjà importé\s*const existing = state\.vehicleCertificatCession\.find\(c => c\.parc === parc\);\s*if \(existing && existing\.imported\) \{\s*return res\.status\(400\)\.json\(\{ error: 'Certificate already imported for this vehicle' \}\);\s*\}\s*const \{ certificatPath, notes \} = req\.body;\s*let cert = existing \|\| \{ id: uid\(\), parc \};\s*cert\.certificatPath = certificatPath;\s*cert\.dateImport = new Date\(\)\.toISOString\(\);\s*cert\.notes = notes \|\| '';\s*cert\.imported = true;\s*if \(!existing\) state\.vehicleCertificatCession\.push\(cert\);\s*debouncedSave\(\);\s*res\.json\(cert\);\s*\}\);/;

const postRepl = `app.post(['/vehicles/:parc/certificat-cession','/api/vehicles/:parc/certificat-cession'], requireAuth, async (req, res) => {
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

content = content.replace(postRegex, postRepl);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('✅ Fixed certificat-cession endpoints');
