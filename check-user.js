import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  console.log('=== Cherche RBE dans MEMBERS ===');
  const member = await prisma.members.findFirst({
    where: { matricule: 'RBE' }
  });
  console.log(member ? '✅ Trouvé' : '❌ Pas trouvé');
  if (member) console.table({
    matricule: member.matricule,
    email: member.email,
    password: member.password?.substring(0, 30) + '...',
    isPasswordTemporary: member.isPasswordTemporary
  });

  console.log('\n=== Cherche RBE dans SITE_USERS ===');
  const user = await prisma.site_users.findFirst({
    where: { username: 'RBE' }
  });
  console.log(user ? '✅ Trouvé' : '❌ Pas trouvé');
  if (user) console.table({
    username: user.username,
    email: user.email,
    password: user.password?.substring(0, 30) + '...',
    mustChangePassword: user.mustChangePassword
  });

  await prisma.$disconnect();
}

check().catch(console.error);
