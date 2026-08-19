import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function linkBelaidia() {
  try {
    console.log('🔗 Linking waiyl belaidi member to w.belaidi access...');
    
    // Find waiyl belaidi member
    const member = await prisma.members.findFirst({
      where: {
        OR: [
          { firstName: { contains: 'waiyl', mode: 'insensitive' } },
          { firstName: { contains: 'Waiyl', mode: 'insensitive' } },
          { matricule: 'w.belaidi' }
        ]
      }
    });
    
    if (!member) {
      console.error('❌ Member waiyl belaidi not found');
      return;
    }
    
    console.log(`✅ Found member: ${member.firstName} ${member.lastName} (ID: ${member.id})`);
    
    // Find w.belaidi site_users access
    const siteUser = await prisma.site_users.findUnique({
      where: { username: 'w.belaidi' }
    });
    
    if (!siteUser) {
      console.error('❌ Access w.belaidi not found');
      return;
    }
    
    console.log(`✅ Found access: ${siteUser.username} (ID: ${siteUser.id})`);
    
    // Link them together
    const updated = await prisma.site_users.update({
      where: { id: siteUser.id },
      data: { linkedMemberId: member.id }
    });
    
    console.log(`✅ Linked! site_users.linkedMemberId = ${updated.linkedMemberId}`);
    
    // Update member flag
    const updatedMember = await prisma.members.update({
      where: { id: member.id },
      data: { hasLinkedAccess: true }
    });
    
    console.log(`✅ Updated member hasLinkedAccess = ${updatedMember.hasLinkedAccess}`);
    console.log('\n✅ Link complete! waiyl belaidi ↔️ w.belaidi');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

linkBelaidia();
