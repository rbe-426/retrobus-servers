import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  try {
    const legacyAdminCount = await prisma.retro_request.count({
      where: {
        notes: {
          contains: '] Administrateur:'
        }
      }
    });

    const legacyMatriculeCount = await prisma.retro_request.count({
      where: {
        notes: {
          contains: '] Waiyl BELAIDI (w.belaidi):'
        }
      }
    });

    console.log('Found records with "] Administrateur:" =', legacyAdminCount);
    console.log('Found records with old matricule format =', legacyMatriculeCount);

    if (legacyAdminCount === 0 && legacyMatriculeCount === 0) {
      console.log('No migration needed.');
      return;
    }

    const result = await prisma.$executeRaw`
      UPDATE retro_request
      SET notes = replace(
        replace(notes, '] Administrateur:', '] Waiyl BELAIDI (belaidiw91):'),
        '] Waiyl BELAIDI (w.belaidi):',
        '] Waiyl BELAIDI (belaidiw91):'
      )
      WHERE notes IS NOT NULL
        AND (
          notes LIKE '%] Administrateur:%'
          OR notes LIKE '%] Waiyl BELAIDI (w.belaidi):%'
        )
    `;

    console.log('Updated rows =', result);

    const remainingAdminCount = await prisma.retro_request.count({
      where: {
        notes: {
          contains: '] Administrateur:'
        }
      }
    });

    const remainingOldMatriculeCount = await prisma.retro_request.count({
      where: {
        notes: {
          contains: '] Waiyl BELAIDI (w.belaidi):'
        }
      }
    });

    console.log('Remaining "] Administrateur:" =', remainingAdminCount);
    console.log('Remaining old matricule format =', remainingOldMatriculeCount);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

run();
