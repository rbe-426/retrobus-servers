import crypto from 'crypto';
import express from 'express';

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