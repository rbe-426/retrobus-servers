require('dotenv').config();
const fs = require('fs');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const data = fs.readFileSync('C:\\Dev\\RETROBUS_ESSONNE\\In\u00e9oRBE exe\\artifacts\\In\u00e9oR\u00e9troBus-Maintenance-Setup.exe');
  const sha256 = crypto.createHash('sha256').update(data).digest('hex');
  const notes = 'Splashscreen : le logo occupe presque tout l\'\u00e9cran (hors barre de chargement).';
  const row = await p.ineoDesktopRelease.upsert({
    where: { product_version: { product: 'MAINTENANCE', version: '26.11.006' } },
    update: { data, size: data.length, sha256, notes },
    create: { product: 'MAINTENANCE', version: '26.11.006', fileName: 'Ineo-Maintenance-Setup-26.11.006.exe', size: data.length, sha256, notes, data, createdBy: 'publication' },
    select: { id: true, version: true, size: true, sha256: true },
  });
  console.log(JSON.stringify(row));
  const c = await p.changelog.create({ data: { title: 'In\u00e9o R\u00e9troBus Maintenance - version 26.11.006', version: '26.11.006', changes: [notes] } });
  console.log('changelog', c.id);
  await p.$disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
