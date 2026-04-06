import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function simulateEndpoint() {
  try {
    console.log('\n🧪 === SIMULATING /api/user-permissions ENDPOINT ===\n');

    // Simulate calling /api/user-permissions with Jarina's member ID
    const jarina = await prisma.members.findFirst({
      where: { email: { contains: 'jarina', mode: 'insensitive' } }
    });

    console.log('1️⃣ JARINA DATA:');
    console.log(`   Email: ${jarina.email}`);
    console.log(`   ID: ${jarina.id}`);
    console.log(`   Permissions field type: ${typeof jarina.permissions}`);
    console.log(`   Permissions:`, jarina.permissions);

    // Simulate endpoint logic
    console.log('\n2️⃣ ENDPOINT LOGIC:');
    
    let convertedPermissions = [];
    
    if (jarina.permissions && typeof jarina.permissions === 'object') {
      const blockedList = jarina.permissions.blockedResources || jarina.permissions.deniedResources || [];
      
      if (jarina.permissions.restrictiveMode && Array.isArray(blockedList)) {
        convertedPermissions = blockedList.map(resource => ({
          resource,
          actions: ['DENY'],
          reason: 'Restrictive mode enabled'
        }));
        
        console.log(`   ✅ Converted ${blockedList.length} permissions:`);
        convertedPermissions.forEach(p => {
          console.log(`      - ${p.resource}: DENY`);
        });
      } else {
        console.log('   ❌ NOT converted because:');
        console.log(`      - restrictiveMode: ${jarina.permissions.restrictiveMode}`);
        console.log(`      - Array.isArray(blockedList): ${Array.isArray(blockedList)}`);
      }
    }

    // Check for site_user link
    console.log('\n3️⃣ CHECKING SITE_USER LINK:');
    const linkedSiteUser = await prisma.site_users.findFirst({
      where: { linkedMemberId: jarina.id }
    });
    
    if (linkedSiteUser) {
      console.log(`   ✅ Found linked site_user: ${linkedSiteUser.email}`);
      
      const dbPerms = await prisma.user_permissions.findMany({
        where: { userId: linkedSiteUser.id }
      });
      console.log(`   Found ${dbPerms.length} user_permissions entries`);
    } else {
      console.log(`   ❌ NO linked site_user (Jarina is just a member)`);
    }

    // Final response
    console.log('\n4️⃣ ENDPOINT WOULD RETURN:');
    console.log(JSON.stringify({
      permissions: convertedPermissions,
      success: true,
      role: 'MEMBER',
      memberId: jarina.id,
      email: jarina.email
    }, null, 2));

    // Test MyRBE logic
    console.log('\n5️⃣ TESTING MyRBE.jsx FILTER LOGIC:');
    const testCard = {
      title: "Gestion Financière",
      resource: "FINANCE"
    };

    const isDenied = convertedPermissions.some(p => 
      p.resource === testCard.resource && p.actions && p.actions.includes('DENY')
    );

    console.log(`   Card: ${testCard.title}`);
    console.log(`   Resource: ${testCard.resource}`);
    console.log(`   Has DENY permission: ${isDenied}`);
    console.log(`   Should show card: ${!isDenied ? '✅ YES' : '❌ NO (should be hidden)'}`);

  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

simulateEndpoint();
