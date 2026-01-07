import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // Chercher un événement avec l'ID utilisé en test
    const eventId = '1767779442515_5btlsuf2ytb';
    
    const event = await prisma.event.findUnique({
      where: { id: eventId }
    });

    if (!event) {
      console.log('❌ Event not found:', eventId);
      return;
    }

    console.log('📅 Event found:', event.title);

    // Parser les extras actuelles
    let extras = {};
    try {
      extras = event.extras ? JSON.parse(event.extras) : {};
    } catch (e) {
      console.warn('⚠️ Failed to parse extras');
    }

    // Mettre à jour avec HelloAsso
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

    console.log('✅ Event updated with HelloAsso integration');
    console.log('📝 Extras:', updatedExtras);
  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
