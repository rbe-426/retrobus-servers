require('dotenv').config();
const fs = require('fs');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const dir = 'C:\\Dev\\RETROBUS_ESSONNE\\In\u00e9oRBE exe\\artifacts\\';
const items = [
  { product: 'UC', version: '26.11.003', file: 'In\u00e9oR\u00e9troBus-Setup.exe', fileName: 'Ineo-Retrobus-Setup-26.11.003.exe', title: 'In\u00e9o R\u00e9troBus (logiciel UC) - version 26.11.003',
    notes: 'Mise \u00e0 jour de l\'UC \u00e0 distance depuis l\'outil Maintenance (commande de mise \u00e0 jour par Wi-Fi ou USB-USB).' },
  { product: 'MAINTENANCE', version: '26.11.002', file: 'In\u00e9oR\u00e9troBus-Maintenance-Setup.exe', fileName: 'Ineo-Maintenance-Setup-26.11.002.exe', title: 'In\u00e9o R\u00e9troBus Maintenance - version 26.11.002',
    notes: 'Bouton \u00ab Mettre \u00e0 jour l\'UC \u00bb (mise \u00e0 jour \u00e0 distance) ; splashscreen aux couleurs RBE (fond #0F172A, rouge #9F063A) avec logo.' },
];
(async () => {
  for (const it of items) {
    const data = fs.readFileSync(dir + it.file);
    const sha256 = crypto.createHash('sha256').update(data).digest('hex');
    const row = await p.ineoDesktopRelease.upsert({
      where: { product_version: { product: it.product, version: it.version } },
      update: { data, size: data.length, sha256, notes: it.notes },
      create: { product: it.product, version: it.version, fileName: it.fileName, size: data.length, sha256, notes: it.notes, data, createdBy: 'publication' },
      select: { id: true, product: true, version: true, size: true, sha256: true },
    });
    console.log('release', JSON.stringify(row));
    const exists = await p.changelog.findFirst({ where: { title: it.title, version: it.version } });
    if (!exists) console.log('changelog', (await p.changelog.create({ data: { title: it.title, version: it.version, changes: [it.notes] } })).id);
  }
  await p.$disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
