import crypto from 'crypto';
import express from 'express';
import { normalizeBot920Configuration } from './bot920Config.routes.js';

const SNOWFLAKE_PATTERN = /^\d{17,20}$/;
const router = express.Router();

function hasValidServiceToken(request) {
  const expected = process.env.BOT920_SERVICE_TOKEN;
  const received = String(request.headers['x-bot920-service-token'] || '');
  if (!expected || !received) return false;

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

function requireBotService(request, response, next) {
  if (!process.env.BOT920_SERVICE_TOKEN) {
    return response.status(503).json({ error: 'Bot 920 service authentication is not configured' });
  }
  if (!hasValidServiceToken(request)) return response.status(401).json({ error: 'Unauthorized' });
  next();
}

function isSnowflake(value) {
  return SNOWFLAKE_PATTERN.test(String(value || ''));
}

function temporaryBanStorage(request) {
  const storage = request.app.locals.prisma?.discordTemporaryBan;
  if (!storage) {
    const error = new Error('Temporary ban storage is unavailable');
    error.code = 'BOT920_TEMPBAN_STORAGE_UNAVAILABLE';
    throw error;
  }
  return storage;
}

function isTemporaryBanStorageUnavailable(error) {
  return error?.code === 'P2021' || error?.code === 'P2022' || error?.code === 'BOT920_TEMPBAN_STORAGE_UNAVAILABLE';
}

function guildInventoryStorage(request) {
  const prisma = request.app.locals.prisma;
  if (!prisma?.discordGuild || !prisma?.discordGuildChannel || !prisma?.discordGuildRole) {
    const error = new Error('Discord guild inventory storage is unavailable');
    error.code = 'BOT920_GUILD_INVENTORY_STORAGE_UNAVAILABLE';
    throw error;
  }
  return prisma;
}

function isGuildInventoryStorageUnavailable(error) {
  return error?.code === 'P2021'
    || error?.code === 'P2022'
    || error?.code === 'BOT920_GUILD_INVENTORY_STORAGE_UNAVAILABLE';
}

function moderationCaseStorage(request) {
  const storage = request.app.locals.prisma?.discordModerationCase;
  if (!storage) {
    const error = new Error('Moderation case storage is unavailable');
    error.code = 'BOT920_MODERATION_CASE_STORAGE_UNAVAILABLE';
    throw error;
  }
  return storage;
}

function inventoryGuild(value) {
  if (!value || typeof value !== 'object' || !isSnowflake(value.id)) return null;
  const channels = Array.isArray(value.channels) ? value.channels : [];
  const roles = Array.isArray(value.roles) ? value.roles : [];
  return {
    id: String(value.id),
    name: String(value.name || '').trim().slice(0, 100) || 'Serveur Discord',
    iconUrl: String(value.iconUrl || '').trim().slice(0, 2_000) || null,
    ownerId: isSnowflake(value.ownerId) ? String(value.ownerId) : null,
    memberCount: Number.isInteger(value.memberCount) && value.memberCount >= 0 ? value.memberCount : 0,
    channels: channels
      .filter((channel) => isSnowflake(channel?.id) && String(channel?.name || '').trim())
      .slice(0, 500)
      .map((channel) => ({ id: String(channel.id), name: String(channel.name).trim().slice(0, 100), type: String(channel.type || 'UNKNOWN').trim().slice(0, 40), parentId: isSnowflake(channel.parentId) ? String(channel.parentId) : null, position: Number.isInteger(channel.position) ? channel.position : 0 })),
    roles: roles
      .filter((role) => isSnowflake(role?.id) && String(role?.name || '').trim())
      .slice(0, 250)
      .map((role) => ({ id: String(role.id), name: String(role.name).trim().slice(0, 100), color: /^#[0-9a-f]{6}$/i.test(String(role.color || '')) ? String(role.color) : '#000000', position: Number.isInteger(role.position) ? role.position : 0, managed: role.managed === true })),
  };
}

function parseBirthDate(value) {
  const birthDate = new Date(String(value || ''));
  if (Number.isNaN(birthDate.getTime()) || birthDate > new Date()) return null;

  let age = new Date().getUTCFullYear() - birthDate.getUTCFullYear();
  const hasHadBirthday = (
    new Date().getUTCMonth() > birthDate.getUTCMonth()
    || (new Date().getUTCMonth() === birthDate.getUTCMonth() && new Date().getUTCDate() >= birthDate.getUTCDate())
  );
  if (!hasHadBirthday) age -= 1;
  return age >= 0 && age <= 120 ? birthDate : null;
}

router.use(requireBotService);

router.get('/config', async (request, response) => {
  try {
    const storage = request.app.locals.prisma?.bot920Configuration;
    if (!storage) return response.json({ configuration: normalizeBot920Configuration() });
    const record = await storage.findUnique({ where: { id: 'default' } });
    response.json({ configuration: normalizeBot920Configuration(record?.data), updatedAt: record?.updatedAt ?? null });
  } catch (error) {
    if (error?.code === 'P2021' || error?.code === 'P2022') {
      console.warn('Bot 920 configuration storage unavailable; using defaults.');
      return response.json({ configuration: normalizeBot920Configuration() });
    }
    console.error('Unable to load Bot 920 service configuration:', error);
    response.status(500).json({ error: 'Unable to load bot configuration' });
  }
});

router.post('/guild-context', async (request, response) => {
  const guilds = (Array.isArray(request.body?.guilds) ? request.body.guilds : []).map(inventoryGuild).filter(Boolean).slice(0, 100);
  try {
    const prisma = guildInventoryStorage(request);
    await prisma.$transaction(guilds.map((guild) => prisma.discordGuild.upsert({
      where: { id: guild.id },
      create: { id: guild.id, name: guild.name, iconUrl: guild.iconUrl, ownerId: guild.ownerId, memberCount: guild.memberCount, channels: { create: guild.channels }, roles: { create: guild.roles } },
      update: { name: guild.name, iconUrl: guild.iconUrl, ownerId: guild.ownerId, memberCount: guild.memberCount, lastSyncedAt: new Date(), channels: { deleteMany: {}, create: guild.channels }, roles: { deleteMany: {}, create: guild.roles } },
    })));
    response.json({ syncedGuilds: guilds.length, syncedAt: new Date().toISOString() });
  } catch (error) {
    if (isGuildInventoryStorageUnavailable(error)) return response.status(503).json({ error: 'Discord guild inventory storage is unavailable' });
    console.error('Unable to sync Discord guild inventory:', error);
    response.status(500).json({ error: 'Unable to sync Discord guild inventory' });
  }
});

router.post('/moderation-cases', async (request, response) => {
  const payload = request.body ?? {};
  const validActions = new Set(['kick', 'mute', 'unmute', 'ban', 'tempban', 'unban']);
  const durationMinutes = Number(payload.durationMinutes);
  const expiresAt = payload.expiresAt ? new Date(String(payload.expiresAt)) : null;
  if (!isSnowflake(payload.guildId) || !isSnowflake(payload.targetUserId) || !isSnowflake(payload.moderatorId)
    || !validActions.has(payload.action) || !String(payload.targetTag || '').trim() || !String(payload.moderatorTag || '').trim()
    || !String(payload.reason || '').trim() || (payload.durationMinutes != null && (!Number.isInteger(durationMinutes) || durationMinutes < 1))
    || (expiresAt && Number.isNaN(expiresAt.getTime()))) {
    return response.status(400).json({ error: 'Invalid moderation case payload' });
  }
  try {
    const moderationCase = await moderationCaseStorage(request).create({ data: {
      guildId: String(payload.guildId), targetUserId: String(payload.targetUserId), targetTag: String(payload.targetTag).trim().slice(0, 100),
      moderatorId: String(payload.moderatorId), moderatorTag: String(payload.moderatorTag).trim().slice(0, 100), action: payload.action,
      reason: String(payload.reason).trim().slice(0, 400), durationMinutes: payload.durationMinutes == null ? null : durationMinutes,
      expiresAt, status: payload.action === 'unmute' || payload.action === 'unban' ? 'RESOLVED' : 'ACTIVE',
    } });
    response.status(201).json({ moderationCase: { id: moderationCase.id } });
  } catch (error) {
    if (error?.code === 'P2021' || error?.code === 'P2022' || error?.code === 'BOT920_MODERATION_CASE_STORAGE_UNAVAILABLE') return response.status(503).json({ error: 'Moderation case storage is unavailable' });
    console.error('Unable to record Discord moderation case:', error);
    response.status(500).json({ error: 'Unable to record moderation case' });
  }
});

router.get('/guilds/:guildId/birthdays', async (request, response) => {
  if (!isSnowflake(request.params.guildId)) return response.status(400).json({ error: 'Invalid guild ID' });

  try {
    const birthdays = await request.app.locals.prisma.discordBirthday.findMany({
      where: { guildId: request.params.guildId },
      select: { guildId: true, userId: true, displayName: true, birthDate: true },
      orderBy: { birthDate: 'asc' },
    });
    response.json({ birthdays });
  } catch (error) {
    console.error('Unable to list Discord birthdays:', error);
    response.status(500).json({ error: 'Unable to list birthdays' });
  }
});

router.post('/temp-bans', async (request, response) => {
  const { guildId, userId, moderatorId } = request.body ?? {};
  const reason = String(request.body?.reason || '').trim().slice(0, 400);
  const expiresAt = new Date(String(request.body?.expiresAt || ''));
  if (!isSnowflake(guildId) || !isSnowflake(userId) || !isSnowflake(moderatorId) || !reason || Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
    return response.status(400).json({ error: 'Invalid temporary ban payload' });
  }

  try {
    const ban = await temporaryBanStorage(request).create({ data: { guildId, userId, moderatorId, reason, expiresAt } });
    response.status(201).json({ ban: { id: ban.id } });
  } catch (error) {
    if (isTemporaryBanStorageUnavailable(error)) return response.status(503).json({ error: 'Temporary ban storage is unavailable' });
    console.error('Unable to schedule Discord temporary ban:', error);
    response.status(500).json({ error: 'Unable to schedule temporary ban' });
  }
});

router.get('/temp-bans/due', async (request, response) => {
  try {
    const bans = await temporaryBanStorage(request).findMany({
      where: { expiresAt: { lte: new Date() }, liftedAt: null },
      select: { id: true, guildId: true, userId: true },
      orderBy: { expiresAt: 'asc' },
      take: 100,
    });
    response.json({ bans });
  } catch (error) {
    if (isTemporaryBanStorageUnavailable(error)) return response.status(503).json({ error: 'Temporary ban storage is unavailable' });
    console.error('Unable to load due Discord temporary bans:', error);
    response.status(500).json({ error: 'Unable to load temporary bans' });
  }
});

router.post('/temp-bans/:id/complete', async (request, response) => {
  try {
    await temporaryBanStorage(request).updateMany({ where: { id: request.params.id, liftedAt: null }, data: { liftedAt: new Date() } });
    response.status(204).end();
  } catch (error) {
    if (isTemporaryBanStorageUnavailable(error)) return response.status(503).json({ error: 'Temporary ban storage is unavailable' });
    console.error('Unable to complete Discord temporary ban:', error);
    response.status(500).json({ error: 'Unable to complete temporary ban' });
  }
});

router.delete('/temp-bans/guilds/:guildId/users/:userId', async (request, response) => {
  if (!isSnowflake(request.params.guildId) || !isSnowflake(request.params.userId)) return response.status(400).json({ error: 'Invalid Discord ID' });

  try {
    await temporaryBanStorage(request).updateMany({
      where: { guildId: request.params.guildId, userId: request.params.userId, liftedAt: null },
      data: { liftedAt: new Date() },
    });
    response.status(204).end();
  } catch (error) {
    if (isTemporaryBanStorageUnavailable(error)) return response.status(503).json({ error: 'Temporary ban storage is unavailable' });
    console.error('Unable to cancel Discord temporary ban:', error);
    response.status(500).json({ error: 'Unable to cancel temporary ban' });
  }
});

router.put('/guilds/:guildId/birthdays/:userId', async (request, response) => {
  const { guildId, userId } = request.params;
  const displayName = String(request.body?.displayName || '').trim();
  const birthDate = parseBirthDate(request.body?.birthDate);
  if (!isSnowflake(guildId) || !isSnowflake(userId)) return response.status(400).json({ error: 'Invalid Discord ID' });
  if (!displayName || displayName.length > 100 || !birthDate) return response.status(400).json({ error: 'Invalid birthday payload' });

  try {
    const birthday = await request.app.locals.prisma.discordBirthday.upsert({
      where: { guildId_userId: { guildId, userId } },
      create: { guildId, userId, displayName, birthDate },
      update: { displayName, birthDate },
      select: { guildId: true, userId: true, displayName: true, birthDate: true },
    });
    response.json({ birthday });
  } catch (error) {
    console.error('Unable to save Discord birthday:', error);
    response.status(500).json({ error: 'Unable to save birthday' });
  }
});

export default router;