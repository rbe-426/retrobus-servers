import crypto from 'crypto';
import express from 'express';
import { normalizeBot920Configuration } from './bot920Config.routes.js';

const SNOWFLAKE_PATTERN = /^\d{17,20}$/;
const DAILY_CARD_DRAW_LIMIT = 3;
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

function autoModStorage(request) {
  const prisma = request.app.locals.prisma;
  if (!prisma?.autoModRule || !prisma?.autoModWord) {
    const error = new Error('AutoMod storage is unavailable');
    error.code = 'BOT920_AUTOMOD_STORAGE_UNAVAILABLE';
    throw error;
  }
  return prisma;
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

function logStorage(request) {
  const prisma = request.app.locals.prisma;
  if (!prisma?.discordLogRule || !prisma?.discordLogEvent) {
    const error = new Error('Discord log storage is unavailable');
    error.code = 'BOT920_LOG_STORAGE_UNAVAILABLE';
    throw error;
  }
  return prisma;
}

function isLogStorageUnavailable(error) {
  return error?.code === 'P2021' || error?.code === 'P2022' || error?.code === 'BOT920_LOG_STORAGE_UNAVAILABLE';
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

router.get('/updates', async (request, response) => {
  try {
    const updates = await request.app.locals.prisma.changelog.findMany({
      where: { title: { contains: '920', mode: 'insensitive' } },
      orderBy: { date: 'desc' },
      take: 5,
      select: { version: true, title: true, date: true, changes: true },
    });
    response.json({ updates: updates.map((update) => ({
      version: String(update.version),
      title: String(update.title),
      date: update.date.toLocaleDateString('fr-FR'),
      changes: Array.isArray(update.changes) ? update.changes.map(String).slice(0, 8) : [],
    })) });
  } catch (error) {
    console.error('Unable to load Bot 920 updates:', error);
    response.status(500).json({ error: 'Unable to load Bot 920 updates' });
  }
});

router.get('/guilds/:guildId/config', async (request, response) => {
  if (!isSnowflake(request.params.guildId)) return response.status(400).json({ error: 'Invalid guild ID' });
  try {
    const settings = request.app.locals.prisma?.bot920GuildSettings;
    if (!settings) return response.json({ configuration: normalizeBot920Configuration() });
    const record = await settings.findUnique({ where: { guildId: request.params.guildId } });
    response.json({ configuration: normalizeBot920Configuration(record?.data), version: record?.version ?? 0 });
  } catch (error) {
    if (error?.code === 'P2021' || error?.code === 'P2022') return response.json({ configuration: normalizeBot920Configuration() });
    console.error('Unable to load Bot 920 guild configuration:', error);
    response.status(500).json({ error: 'Unable to load guild configuration' });
  }
});

router.get('/guilds/:guildId/automod', async (request, response) => {
  if (!isSnowflake(request.params.guildId)) return response.status(400).json({ error: 'Invalid guild ID' });
  try {
    const prisma = autoModStorage(request);
    const [rules, words] = await Promise.all([
      prisma.autoModRule.findMany({
        where: { guildId: request.params.guildId, enabled: true },
        include: { exceptions: { select: { entityType: true, entityId: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.autoModWord.findMany({
        where: { guildId: request.params.guildId, enabled: true },
        select: { id: true, phrase: true, matchType: true, severity: true, action: true, enabled: true },
        orderBy: { phrase: 'asc' },
      }),
    ]);
    response.json({ rules, words });
  } catch (error) {
    if (error?.code === 'P2021' || error?.code === 'P2022' || error?.code === 'BOT920_AUTOMOD_STORAGE_UNAVAILABLE') {
      return response.status(503).json({ error: 'AutoMod storage is unavailable' });
    }
    console.error('Unable to load Bot 920 AutoMod configuration:', error);
    response.status(500).json({ error: 'Unable to load AutoMod configuration' });
  }
});

router.get('/guilds/:guildId/logging', async (request, response) => {
  if (!isSnowflake(request.params.guildId)) return response.status(400).json({ error: 'Invalid guild ID' });
  try {
    const rules = await logStorage(request).discordLogRule.findMany({
      where: { guildId: request.params.guildId, enabled: true },
      select: { id: true, type: true, channelId: true, enabled: true, updatedAt: true },
    });
    response.json({ rules });
  } catch (error) {
    if (isLogStorageUnavailable(error)) return response.status(503).json({ error: 'Discord log storage is unavailable' });
    console.error('Unable to load Bot 920 log configuration:', error);
    response.status(500).json({ error: 'Unable to load log configuration' });
  }
});

router.post('/guilds/:guildId/log-events', async (request, response) => {
  if (!isSnowflake(request.params.guildId)) return response.status(400).json({ error: 'Invalid guild ID' });
  const payload = request.body ?? {};
  const validEventTypes = new Set(['kick', 'mute', 'unmute', 'ban', 'tempban', 'unban']);
  const durationMinutes = Number(payload.durationMinutes);
  const expiresAt = payload.expiresAt ? new Date(String(payload.expiresAt)) : null;
  if (!validEventTypes.has(payload.eventType) || !isSnowflake(payload.targetUserId) || !isSnowflake(payload.moderatorId)
    || !String(payload.targetTag || '').trim() || !String(payload.moderatorTag || '').trim() || !String(payload.reason || '').trim()
    || (payload.durationMinutes != null && (!Number.isInteger(durationMinutes) || durationMinutes < 1))
    || (expiresAt && Number.isNaN(expiresAt.getTime()))) {
    return response.status(400).json({ error: 'Invalid Discord log event payload' });
  }
  try {
    const event = await logStorage(request).discordLogEvent.create({ data: {
      guildId: request.params.guildId, eventType: payload.eventType, targetUserId: String(payload.targetUserId), targetTag: String(payload.targetTag).trim().slice(0, 100),
      moderatorId: String(payload.moderatorId), moderatorTag: String(payload.moderatorTag).trim().slice(0, 100), reason: String(payload.reason).trim().slice(0, 400),
      durationMinutes: payload.durationMinutes == null ? null : durationMinutes, expiresAt,
    } });
    response.status(201).json({ event: { id: event.id, createdAt: event.createdAt } });
  } catch (error) {
    if (isLogStorageUnavailable(error)) return response.status(503).json({ error: 'Discord log storage is unavailable' });
    console.error('Unable to record Discord log event:', error);
    response.status(500).json({ error: 'Unable to record Discord log event' });
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

router.post('/guilds/:guildId/activity', async (request, response) => {
  const { guildId } = request.params;
  const { userId } = request.body ?? {};
  if (!isSnowflake(guildId) || !isSnowflake(userId)) return response.status(400).json({ error: 'Invalid activity identity' });
  try {
    const activity = request.app.locals.prisma.discordMemberActivity;
    if (!activity) return response.status(503).json({ error: 'Activity storage is unavailable' });
    const previous = await activity.findUnique({ where: { guildId_userId: { guildId, userId } }, select: { lastActiveAt: true } });
    const awardPoint = !previous || Date.now() - previous.lastActiveAt.getTime() >= 15 * 60_000;
    const record = await activity.upsert({
      where: { guildId_userId: { guildId, userId } },
      create: { guildId, userId, displayName: String(request.body?.displayName || 'Membre Discord').trim().slice(0, 100), points: 1 },
      update: { displayName: String(request.body?.displayName || 'Membre Discord').trim().slice(0, 100), points: { increment: awardPoint ? 1 : 0 }, messageCount: { increment: 1 }, lastActiveAt: new Date() },
      select: { points: true, messageCount: true, lastActiveAt: true },
    });
    response.json({ activity: record, awardedPoint: awardPoint });
  } catch (error) {
    console.error('Unable to record Bot 920 member activity:', error);
    response.status(500).json({ error: 'Unable to record member activity' });
  }
});

router.get('/guilds/:guildId/leaderboard', async (request, response) => {
  if (!isSnowflake(request.params.guildId)) return response.status(400).json({ error: 'Invalid guild ID' });
  try {
    const entries = await request.app.locals.prisma.discordMemberActivity.findMany({
      where: { guildId: request.params.guildId }, orderBy: [{ points: 'desc' }, { lastActiveAt: 'desc' }], take: 10,
      select: { userId: true, displayName: true, points: true, messageCount: true, lastActiveAt: true },
    });
    response.json({ entries: entries.map((entry) => ({ ...entry, active: Date.now() - entry.lastActiveAt.getTime() < 30 * 24 * 60 * 60_000 })) });
  } catch (error) {
    console.error('Unable to load Bot 920 leaderboard:', error);
    response.status(500).json({ error: 'Unable to load leaderboard' });
  }
});

router.post('/guilds/:guildId/collection/draw', async (request, response) => {
  const { guildId } = request.params;
  const { userId } = request.body ?? {};
  const card = request.body?.card ?? {};
  const validRarities = new Set(['COMMUN', 'RARE', 'EPIQUE', 'LEGENDAIRE', 'MYTHIQUE']);
  if (!isSnowflake(guildId) || !isSnowflake(userId)
    || !/^[a-z0-9-]{1,80}$/i.test(String(card.id || ''))
    || !String(card.name || '').trim() || !validRarities.has(card.rarity)
    || !String(card.description || '').trim()) {
    return response.status(400).json({ error: 'Invalid collectible card payload' });
  }
  try {
    const now = new Date();
    const nextUtcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const result = await request.app.locals.prisma.$transaction(async (transaction) => {
      const quotaKey = { guildId_userId: { guildId, userId } };
      await transaction.discordCardDrawQuota.upsert({
        where: quotaKey,
        create: { guildId, userId, draws: 0, resetAt: now },
        update: {},
      });

      await transaction.discordCardDrawQuota.updateMany({
        where: { guildId, userId, resetAt: { lte: now } },
        data: { draws: 0, resetAt: nextUtcMidnight },
      });

      const existingCard = await transaction.discordUserCard.findUnique({
        where: { guildId_userId_cardId: { guildId, userId, cardId: card.id } },
        select: { quantity: true },
      });
      let quota = await transaction.discordCardDrawQuota.findUniqueOrThrow({ where: quotaKey });
      if (existingCard) {
        return { limited: false, duplicate: true, quantity: existingCard.quantity, drawsRemaining: Math.max(0, DAILY_CARD_DRAW_LIMIT - quota.draws), resetAt: quota.resetAt };
      }

      const quotaUpdate = await transaction.discordCardDrawQuota.updateMany({
        where: { guildId, userId, resetAt: { gt: now }, draws: { lt: DAILY_CARD_DRAW_LIMIT } },
        data: { draws: { increment: 1 } },
      });
      if (!quotaUpdate.count) return { limited: true, resetAt: quota.resetAt };

      quota = await transaction.discordCardDrawQuota.findUniqueOrThrow({ where: quotaKey });
      const ownedCard = await transaction.discordUserCard.create({ data: {
        guildId, userId, cardId: card.id,
        cardName: String(card.name).trim().slice(0, 120),
        rarity: card.rarity,
        description: String(card.description).trim().slice(0, 300),
      }, select: { quantity: true, firstAcquired: true } });
      return { limited: false, duplicate: false, ownedCard, drawsRemaining: DAILY_CARD_DRAW_LIMIT - quota.draws, resetAt: quota.resetAt };
    });
    if (result.limited) return response.status(429).json({ error: 'Daily card draw limit reached', code: 'DAILY_DRAW_LIMIT', resetAt: result.resetAt });
    response.status(result.duplicate ? 200 : 201).json({ duplicate: result.duplicate, quantity: result.duplicate ? result.quantity : result.ownedCard.quantity, firstAcquired: result.duplicate ? null : result.ownedCard.firstAcquired, drawsRemaining: result.drawsRemaining, resetAt: result.resetAt });
  } catch (error) {
    if (error?.code === 'P2002') {
      try {
        const [ownedCard, quota] = await Promise.all([
          request.app.locals.prisma.discordUserCard.findUnique({ where: { guildId_userId_cardId: { guildId, userId, cardId: card.id } }, select: { quantity: true } }),
          request.app.locals.prisma.discordCardDrawQuota.findUnique({ where: { guildId_userId: { guildId, userId } }, select: { draws: true, resetAt: true } }),
        ]);
        if (ownedCard && quota) return response.status(200).json({ duplicate: true, quantity: ownedCard.quantity, firstAcquired: null, drawsRemaining: Math.max(0, DAILY_CARD_DRAW_LIMIT - quota.draws), resetAt: quota.resetAt });
      } catch (lookupError) {
        console.error('Unable to resolve concurrent Bot 920 card draw:', lookupError);
      }
    }
    console.error('Unable to persist Bot 920 collectible card:', error);
    response.status(500).json({ error: 'Unable to persist collectible card' });
  }
});

router.get('/guilds/:guildId/collection/:userId', async (request, response) => {
  const { guildId, userId } = request.params;
  if (!isSnowflake(guildId) || !isSnowflake(userId)) return response.status(400).json({ error: 'Invalid collection identity' });
  try {
    const [cards, quota] = await Promise.all([
      request.app.locals.prisma.discordUserCard.findMany({
        where: { guildId, userId },
        orderBy: [{ rarity: 'desc' }, { cardName: 'asc' }],
        select: { cardId: true, cardName: true, rarity: true, description: true, quantity: true, firstAcquired: true },
      }),
      request.app.locals.prisma.discordCardDrawQuota.findUnique({ where: { guildId_userId: { guildId, userId } }, select: { draws: true, resetAt: true } }),
    ]);
    const quotaIsCurrent = quota && quota.resetAt > new Date();
    response.json({
      cards,
      uniqueCards: cards.length,
      totalCards: cards.reduce((sum, card) => sum + card.quantity, 0),
      drawsRemaining: quotaIsCurrent ? Math.max(0, DAILY_CARD_DRAW_LIMIT - quota.draws) : DAILY_CARD_DRAW_LIMIT,
      resetAt: quotaIsCurrent ? quota.resetAt : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + 1)),
      dailyDrawLimit: DAILY_CARD_DRAW_LIMIT,
    });
  } catch (error) {
    console.error('Unable to load Bot 920 collection:', error);
    response.status(500).json({ error: 'Unable to load collection' });
  }
});

router.get('/polls/due', async (request, response) => {
  try {
    const polls = await request.app.locals.prisma.discordPoll.findMany({
      where: { status: 'OPEN', endsAt: { lte: new Date() }, messageId: { not: null } },
      select: { id: true, guildId: true, channelId: true, messageId: true },
      take: 100,
    });
    response.json({ polls });
  } catch (error) {
    console.error('Unable to load due Bot 920 polls:', error);
    response.status(500).json({ error: 'Unable to load due polls' });
  }
});

router.post('/guilds/:guildId/polls', async (request, response) => {
  const { guildId } = request.params;
  const question = String(request.body?.question || '').trim().slice(0, 250);
  const options = Array.isArray(request.body?.options) ? request.body.options.map((value) => String(value).trim().slice(0, 80)).filter(Boolean).slice(0, 5) : [];
  const creatorId = String(request.body?.creatorId || '');
  const channelId = String(request.body?.channelId || '');
  const durationMinutes = Number(request.body?.durationMinutes || 0);
  if (!isSnowflake(guildId) || !isSnowflake(creatorId) || !isSnowflake(channelId) || question.length < 3 || options.length < 2 || new Set(options).size !== options.length || (durationMinutes && (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 10_080))) {
    return response.status(400).json({ error: 'Invalid poll payload' });
  }
  try {
    const poll = await request.app.locals.prisma.discordPoll.create({ data: {
      guildId, creatorId, channelId, question, endsAt: durationMinutes ? new Date(Date.now() + durationMinutes * 60_000) : null,
      options: { create: options.map((label, index) => ({ label, index })) },
    }, include: { options: true } });
    response.status(201).json({ poll });
  } catch (error) {
    console.error('Unable to create Bot 920 poll:', error);
    response.status(500).json({ error: 'Unable to create poll' });
  }
});

router.post('/guilds/:guildId/polls/:pollId/message', async (request, response) => {
  const { guildId, pollId } = request.params;
  const messageId = String(request.body?.messageId || '');
  if (!isSnowflake(guildId) || !isSnowflake(messageId)) return response.status(400).json({ error: 'Invalid poll message' });
  try {
    const result = await request.app.locals.prisma.discordPoll.updateMany({ where: { id: pollId, guildId }, data: { messageId } });
    if (!result.count) return response.status(404).json({ error: 'Poll not found' });
    response.json({ saved: true });
  } catch (error) {
    console.error('Unable to attach Bot 920 poll message:', error);
    response.status(500).json({ error: 'Unable to attach poll message' });
  }
});

router.get('/guilds/:guildId/polls/:pollId', async (request, response) => {
  if (!isSnowflake(request.params.guildId)) return response.status(400).json({ error: 'Invalid guild ID' });
  try {
    const poll = await request.app.locals.prisma.discordPoll.findFirst({
      where: { id: request.params.pollId, guildId: request.params.guildId },
      include: { options: { include: { _count: { select: { votes: true } } }, orderBy: { index: 'asc' } }, _count: { select: { votes: true } } },
    });
    if (!poll) return response.status(404).json({ error: 'Poll not found' });
    const expired = poll.endsAt && poll.endsAt <= new Date();
    if (expired && poll.status === 'OPEN') await request.app.locals.prisma.discordPoll.update({ where: { id: poll.id }, data: { status: 'CLOSED' } });
    response.json({ poll: { ...poll, status: expired ? 'CLOSED' : poll.status, options: poll.options.map((option) => ({ id: option.id, label: option.label, index: option.index, votes: option._count.votes })) } });
  } catch (error) {
    console.error('Unable to load Bot 920 poll:', error);
    response.status(500).json({ error: 'Unable to load poll' });
  }
});

router.post('/guilds/:guildId/polls/:pollId/votes', async (request, response) => {
  const { guildId, pollId } = request.params;
  const { userId, optionId } = request.body ?? {};
  if (!isSnowflake(guildId) || !isSnowflake(userId) || !String(optionId || '')) return response.status(400).json({ error: 'Invalid poll vote' });
  try {
    const poll = await request.app.locals.prisma.discordPoll.findFirst({ where: { id: pollId, guildId, status: 'OPEN', OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }], options: { some: { id: optionId } } }, select: { id: true } });
    if (!poll) return response.status(409).json({ error: 'Poll is closed or option is invalid' });
    await request.app.locals.prisma.discordPollVote.upsert({
      where: { pollId_userId: { pollId, userId } }, create: { pollId, userId, optionId }, update: { optionId, createdAt: new Date() },
    });
    const options = await request.app.locals.prisma.discordPollOption.findMany({ where: { pollId }, include: { _count: { select: { votes: true } } }, orderBy: { index: 'asc' } });
    response.json({ options: options.map((option) => ({ id: option.id, label: option.label, votes: option._count.votes })) });
  } catch (error) {
    console.error('Unable to record Bot 920 poll vote:', error);
    response.status(500).json({ error: 'Unable to record poll vote' });
  }
});

router.post('/guilds/:guildId/suggestions', async (request, response) => {
  const { guildId } = request.params;
  const creatorId = String(request.body?.creatorId || '');
  const suggestionText = String(request.body?.text || '').trim();
  if (!isSnowflake(guildId) || !isSnowflake(creatorId) || suggestionText.length < 8 || suggestionText.length > 1_000) return response.status(400).json({ error: 'Invalid suggestion payload' });
  try {
    const suggestion = await request.app.locals.prisma.discordSuggestion.create({ data: { guildId, creatorId, text: suggestionText } });
    response.status(201).json({ suggestion });
  } catch (error) {
    console.error('Unable to create Bot 920 suggestion:', error);
    response.status(500).json({ error: 'Unable to create suggestion' });
  }
});

router.post('/guilds/:guildId/suggestions/:suggestionId/votes', async (request, response) => {
  const { guildId, suggestionId } = request.params;
  const userId = String(request.body?.userId || '');
  if (!isSnowflake(guildId) || !isSnowflake(userId)) return response.status(400).json({ error: 'Invalid suggestion vote' });
  try {
    const suggestion = await request.app.locals.prisma.discordSuggestion.findFirst({ where: { id: suggestionId, guildId, status: 'OPEN' }, select: { id: true } });
    if (!suggestion) return response.status(404).json({ error: 'Suggestion not found' });
    const vote = await request.app.locals.prisma.discordSuggestionVote.findUnique({ where: { suggestionId_userId: { suggestionId, userId } } });
    if (vote) await request.app.locals.prisma.discordSuggestionVote.delete({ where: { id: vote.id } });
    else await request.app.locals.prisma.discordSuggestionVote.create({ data: { suggestionId, userId } });
    const votes = await request.app.locals.prisma.discordSuggestionVote.count({ where: { suggestionId } });
    response.json({ votes, voted: !vote });
  } catch (error) {
    console.error('Unable to record Bot 920 suggestion vote:', error);
    response.status(500).json({ error: 'Unable to record suggestion vote' });
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