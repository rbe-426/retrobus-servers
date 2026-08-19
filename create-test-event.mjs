import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🆕 Creating test event with HelloAsso...\n');
    
    const eventId = '1767779442515_5btlsuf2ytb';
    
    const event = await prisma.event.create({
      data: {
        id: eventId,
        title: 'TEST',
        date: new Date('2026-02-15T10:00:00Z'),
        time: '10:00',
        location: 'Essonne, France',
        description: 'Événement de test avec HelloAsso',
        adultPrice: 15.00,
        childPrice: 8.00,
        status: 'PUBLISHED',
        updatedAt: new Date(),
        extras: JSON.stringify({
          isVisible: true,
          allowPublicRegistration: true,
          requiresRegistration: true,
          isFree: false,
          maxParticipants: 100,
          registrationDeadline: null,
          registrationMethod: 'helloasso',
          helloAssoUrl: 'https://www.helloasso.com/associations/retrobus-essonne/evenements/test-event',
          pdfUrl: null,
          eventType: 'public_with_registration'
        })
      }
    });

    console.log('✅ Event created!');
    console.log('\n📋 Event data:');
    console.log(JSON.stringify({
      id: event.id,
      title: event.title,
      date: event.date,
      extras: JSON.parse(event.extras)
    }, null, 2));

  } catch (e) {
    console.error('❌ Error:', e.message);
    if (e.code === 'P2002') {
      console.log('   Event already exists');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
