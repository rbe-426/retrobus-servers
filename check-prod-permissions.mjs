/**
 * Check Jarina and other restricted users' permissions in PRODUCTION database (Railway)
 */

import { PrismaClient } from '@prisma/client';

// Use the production connection string from .env
const prisma = new PrismaClient();

async function checkProductionPermissions() {
  try {
    console.log('\n🌐 === CHECKING PRODUCTION (RAILWAY) PERMISSIONS ===\n');

    // Get all restricted users from members table
    console.log('📋 CHECKING MEMBERS TABLE FOR RESTRICTED USERS:\n');

    const restrictedEmails = ['jarina', 'nour', 'jaffer', 'methu', 'rbe'];

    for (const emailPat of restrictedEmails) {
      const user = await prisma.members.findFirst({
        where: {
          email: { contains: emailPat, mode: 'insensitive' }
        }
      });

      if (user) {
        console.log(`\n${user.email}:`);
        console.log(`  ID: ${user.id}`);
        console.log(`  Permissions:`, user.permissions ? 'EXISTS' : 'NONE');
        
        if (user.permissions) {
          const perms = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
          if (perms.blockedResources) {
            console.log(`  Blocked Resources: ${perms.blockedResources.length}`);
            perms.blockedResources.forEach(r => console.log(`    - ${r}`));
          } else if (perms.deniedResources) {
            console.log(`  Denied Resources: ${perms.deniedResources.length}`);
            perms.deniedResources.forEach(r => console.log(`    - ${r}`));
          }
        }
      } else {
        console.log(`\n❌ NOT found: ${emailPat}`);
      }
    }

    // Also check site_users
    console.log('\n\n📋 CHECKING SITE_USERS TABLE:\n');

    const siteUsers = await prisma.site_users.findMany({
      where: {
        OR: [
          { email: { contains: 'jarina', mode: 'insensitive' } },
          { email: { contains: 'jaffer', mode: 'insensitive' } },
          { email: { contains: 'methu', mode: 'insensitive' } },
          { email: { contains: 'nour', mode: 'insensitive' } }
        ]
      }
    });

    if (siteUsers.length > 0) {
      console.log(`Found ${siteUsers.length} site_users:\n`);
      for (const user of siteUsers) {
        console.log(`${user.email}:`);
        console.log(`  Role: ${user.role}`);
        console.log(`  customPermissions:`, user.customPermissions ? 'EXISTS' : 'NONE');
        if (user.customPermissions) {
          const perms = typeof user.customPermissions === 'string' ? JSON.parse(user.customPermissions) : user.customPermissions;
          if (perms.blockedResources) {
            console.log(`  Blocked: ${perms.blockedResources.join(', ')}`);
          }
        }
      }
    } else {
      console.log('❌ No site_users found for these names');
    }

  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkProductionPermissions();
