import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  try {
    const toFixCount = await prisma.retro_request.count({
      where: {
        OR: [
          { notes: { contains: '] Administrateur:' } },
          { notes: { contains: '] Waiyl BELAIDI (belaidiw91):' } }
        ]
      }
    });

    console.log('Records needing rewrite =', toFixCount);

    if (toFixCount === 0) {
      console.log('No migration needed.');
      return;
    }

    const updatedRows = await prisma.$executeRaw`
      UPDATE retro_request
      SET notes = replace(
        replace(notes, '] Administrateur:', '] Waiyl BELAIDI (w.belaidi):'),
        '] Waiyl BELAIDI (belaidiw91):',
        '] Waiyl BELAIDI (w.belaidi):'
      )
      WHERE notes IS NOT NULL
        AND (
          notes LIKE '%] Administrateur:%'
          OR notes LIKE '%] Waiyl BELAIDI (belaidiw91):%'
        )
    `;

    console.log('Updated rows =', updatedRows);

    const remaining = await prisma.retro_request.count({
      where: {
        OR: [
          { notes: { contains: '] Administrateur:' } },
          { notes: { contains: '] Waiyl BELAIDI (belaidiw91):' } }
        ]
      }
    });

    console.log('Remaining legacy rows =', remaining);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

run();
