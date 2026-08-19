/**
 * Search for Jaffer and Methusan anywhere in the production database
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findRestrictedUsers() {
  try {
    console.log('\n🔍 === SEARCHING FOR JAFFER AND METHUSAN EVERYWHERE ===\n');

    // In members
    console.log('1️⃣ SEARCHING IN MEMBERS TABLE:');
    const membersJaffer = await prisma.members.findMany({
      where: {
        OR: [
          { email: { contains: 'jaffer', mode: 'insensitive' } },
          { matricule: { contains: 'jaffer', mode: 'insensitive' } }
        ]
      }
    });
    console.log(`   Found ${membersJaffer.length} members with "jaffer"`);
    membersJaffer.forEach(m => console.log(`     - ${m.email} (${m.id})`));

    const membersMethu = await prisma.members.findMany({
      where: {
        OR: [
          { email: { contains: 'methu', mode: 'insensitive' } },
          { matricule: { contains: 'methu', mode: 'insensitive' } }
        ]
      }
    });
    console.log(`   Found ${membersMethu.length} members with "methu"`);
    membersMethu.forEach(m => console.log(`     - ${m.email} (${m.id})`));

    // In site_users
    console.log('\n2️⃣ SEARCHING IN SITE_USERS TABLE:');
    const siteUsersJaffer = await prisma.site_users.findMany({
      where: {
        OR: [
          { email: { contains: 'jaffer', mode: 'insensitive' } },
          { username: { contains: 'jaffer', mode: 'insensitive' } }
        ]
      }
    });
    console.log(`   Found ${siteUsersJaffer.length} site_users with "jaffer"`);
    siteUsersJaffer.forEach(u => {
      console.log(`     - ${u.email} (${u.id})`);
      console.log(`       customPermissions:`, u.customPermissions ? 'YES' : 'NO');
    });

    const siteUsersMethu = await prisma.site_users.findMany({
      where: {
        OR: [
          { email: { contains: 'methu', mode: 'insensitive' } },
          { username: { contains: 'methu', mode: 'insensitive' } }
        ]
      }
    });
    console.log(`   Found ${siteUsersMethu.length} site_users with "methu"`);
    siteUsersMethu.forEach(u => {
      console.log(`     - ${u.email} (${u.id})`);
      console.log(`       customPermissions:`, u.customPermissions ? 'YES' : 'NO');
    });

    // 3️⃣ Get ALL site_users to see what's there
    console.log('\n3️⃣ LISTING ALL SITE_USERS:');
    const allSiteUsers = await prisma.site_users.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        customPermissions: true
      }
    });

    console.log(`   Total site_users in database: ${allSiteUsers.length}`);
    allSiteUsers.forEach(u => {
      console.log(`\n   • ${u.email}`);
      console.log(`     ID: ${u.id}`);
      console.log(`     customPermissions: ${u.customPermissions ? 'HAS' : 'NONE'}`);
      if (u.customPermissions) {
        const perms = typeof u.customPermissions === 'string' ? JSON.parse(u.customPermissions) : u.customPermissions;
        if (perms.blockedResources) {
          console.log(`     Blocked: ${perms.blockedResources.join(', ')}`);
        }
      }
    });

  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

findRestrictedUsers();
