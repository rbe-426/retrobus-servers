import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findAndLinkBelaidi() {
  try {
    console.log('🔍 Finding w.belaidi access and waiyl belaidi member...\n');
    
    // Find waiyl belaidi member
    const member = await prisma.members.findFirst({
      where: {
        OR: [
          { matricule: 'w.belaidi' },
          { firstName: { contains: 'waiyl', mode: 'insensitive' } },
          { firstName: { contains: 'Waiyl', mode: 'insensitive' } }
        ]
      }
    });
    
    if (!member) {
      console.error('❌ Member waiyl belaidi not found');
      return;
    }
    
    console.log(`✅ Found member: ${member.firstName} ${member.lastName}`);
    console.log(`   ID: ${member.id}`);
    console.log(`   Email: ${member.email}`);
    console.log(`   Matricule: ${member.matricule}`);
    console.log(`   Currently linked: ${member.hasLinkedAccess ? 'YES' : 'NO'}`);
    
    // Find w.belaidi access - try different approaches
    let access = null;
    
    // Try 1: Direct username match
    access = await prisma.site_users.findUnique({
      where: { username: 'w.belaidi' }
    });
    
    if (!access) {
      // Try 2: Email match
      access = await prisma.site_users.findFirst({
        where: {
          email: { contains: 'belaidi', mode: 'insensitive' }
        }
      });
    }
    
    if (!access) {
      // Try 3: Show all accesses
      console.log('\n❌ w.belaidi access not found');
      console.log('\n📋 Available accesses:');
      const allAccesses = await prisma.site_users.findMany();
      allAccesses.forEach(a => {
        console.log(`   - ${a.username} (${a.email})`);
      });
      return;
    }
    
    console.log(`\n✅ Found access: ${access.username}`);
    console.log(`   ID: ${access.id}`);
    console.log(`   Email: ${access.email}`);
    console.log(`   Role: ${access.role}`);
    console.log(`   Currently linked to: ${access.linkedMemberId || 'NOTHING'}`);
    
    // Link them
    console.log(`\n🔗 Linking access to member...`);
    const updated = await prisma.site_users.update({
      where: { id: access.id },
      data: { linkedMemberId: member.id }
    });
    
    console.log(`✅ Linked! access.linkedMemberId = ${updated.linkedMemberId}`);
    
    // Update member flag
    await prisma.members.update({
      where: { id: member.id },
      data: { hasLinkedAccess: true }
    });
    
    console.log(`✅ Updated member hasLinkedAccess = true`);
    console.log('\n✅✅ DONE! w.belaidi access is now linked to Waiyl BELAIDI member');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code) console.error('   Code:', error.code);
  } finally {
    await prisma.$disconnect();
  }
}

findAndLinkBelaidi();
