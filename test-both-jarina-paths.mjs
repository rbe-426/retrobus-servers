/**
 * Test both login paths for Jarina and verify permissions
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testBothJarinaLogins() {
  try {
    console.log('\n🔐 === TESTING BOTH JARINA LOGIN PATHS ===\n');

    // PATH 1: Login with jarina.amolot@gmail.com (MEMBER email)
    console.log('PATH 1️⃣: LOGIN WITH jarina.amolot@gmail.com');
    console.log('═══════════════════════════════════════════\n');

    const jarinaAsMember = await prisma.members.findFirst({
      where: { email: { contains: 'jarina.amolot@gmail.com', mode: 'insensitive' } }
    });

    if (jarinaAsMember) {
      console.log('✅ MEMBER FOUND:');
      console.log(`   Email: ${jarinaAsMember.email}`);
      console.log(`   ID: ${jarinaAsMember.id}`);
      console.log(`   Permissions: ${jarinaAsMember.permissions ? 'YES' : 'NO'}`);
      
      if (jarinaAsMember.permissions) {
        const perms = typeof jarinaAsMember.permissions === 'string' 
          ? JSON.parse(jarinaAsMember.permissions) 
          : jarinaAsMember.permissions;
        console.log(`   Blocked Resources: ${perms.blockedResources?.length || 0}`);
        if (perms.blockedResources) {
          perms.blockedResources.forEach(r => console.log(`     - ${r}`));
        }
      }

      console.log('\n📋 ENDPOINT /api/user-permissions/:userId WOULD RETURN:');
      if (jarinaAsMember.permissions) {
        const blockedList = jarinaAsMember.permissions.blockedResources || [];
        const converted = blockedList.map(r => ({ resource: r, actions: ['DENY'] }));
        console.log(`   ✅ ${converted.length} DENY permissions`);
        converted.forEach(p => console.log(`      - ${p.resource}`));
      }
    } else {
      console.log('❌ MEMBER NOT FOUND');
    }

    // PATH 2: Login with j.amolot@retrobus-essonne.fr (SITE_USER email)
    console.log('\n\nPATH 2️⃣: LOGIN WITH j.amolot@retrobus-essonne.fr');
    console.log('═══════════════════════════════════════════\n');

    const jarinaAsSiteUser = await prisma.site_users.findFirst({
      where: { email: 'j.amolot@retrobus-essonne.fr' }
    });

    if (jarinaAsSiteUser) {
      console.log('✅ SITE_USER FOUND:');
      console.log(`   Email: ${jarinaAsSiteUser.email}`);
      console.log(`   ID: ${jarinaAsSiteUser.id}`);
      console.log(`   Role: ${jarinaAsSiteUser.role}`);
      console.log(`   customPermissions: ${jarinaAsSiteUser.customPermissions ? 'YES' : 'NO'}`);
      
      if (jarinaAsSiteUser.customPermissions) {
        const perms = typeof jarinaAsSiteUser.customPermissions === 'string' 
          ? JSON.parse(jarinaAsSiteUser.customPermissions) 
          : jarinaAsSiteUser.customPermissions;
        console.log(`   Blocked Resources: ${perms.blockedResources?.length || 0}`);
        if (perms.blockedResources) {
          perms.blockedResources.forEach(r => console.log(`     - ${r}`));
        }
      }

      // /auth/login endpoint would return member.id OR site_user.id depending on login type
      console.log('\n🤔 PROBLEM: Which ID does /auth/login return?');
      console.log(`   - If using site_users: ${jarinaAsSiteUser.id}`);
      console.log(`   - If using members: Would search for member with email "${jarinaAsSiteUser.email}"`);
      
      // Try to find member with site_user email
      const linkedMember = await prisma.members.findFirst({
        where: { email: jarinaAsSiteUser.email }
      });

      if (linkedMember) {
        console.log(`\n✅ FOUND LINKED MEMBER:`);
        console.log(`   Email: ${linkedMember.email}`);
        console.log(`   ID: ${linkedMember.id}`);
      } else {
        console.log(`\n❌ NO MEMBER with email: ${jarinaAsSiteUser.email}`);
        console.log(`   This means /api/user-permissions endpoint would FAIL`);
      }
    } else {
      console.log('❌ SITE_USER NOT FOUND');
    }

    // SUMMARY
    console.log('\n\n📊 === SUMMARY ===\n');
    console.log('CRITICAL ISSUE:');
    console.log('Jarina has TWO DIFFERENT EMAIL ADDRESSES:');
    console.log('  • In members table: jarina.amolot@gmail.com');
    console.log('  • In site_users table: j.amolot@retrobus-essonne.fr');
    console.log('\nLogging in with jarina.amolot@gmail.com:');
    console.log('  ✅ Gets member.id, calls /api/user-permissions');
    console.log('  ✅ Permissions are applied correctly');
    console.log('\nLogging in with j.amolot@retrobus-essonne.fr:');
    console.log('  ⚠️  Endpoint tries to find member with that email');
    console.log('  ❌ Fails because member email is different');
    console.log('  ❌ Returns empty permissions array');
    console.log('  ❌ All cards become visible!');

  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

testBothJarinaLogins();
