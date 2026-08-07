import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debug() {
  console.log('=== MEMBERS (Adhérents) ===');
  const members = await prisma.members.findMany();
  console.log(`Total: ${members.length} adhérents\n`);
  members.forEach(m => {
    console.log(`ID: ${m.id}`);
    console.log(`  Email: ${m.email}`);
    console.log(`  Matricule: ${m.matricule}`);
    console.log(`  Prénom: ${m.firstName}`);
    console.log(`  Nom: ${m.lastName}`);
    console.log(`  Mot de passe (premiers 30 chars): ${m.password?.substring(0, 30) || 'NULL'}`);
    console.log(`  isPasswordTemporary: ${m.isPasswordTemporary}`);
    console.log(`  loginEnabled: ${m.loginEnabled}`);
    console.log('');
  });

  console.log('\n=== SITE_USERS (Administrateurs) ===');
  const users = await prisma.site_users.findMany();
  console.log(`Total: ${users.length} administrateurs\n`);
  users.forEach(u => {
    console.log(`ID: ${u.id}`);
    console.log(`  Username: ${u.username}`);
    console.log(`  Email: ${u.email}`);
    console.log(`  Prénom: ${u.firstName}`);
    console.log(`  Nom: ${u.lastName}`);
    console.log(`  Mot de passe (premiers 30 chars): ${u.password?.substring(0, 30) || 'NULL'}`);
    console.log(`  Role: ${u.role}`);
    console.log(`  isActive: ${u.isActive}`);
    console.log(`  hasInternalAccess: ${u.hasInternalAccess}`);
    console.log(`  hasExternalAccess: ${u.hasExternalAccess}`);
    console.log(`  linkedMemberId: ${u.linkedMemberId || 'none'}`);
    console.log('');
  });

  await prisma.$disconnect();
}

debug().catch(console.error);
