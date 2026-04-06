import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function diagnoseJarina() {
  try {
    console.log('\n🔍 === DIAGNOSTIC JARINA PERMISSIONS ===\n');

    // 1️⃣ Search for Jarina as MEMBER
    console.log('1️⃣ Searching for Jarina in MEMBERS table...');
    const jarinaAsMember = await prisma.members.findFirst({
      where: {
        email: { contains: 'jarina', mode: 'insensitive' }
      }
    });
    
    if (jarinaAsMember) {
      console.log(`  ✅ Found Jarina in members: ${jarinaAsMember.email}`);
      console.log(`     - ID: ${jarinaAsMember.id}`);
      console.log(`     - permissions field: ${jarinaAsMember.permissions ? 'EXISTS' : 'EMPTY'}`);
      if (jarinaAsMember.permissions) {
        console.log(`     - content: ${JSON.stringify(jarinaAsMember.permissions)}`);
      }
    } else {
      console.log(`  ❌ NOT found in members table`);
    }

    // 2️⃣ Search for Jarina as SITE_USER
    console.log('\n2️⃣ Searching for Jarina in SITE_USERS table...');
    const jarinaAsSiteUser = await prisma.site_users.findFirst({
      where: {
        OR: [
          { email: { contains: 'jarina', mode: 'insensitive' } },
          { username: { contains: 'jarina', mode: 'insensitive' } }
        ]
      }
    });
    
    if (jarinaAsSiteUser) {
      console.log(`  ✅ Found Jarina in site_users: ${jarinaAsSiteUser.email}`);
      console.log(`     - ID: ${jarinaAsSiteUser.id}`);
      console.log(`     - role: ${jarinaAsSiteUser.role}`);
      console.log(`     - custom Permissions: ${jarinaAsSiteUser.customPermissions ? 'EXISTS' : 'EMPTY'}`);
      console.log(`     - linkedMemberId: ${jarinaAsSiteUser.linkedMemberId || 'NOT SET'}`);
      if (jarinaAsSiteUser.customPermissions) {
        console.log(`     - content: ${JSON.stringify(jarinaAsSiteUser.customPermissions)}`);
      }

      // 3️⃣ Load USER_PERMISSIONS for this site_user
      console.log(`\n3️⃣ Loading USER_PERMISSIONS for site_user ID ${jarinaAsSiteUser.id}...`);
      const userPerms = await prisma.user_permissions.findMany({
        where: { userId: jarinaAsSiteUser.id }
      });
      
      if (userPerms.length > 0) {
        console.log(`  ✅ Found ${userPerms.length} permissions:`);
        userPerms.forEach(p => {
          const actions = Array.isArray(p.actions) ? p.actions : JSON.parse(p.actions || '[]');
          console.log(`     - ${p.resource}: ${actions.join(', ')}`);
        });
      } else {
        console.log(`  ❌ NO user_permissions found!`);
      }
    } else {
      console.log(`  ❌ NOT found in site_users table`);
    }

    // 4️⃣ Simulate what /api/user-permissions endpoint would return
    console.log('\n4️⃣ SIMULATING /api/user-permissions call...');
    console.log(`   What would endpoint return if passed userId: Jarina's member ID?`);
    
    if (jarinaAsMember && jarinaAsSiteUser) {
      const linkedSiteUser = await prisma.site_users.findFirst({
        where: { linkedMemberId: jarinaAsMember.id }
      });
      
      if (linkedSiteUser) {
        console.log(`  ✅ site_user linked to member: ${linkedSiteUser.email}`);
        
        const linkedPerms = await prisma.user_permissions.findMany({
          where: { userId: linkedSiteUser.id }
        });
        
        console.log(`  Got ${linkedPerms.length} permissions from user_permissions table`);
      } else {
        console.log(`  ❌ NO site_user linked to this member!`);
      }
    }

    console.log('\n5️⃣ PROBLEM ANALYSIS:');
    if (jarinaAsSiteUser && !jarinaAsMember) {
      console.log(`  ⚠️  Jarina is a site_user BUT NOT a member`);
      console.log(`     → /api/user-permissions endpoint searches for MEMBERS first!`);
      console.log(`     → It won't find Jarina's permissions!`);
    } else if (!jarinaAsSiteUser && jarinaAsMember) {
      console.log(`  ⚠️  Jarina is a member BUT NOT a site_user`);
      console.log(`     → Her permissions aren't being checked!`);
    } else if (jarinaAsSiteUser && jarinaAsMember) {
      console.log(`  ✅ Jarina exists in both tables`);
      console.log(`     Checking if linkedMemberId is correct...`);
      if (jarinaAsSiteUser.linkedMemberId !== jarinaAsMember.id) {
        console.log(`     ⚠️  linkedMemberId mismatch!`);
        console.log(`        site_user.linkedMemberId: ${jarinaAsSiteUser.linkedMemberId}`);
        console.log(`        actual member.id: ${jarinaAsMember.id}`);
      }
    }

  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

diagnoseJarina();
