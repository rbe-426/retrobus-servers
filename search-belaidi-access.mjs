import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function searchAccess() {
  try {
    console.log('🔍 Searching for all accesses with "belaidi"...\n');
    
    const accesses = await prisma.site_users.findMany({
      where: {
        OR: [
          { username: { contains: 'belaidi', mode: 'insensitive' } },
          { email: { contains: 'belaidi', mode: 'insensitive' } }
        ]
      }
    });
    
    if (accesses.length === 0) {
      console.log('❌ No accesses found with "belaidi"');
      console.log('\n📋 Showing ALL accesses:');
      const allAccesses = await prisma.site_users.findMany();
      allAccesses.forEach(a => {
        console.log(`  - ${a.username} (${a.email}) - linkedMemberId: ${a.linkedMemberId}`);
      });
      return;
    }
    
    console.log(`✅ Found ${accesses.length} access(es):`);
    accesses.forEach(a => {
      console.log(`  - ID: ${a.id}`);
      console.log(`    Username: ${a.username}`);
      console.log(`    Email: ${a.email}`);
      console.log(`    Linked Member: ${a.linkedMemberId || 'NOT LINKED'}`);
      console.log();
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

searchAccess();
