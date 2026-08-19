/**
 * Simulate EXACT flow: Jarina logs in with matricule j.amolot
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testJarinaFullFlow() {
  try {
    console.log('\n🔐 === JARINA FULL LOGIN FLOW (with matricule j.amolot) ===\n');

    // STEP 1: /auth/member-login endpoint
    console.log('STEP 1️⃣: POST /auth/member-login');
    console.log('   Body: { identifier: "j.amolot", password: "..." }');
    
    const member = await prisma.members.findFirst({
      where: {
        OR: [
          { matricule: 'j.amolot' },
          { email: 'j.amolot' },
          { email: { startsWith: 'j.amolot' } }
        ]
      }
    });

    if (!member) {
      console.log('   ❌ ERROR: Member not found!');
      return;
    }

    console.log(`   ✅ Member found: ${member.email}`);
    console.log(`      Matricule: ${member.matricule}`);
    console.log(`      ID: ${member.id}`);

    // STEP 2: Login returns
    console.log('\nSTEP 2️⃣: Endpoint returns');
    const loginResponse = {
      token: 'stub.' + Buffer.from(member.email).toString('base64'),
      user: {
        id: member.id,
        email: member.email,
        firstName: member.firstName,
        role: 'MEMBER',
        permissions: member.permissions || []
      }
    };

    console.log('   Response.user:');
    console.log(`   {`);
    console.log(`     "id": "${loginResponse.user.id}",`);
    console.log(`     "email": "${loginResponse.user.email}",`);
    console.log(`     "permissions": ${JSON.stringify(loginResponse.user.permissions).substring(0, 60)}...`);
    console.log(`   }`);

    // STEP 3: Frontend stores user
    console.log('\nSTEP 3️⃣: Frontend stores in localStorage');
    console.log(`   user.id = "${loginResponse.user.id}"`);

    // STEP 4: MyRBE component calls useUserPermissions(user?.id)
    console.log('\nSTEP 4️⃣: MyRBE calls useUserPermissions(user?.id)');
    console.log(`   Hook parameter: "${loginResponse.user.id}"`);

    // STEP 5: Hook calls /api/user-permissions/:userId
    console.log('\nSTEP 5️⃣: Hook calls GET /api/user-permissions/:userId');
    console.log(`   URL: /api/user-permissions/${loginResponse.user.id}`);

    // STEP 6: Endpoint searches for member
    console.log('\nSTEP 6️⃣: Endpoint searches for member');
    const memberForEndpoint = await prisma.members.findFirst({
      where: {
        OR: [
          { id: loginResponse.user.id },
          { email: loginResponse.user.id }
        ]
      }
    });

    if (!memberForEndpoint) {
      console.log('   ❌ ERROR: Member not found by ID!');
      console.log('   Endpoint would return: { permissions: [], role: "MEMBER" }');
      console.log('   ❌ PROBLEM: MyRBE gets EMPTY permissions!');
      return;
    }

    console.log(`   ✅ Found member: ${memberForEndpoint.email}`);
    console.log(`      Has permissions: ${!!memberForEndpoint.permissions}`);

    // STEP 7: Endpoint converts permissions
    console.log('\nSTEP 7️⃣: Endpoint converts member.permissions');

    const blockedList = memberForEndpoint.permissions?.blockedResources || [];
    const converted = blockedList.map(resource => ({
      resource,
      actions: ['DENY'],
      reason: 'Restrictive mode enabled'
    }));

    console.log(`   ✅ Converted ${converted.length} DENY permissions:`);
    converted.forEach(p => console.log(`      - ${p.resource}`));

    // STEP 8: Hook receives and sets permissions
    console.log('\nSTEP 8️⃣: Hook receives and sets permissions state');
    const userPermissions = converted;
    console.log(`   setPermissions([${userPermissions.length} items])`);

    // STEP 9: MyRBE filters cards
    console.log('\nSTEP 9️⃣: MyRBE filters cards with shouldShowCard()');

    const testCards = [
      { title: 'Gestion Financière', resource: 'FINANCE' },
      { title: 'RétroDemandes', resource: 'RETRO_DEMANDES' },
      { title: 'Gérer les adhésions', resource: 'MEMBERS' },
      { title: 'RétroBus', resource: 'VEHICLES' },
      { title: 'Events', resource: 'EVENTS' },
      { title: 'Stock', resource: 'STOCK' },
      { title: 'RétroMerch', resource: 'RETROMERCH' },
      { title: 'Newsletter', resource: 'NEWSLETTER' },
      { title: 'Site Management', resource: 'SITE_MANAGEMENT' },
      { title: 'Adhesion Management', resource: 'ADHESION_MANAGEMENT' }
    ];

    let visibleCount = 0;
    let hiddenCount = 0;

    testCards.forEach(card => {
      const isDenied = userPermissions.some(p => 
        p.resource === card.resource && p.actions?.includes('DENY')
      );
      const shouldShow = !isDenied;

      if (shouldShow) {
        console.log(`   ✅ SHOW: ${card.title}`);
        visibleCount++;
      } else {
        console.log(`   ❌ HIDE: ${card.title}`);
        hiddenCount++;
      }
    });

    console.log(`\nSUMMARY:`);
    console.log(`   Visible cards: ${visibleCount}`);
    console.log(`   Hidden cards: ${hiddenCount}`);

    if (hiddenCount === 7) {
      console.log(`   ✅ CORRECT: Jarina should see 4 cards (VEHICLES, EVENTS, STOCK, RETROSUPPORT)`);
    } else {
      console.log(`   ❌ PROBLEM: Expected 7 hidden, got ${hiddenCount}`);
    }

  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

testJarinaFullFlow();
