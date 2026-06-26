import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const personTarget = [
  { firstName: { contains: 'Clément', mode: 'insensitive' } },
  { firstName: { contains: 'Clement', mode: 'insensitive' } },
  { lastName: { contains: 'MARCY', mode: 'insensitive' } },
  { lastName: { contains: 'Marcy', mode: 'insensitive' } },
  { email: { contains: 'marcy', mode: 'insensitive' } },
];

const memberTarget = {
  OR: personTarget,
};

const siteUserTarget = {
  OR: [
    ...personTarget,
    { username: { contains: 'marcy', mode: 'insensitive' } },
  ],
};

try {
  const apply = process.argv.includes('--apply');
  const members = await prisma.members.findMany({
    where: memberTarget,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      matricule: true,
      role: true,
      status: true,
      hasLinkedAccess: true,
    },
  });

  const siteUsers = await prisma.site_users.findMany({
    where: siteUserTarget,
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      isActive: true,
      hasInternalAccess: true,
      hasExternalAccess: true,
      linkedMemberId: true,
      user_permissions: {
        select: {
          resource: true,
          actions: true,
        },
      },
    },
  });

  if (apply) {
    const memberIds = members.map((member) => member.id);
    const siteUserIds = siteUsers.map((user) => user.id);

    const result = await prisma.$transaction(async (tx) => {
      const deletedPermissions = await tx.user_permissions.deleteMany({
        where: { userId: { in: siteUserIds } },
      });
      const deletedAccessLogs = await tx.access_logs.deleteMany({
        where: { siteUserId: { in: siteUserIds } },
      });
      const deletedSiteUsers = await tx.site_users.deleteMany({
        where: { id: { in: siteUserIds } },
      });
      const deletedMembers = await tx.members.deleteMany({
        where: { id: { in: memberIds } },
      });

      return {
        deletedPermissions: deletedPermissions.count,
        deletedAccessLogs: deletedAccessLogs.count,
        deletedSiteUsers: deletedSiteUsers.count,
        deletedMembers: deletedMembers.count,
      };
    });

    console.log(JSON.stringify({ apply: true, result }, null, 2));
  } else {
    console.log(JSON.stringify({ members, siteUsers }, null, 2));
  }
} finally {
  await prisma.$disconnect();
}