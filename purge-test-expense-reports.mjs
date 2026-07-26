import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

const removeFile = async (directory, value) => {
  const fileName = path.basename(String(value || ''));
  if (!fileName || fileName === '.') return;
  await fs.rm(path.join(directory, fileName), { force: true });
};

try {
  const reports = await prisma.finance_expense_reports.findMany({
    select: { fileUrl: true, attachmentUrl: true, transferProofStoredName: true }
  });

  for (const report of reports) {
    await removeFile(path.join(process.cwd(), 'uploads'), report.fileUrl);
    await removeFile(path.join(process.cwd(), 'uploads'), report.attachmentUrl);
    await removeFile(path.join(process.cwd(), 'private_uploads', 'ndf-transfer-proofs'), report.transferProofStoredName);
  }

  const result = await prisma.finance_expense_reports.deleteMany({});
  console.log(`NDF supprimees: ${result.count}`);
} finally {
  await prisma.$disconnect();
}