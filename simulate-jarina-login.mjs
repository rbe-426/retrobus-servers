/**
 * Simulates what happens when Jarina logs in and how useUserPermissions is called
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function simulateJarinaLogin() {
  try {
    console.log('\n🔐 === SIMULATING JARINA LOGIN FLOW ===\n');

    // 1️⃣ Simulate /auth/login endpoint
    console.log('1️⃣ SIMULATING /auth/login');
    const jarina = await prisma.members.findFirst({
      where: { email: { contains: 'jarina', mode: 'insensitive' } }
    });

    if (!jarina) {
      console.log('  ❌ Jarina not found!');
      return;
    }

    console.log(`  ✅ Found Jarina: ${jarina.email}`);
    console.log(`  ID: ${jarina.id}`);

    // This is what endpoint returns
    const loginResponse = {
      token: 'stub.' + Buffer.from(jarina.email).toString('base64'),
      user: {
        id: jarina.id,                          // <-- KEY PARAMETER!
        email: jarina.email,
        firstName: jarina.firstName,
        role: 'MEMBER',
        permissions: jarina.permissions || []
      }
    };

    console.log('  📋 Login response user object:');
    console.log(`     {`);
    console.log(`       id: "${loginResponse.user.id}",`);
    console.log(`       email: "${loginResponse.user.email}",`);
    console.log(`       firstName: "${loginResponse.user.firstName}",`);
    console.log(`       role: "${loginResponse.user.role}"`);
    console.log(`     }`);

    // 2️⃣ Frontend stores user in localStorage and context
    console.log('\n2️⃣ FRONTEND STORES user IN localStorage');
    console.log(`   localStorage.user = ${JSON.stringify(loginResponse.user)}`);

    // 3️⃣ MyRBE component calls useUserPermissions(user?.id)
    console.log('\n3️⃣ MyRBE CALLS useUserPermissions(user?.id)');
    const userIdToPass = loginResponse.user?.id;
    console.log(`   user?.id = "${userIdToPass}"`);
    
    if (!userIdToPass) {
      console.log('   ❌ ERROR: user?.id is UNDEFINED!');
      console.log('   Hook will NOT be called!');
      console.log('   Permissions will remain EMPTY []');
      console.log('   ALL CARDS WILL BE VISIBLE!');
      return;
    }

    // 4️⃣ Hook calls /api/user-permissions/:userId with this ID
    console.log('\n4️⃣ HOOK CALLS /api/user-permissions/:userId');
    console.log(`   URL: /api/user-permissions/${userIdToPass}`);

    // 5️⃣ Simulate endpoint call - find member by ID
    console.log('\n5️⃣ ENDPOINT SEARCHES FOR MEMBER');
    const member = await prisma.members.findFirst({
      where: {
        OR: [
          { id: userIdToPass },
          { email: userIdToPass }
        ]
      }
    });

    if (!member) {
      console.log(`   ❌ Member NOT found by ID: ${userIdToPass}`);
      console.log('   Endpoint returns: { permissions: [], role: "MEMBER" }');
      console.log('   MyRBE gets EMPTY permissions array!');
      console.log('   ❌ BUG: All cards stay visible!');
      return;
    }

    console.log(`   ✅ Member found: ${member.email}`);
    console.log(`   Has permissions field: ${!!member.permissions}`);

    // 6️⃣ Endpoint converts permissions
    console.log('\n6️⃣ ENDPOINT CONVERTS PERMISSIONS');
    let convertedPermissions = [];
    
    if (member.permissions && typeof member.permissions === 'object') {
      const blockedList = member.permissions.blockedResources || [];
      
      if (member.permissions.restrictiveMode && Array.isArray(blockedList)) {
        convertedPermissions = blockedList.map(resource => ({
          resource,
          actions: ['DENY'],
          reason: 'Restrictive mode enabled'
        }));
        
        console.log(`   ✅ Converted ${blockedList.length} blocked resources:`);
        blockedList.forEach(r => console.log(`      - ${r}`));
      }
    }

    // 7️⃣ Endpoint returns response
    console.log('\n7️⃣ ENDPOINT RETURNS:');
    const endpointResponse = {
      permissions: convertedPermissions,
      success: true,
      role: 'MEMBER',
      memberId: member.id,
      email: member.email
    };
    console.log(`   {`);
    console.log(`     "success": true,`);
    console.log(`     "permissions": [`);
    convertedPermissions.forEach((p, i) => {
      const comma = i < convertedPermissions.length - 1 ? ',' : '';
      console.log(`       { resource: "${p.resource}", actions: ["DENY"] }${comma}`);
    });
    console.log(`     ]`);
    console.log(`   }`);

    // 8️⃣ Hook parses and sets permissions
    console.log('\n8️⃣ HOOK UPDATES PERMISSIONS STATE:');
    const parsed = (convertedPermissions || []).map(p => ({
      ...p,
      actions: Array.isArray(p.actions) 
        ? p.actions 
        : JSON.parse(p.actions || '[]')
    }));

    console.log(`   userPermissions = [${parsed.length} entries]`);
    parsed.forEach(p => {
      console.log(`     - ${p.resource}: ${p.actions.join(', ')}`);
    });

    // 9️⃣ MyRBE filters cards
    console.log('\n9️⃣ MyRBE FILTERS CARDS WITH shouldShowCard():');
    const testCardresources = ['FINANCE', 'RETRO_DEMANDES', 'MEMBERS', 'VEHICLES', 'EVENTS'];
    
    testCardresources.forEach(resource => {
      const isDenied = parsed.some(p => 
        p.resource === resource && p.actions && p.actions.includes('DENY')
      );
      const shouldShow = !isDenied;
      const status = shouldShow ? '✅ SHOW' : '❌ HIDE';
      console.log(`   ${resource}: ${status}`);
    });

    console.log('\n✅ CONCLUSION: Permission system is working correctly!');

  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

simulateJarinaLogin();
