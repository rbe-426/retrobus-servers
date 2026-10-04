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