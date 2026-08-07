import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function upsertPerm(userId, resource, actions) {
  const existing = await prisma.user_permissions.findUnique({
    where: { userId_resource: { userId, resource } }
  });

  if (existing) {
    return prisma.user_permissions.update({
      where: { id: existing.id },
      data: { actions, updatedAt: new Date() }
    });
  }

  return prisma.user_permissions.create({
    data: {
      id: crypto.randomUUID(),
      userId,
      resource,
      actions,
      updatedAt: new Date()
    }
  });
}

async function main() {
  const target = await prisma.site_users.findFirst({
    where: {
      OR: [
        { email: { contains: 'champenois', mode: 'insensitive' } },
        { username: { contains: 'champenois', mode: 'insensitive' } },
        { firstName: { contains: 'gaelle', mode: 'insensitive' } },
        { lastName: { contains: 'champenois', mode: 'insensitive' } }
      ]
    }
  });

  if (!target) {
    console.log('USER_NOT_FOUND');
    return;
  }

  const userId = target.id;
  console.log('TARGET', {
    id: userId,
    email: target.email,
    username: target.username,
    firstName: target.firstName,
    lastName: target.lastName
  });

  // Laisser visibles seulement les cartes demandées (Trilogy reste visible car sans resource)
  const cardDeny = ['VEHICLES', 'FINANCE', 'EVENTS', 'MEMBERS', 'STOCK', 'RETROMERCH', 'RETROSUPPORT'];
  for (const resource of cardDeny) {
    await upsertPerm(userId, resource, ['DENY']);
  }

  await upsertPerm(userId, 'NEWSLETTER', ['GRANT']);
  await upsertPerm(userId, 'SITE_MANAGEMENT', ['GRANT']);

  // Restreindre les onglets Gestion du site (nouvelle logique section-level)
  await upsertPerm(userId, 'SITE_SECTION_NOTIFICATIONS', ['GRANT']);
  await upsertPerm(userId, 'SITE_SECTION_ANNOUNCEMENTS', ['GRANT']);
  await upsertPerm(userId, 'SITE_SECTION_NEWS', ['GRANT']);

  const perms = await prisma.user_permissions.findMany({
    where: { userId },
    orderBy: { resource: 'asc' }
  });

  console.log('UPDATED_PERMISSIONS');
  for (const p of perms) {
    console.log(`${p.resource} => ${JSON.stringify(p.actions)}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
