require('dotenv').config({ quiet: true });
const fs = require('fs');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const version = '26.11.014';
const notes = 'Nouvelle interface InéoRBE : identification conducteur et service, écran de course (ligne, arrêts, retard, DEPART), perte de connexion.';
(async () => {
  const data = fs.readFileSync('../console-android/app/build/outputs/apk/debug/app-debug.apk');
  const sha256 = crypto.createHash('sha256').update(data).digest('hex');
  const fields = { fileName: `Ineo-Console-${version}.apk`, size: data.length, sha256, notes, data };
  await prisma.ineoDesktopRelease.upsert({ where: { product_version: { product: 'CONSOLE', version } }, create: { product: 'CONSOLE', version, ...fields }, update: fields });
  await prisma.changelog.create({ data: { title: `Inéo RBE Console - version ${version}`, version, changes: ['Nouvelle interface de la console d\'après les maquettes InéoRBE', 'Écrans : démarrage, identification conducteur et service (réussie, échouée, refusée), perte de connexion, course'] } });
  console.log(version, data.length, sha256);
  await prisma.$disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
