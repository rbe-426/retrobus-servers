import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const normalizeDescription = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toUpperCase();

try {
  const transactions = await prisma.finance_transactions.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, type: true, amount: true, description: true, date: true }
  });
  const signatures = new Set();
  const duplicateIds = [];

  for (const transaction of transactions) {
    const signature = [
      transaction.date.toISOString().slice(0, 10),
      transaction.type,
      Number(transaction.amount).toFixed(2),
      normalizeDescription(transaction.description)
    ].join('|');

    if (signatures.has(signature)) {
      duplicateIds.push(transaction.id);
    } else {
      signatures.add(signature);
    }
  }

  const result = duplicateIds.length > 0
    ? await prisma.finance_transactions.deleteMany({ where: { id: { in: duplicateIds } } })
    : { count: 0 };

  console.log(`Transactions avant nettoyage : ${transactions.length}`);
  console.log(`Doublons supprimés : ${result.count}`);
  console.log(`Transactions restantes : ${transactions.length - result.count}`);
} finally {
  await prisma.$disconnect();
}