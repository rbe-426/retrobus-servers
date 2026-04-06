import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function copyMethuToJarina() {
  try {
    console.log('\n📋 === COPYING METHU PERMISSIONS TO JARINA ===\n');

    // 1️⃣ Find Méthusan (as site_user)
    console.log('1️⃣ Finding Méthusan in site_users...');
    const methuSiteUser = await prisma.site_users.findFirst({
      where: {
        email: { contains: 'methu', mode: 'insensitive' }
      }
    });

    if (!methuSiteUser) {
      console.log('  ❌ Methusan NOT found in site_users!');
      return;
    }

    console.log(`  ✅ Found Méthusan: ${methuSiteUser.email}`);
    console.log(`     ID: ${methuSiteUser.id}`);
    console.log(`     customPermissions:`, methuSiteUser.customPermissions);

    // Get Méthusan's user_permissions
    console.log('\n  Getting Méthusan user_permissions from table...');
    const methuPerms = await prisma.user_permissions.findMany({
      where: { userId: methuSiteUser.id }
    });
    console.log(`  Found ${methuPerms.length} permissions:`, methuPerms.map(p => ({ resource: p.resource, actions: p.actions })));

    // 2️⃣ Find Jarina
    console.log('\n2️⃣ Finding Jarina in members...');
    const jarina = await prisma.members.findFirst({
      where: {
        email: { contains: 'jarina', mode: 'insensitive' }
      }
    });

    if (!jarina) {
      console.log('  ❌ Jarina NOT found!');
      return;
    }

    console.log(`  ✅ Found Jarina: ${jarina.email}`);
    console.log(`     ID: ${jarina.id}`);

    // 3️⃣ Extract blocked resources from Méthusan
    console.log('\n3️⃣ Extracting Méthusan\'s DENY actions...');
    const blockedResources = methuPerms
      .filter(p => {
        const actions = Array.isArray(p.actions) ? p.actions : JSON.parse(p.actions || '[]');
        return actions.includes('DENY');
      })
      .map(p => p.resource);

    console.log('  Blocked resources:', blockedResources);

    // 4️⃣ Create Jarina's permissions object in same format
    console.log('\n4️⃣ Creating Jarina\'s permissions...');
    const jarinaPermissions = {
      createdAt: new Date().toISOString(),
      restrictiveMode: true,
      blockedResources: blockedResources,
      copiedFrom: methuSiteUser.email
    };

    const updatedJarina = await prisma.members.update({
      where: { id: jarina.id },
      data: {
        permissions: jarinaPermissions
      }
    });

    console.log('  ✅ Updated Jarina permissions:');
    console.log('     ', updatedJarina.permissions);

    console.log('\n✅ SUCCESS: Jarina now has same blocked resources as Méthusan');

  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

copyMethuToJarina();
