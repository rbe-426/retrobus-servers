import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  const cts = await prisma.vehicleControlTechnique.findMany();
  console.log('Contrôles techniques in Prisma:');
  console.log(JSON.stringify(cts, null, 2));
  process.exit(0);
} catch (e) {
  console.error('Error:', e.message);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
