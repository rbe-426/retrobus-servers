#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'src', 'server.js');
let lines = fs.readFileSync(filePath, 'utf-8').split('\n');

// Replace GET endpoint (line 1406-1410, 0-indexed)
lines[1406] = "app.get(['/vehicles/:parc/certificat-cession','/api/vehicles/:parc/certificat-cession'], requireAuth, async (req, res) => {";
lines[1407] = "  try {";
lines[1408] = "    const parc = req.params.parc;";
lines[1409] = "    const cert = await prisma.vehicleCessionCertificate.findUnique({";
lines[1410] = "      where: { parc }";

// Reconstruct to find exact replacement
const getStart = lines.findIndex((l, i) => i >= 1406 && l.includes("app.get(['/vehicles/:parc/certificat-cession'"));
const getEnd = lines.findIndex((l, i) => i > getStart && l.includes("});") && lines[i-1].includes("imported: false"));

console.log('GET endpoints found:', getStart, getEnd);
console.log('Lines:', getStart >= 0 ? lines.slice(getStart, Math.min(getEnd + 1, getStart + 10)) : 'NOT FOUND');

// Replace POST similarly
const postStart = lines.findIndex((l, i) => i > getEnd && l.includes("app.post(['/vehicles/:parc/certificat-cession'"));
const postEnd = lines.findIndex((l, i) => i > postStart && l.includes("});") && lines[i-1].includes("res.json(cert)"));

console.log('POST endpoints found:', postStart, postEnd);

if (getStart < 0 || postStart < 0) {
  console.error('❌ Could not find endpoints');
  process.exit(1);
}

// Replace GET endpoint lines
lines.splice(getStart, getEnd - getStart + 1, 
  "app.get(['/vehicles/:parc/certificat-cession','/api/vehicles/:parc/certificat-cession'], requireAuth, async (req, res) => {",
  "  try {",
  "    const parc = req.params.parc;",
  "    const cert = await prisma.vehicleCessionCertificate.findUnique({",
  "      where: { parc }",
  "    });",
  "    res.json(cert || { parc, certificatePath: null, dateImport: null, notes: '', imported: false });",
  "  } catch (e) {",
  "    console.error('Erreur lecture cession:', e);",
  "    res.status(500).json({ error: e.message });",
  "  }",
  "});"
);

// Recalculate postStart after splice
const newPostStart = lines.findIndex((l, i) => i > getStart + 12 && l.includes("app.post(['/vehicles/:parc/certificat-cession'"));
const newPostEnd = lines.findIndex((l, i) => i > newPostStart && l.includes("});") && lines[i-1].includes("res.json(cert)"));

// Replace POST endpoint lines
lines.splice(newPostStart, newPostEnd - newPostStart + 1,
  "app.post(['/vehicles/:parc/certificat-cession','/api/vehicles/:parc/certificat-cession'], requireAuth, async (req, res) => {",
  "  try {",
  "    const parc = req.params.parc;",
  "    ",
  "    // Vérifier si déjà importé",
  "    const existing = await prisma.vehicleCessionCertificate.findUnique({",
  "      where: { parc }",
  "    });",
  "    ",
  "    if (existing && existing.imported) {",
  "      return res.status(400).json({ error: 'Certificate already imported for this vehicle' });",
  "    }",
  "    ",
  "    const { certificatePath, notes } = req.body;",
  "    ",
  "    const cert = await prisma.vehicleCessionCertificate.upsert({",
  "      where: { parc },",
  "      update: {",
  "        certificatePath,",
  "        notes: notes || '',",
  "        dateImport: new Date(),",
  "        imported: true",
  "      },",
  "      create: {",
  "        id: uid(),",
  "        parc,",
  "        certificatePath,",
  "        notes: notes || '',",
  "        dateImport: new Date(),",
  "        imported: true",
  "      }",
  "    });",
  "    ",
  "    res.json(cert);",
  "  } catch (e) {",
  "    console.error('Erreur sauvegarde cession:', e);",
  "    res.status(500).json({ error: e.message });",
  "  }",
  "});"
);

fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
console.log('✅ Fixed certificat-cession endpoints to use Prisma');
