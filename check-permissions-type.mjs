import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function diagnosePermissionsType() {
  try {
    console.log('\n🔍 === CHECKING PERMISSION TYPES ===\n');

    // Check Jarina
    const jarina = await prisma.members.findFirst({
      where: { email: { contains: 'jarina', mode: 'insensitive' } }
    });

    if (jarina) {
      console.log('Jarina permissions:');
      console.log('  Type:', typeof jarina.permissions);
      console.log('  Is Object:', jarina.permissions && typeof jarina.permissions === 'object');
      console.log('  Is String:', jarina.permissions && typeof jarina.permissions === 'string');
      console.log('  Value:', jarina.permissions);
      
      if (jarina.permissions) {
        if (typeof jarina.permissions === 'string') {
          const parsed = JSON.parse(jarina.permissions);
          console.log('  Parsed:', parsed);
          console.log('  Has restrictiveMode:', 'restrictiveMode' in parsed);
          console.log('  Has blockedResources:', 'blockedResources' in parsed);
        } else if (typeof jarina.permissions === 'object') {
          console.log('  Already object ✅');
          console.log('  Has restrictiveMode:', 'restrictiveMode' in jarina.permissions);
          console.log('  Has blockedResources:', 'blockedResources' in jarina.permissions);
          console.log('  blockedResources value:', jarina.permissions.blockedResources);
        }
      }
    }

    // Check Nour
    console.log('\n\nNour permissions:');
    const nour = await prisma.members.findFirst({
      where: { email: { contains: 'nour', mode: 'insensitive' } }
    });

    if (nour) {
      console.log('  Type:', typeof nour.permissions);
      console.log('  Is Object:', nour.permissions && typeof nour.permissions === 'object');
      console.log('  Is String:', nour.permissions && typeof nour.permissions === 'string');
      console.log('  Value:', nour.permissions);
    }

    // 🧪 Test what the endpoint would do with Jarina's data
    console.log('\n\n🧪 === TESTING ENDPOINT LOGIC ===');
    console.log('\nWith Jarina data:');
    
    if (jarina && jarina.permissions) {
      let testPermissions = jarina.permissions;
      
      // This is what the endpoint does
      const blockedList = testPermissions.blockedResources || testPermissions.deniedResources || [];
      
      console.log('  blockedList:', blockedList);
      console.log('  restrictiveMode:', testPermissions.restrictiveMode);
      console.log('  Array.isArray(blockedList):', Array.isArray(blockedList));
      
      if (testPermissions.restrictiveMode && Array.isArray(blockedList)) {
        const convertedPermissions = blockedList.map(resource => ({
          resource,
          actions: ['DENY'],
          reason: 'Restrictive mode enabled'
        }));
        
        console.log('  ✅ Would convert to:', convertedPermissions);
      } else {
        console.log('  ❌ Would NOT convert because:');
        console.log('     - restrictiveMode:', testPermissions.restrictiveMode);
        console.log('     - Array.isArray(blockedList):', Array.isArray(blockedList));
      }
    }

  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

diagnosePermissionsType();
