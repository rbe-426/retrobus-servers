import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkConfig() {
  const configs = await prisma.retromerch_site_config.findMany();
  
  console.log('\n📊 Configurations en base de données:\n');
  console.log(JSON.stringify(configs, null, 2));
  
  await prisma.$disconnect();
}

checkConfig();
