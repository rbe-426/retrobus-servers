import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('📊 Checking event on Railway...\n');
    
    const eventId = '1767779442515_5btlsuf2ytb';
    
    const event = await prisma.event.findUnique({
      where: { id: eventId }
    });

    if (!event) {
      console.log('❌ Event not found');
      return;
    }

    console.log('✅ Event found:', event.title);
    console.log('📅 Event ID:', event.id);
    
    // Parse extras
    let extras = {};
    try {
      extras = event.extras ? JSON.parse(event.extras) : {};
    } catch (e) {
      console.warn('⚠️ Failed to parse extras');
    }

    console.log('\n📋 Current extras:');
    console.log(JSON.stringify(extras, null, 2));

    console.log('\n🔍 Checking registrationMethod:', extras.registrationMethod);
    
    // If not HelloAsso, update it
    if (extras.registrationMethod !== 'helloasso') {
      console.log('\n🔄 Updating event to HelloAsso...\n');
      
      const updatedExtras = {
        ...extras,
        registrationMethod: 'helloasso',
        helloAssoUrl: 'https://www.helloasso.com/associations/retrobus-essonne/evenements/test-event',
        isVisible: true,
        allowPublicRegistration: true,
        requiresRegistration: true,
        isFree: false
      };

      const updated = await prisma.event.update({
        where: { id: eventId },
        data: {
          extras: JSON.stringify(updatedExtras)
        }
      });

      console.log('✅ Event updated!');
      console.log('\n📋 New extras:');
      console.log(JSON.stringify(JSON.parse(updated.extras), null, 2));
    } else {
      console.log('✅ Event already has HelloAsso configured');
    }

    // Also check if Registration table exists by trying a count
    try {
      const registrationCount = await prisma.registration.count();
      console.log('\n✅ Registration table exists, count:', registrationCount);
    } catch (e) {
      console.log('\n⚠️ Registration table does not exist yet');
      console.log('   Run: npx prisma migrate deploy');
    }

  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
