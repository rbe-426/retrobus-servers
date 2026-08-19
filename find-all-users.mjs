import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findAllUsers() {
  try {
    console.log('\n🔍 === FINDING ALL USERS WITH PERMISSIONS ===\n');

    // Get all site_users with permissions
    console.log('📋 SITE_USERS with customPermissions:');
    const siteUsers = await prisma.site_users.findMany();
    
    for (const user of siteUsers) {
      if (user.customPermissions || user.email.includes('jaffer') || user.email.includes('methu') || user.email.includes('jarina')) {
        console.log(`\n  • ${user.email} (ID: ${user.id})`);
        console.log(`    role: ${user.role}`);
        console.log(`    customPermissions:`, typeof user.customPermissions === 'string' ? JSON.parse(user.customPermissions) : user.customPermissions);
      }
    }

    console.log('\n\n📋 MEMBERS with customPermissions/permissions:');
    const members = await prisma.members.findMany();

    for (const member of members) {
      if (member.permissions || member.email.includes('jaffer') || member.email.includes('methu') || member.email.includes('jarina') || member.email.includes('nour')) {
        console.log(`\n  • ${member.email} (ID: ${member.id})`);
        if (member.permissions) {
          const perms = typeof member.permissions === 'string' ? JSON.parse(member.permissions) : member.permissions;
          console.log(`    permissions:`, perms);
        } else {
          console.log(`    permissions: NONE`);
        }
      }
    }

  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

findAllUsers();
