import { Router } from 'express';

const CONFIGURATION_ID = 'default';
const COMMANDS = ['ping', 'about', 'anniversaire', 'phrase', 'bus', 'panne', 'destin', 'controle', 'diagnostic', 'tirage'];
const SNOWFLAKE_PATTERN = /^\d{17,20}$/;
const WELCOME_MESSAGE_MAX_LENGTH = 1_800;
const BOT920_HEALTH_TIMEOUT_MS = 4_000;

function resolveBot920HealthUrl() {
  return String(process.env.BOT920_HEALTH_URL || 'http://127.0.0.1:4300/health').trim();
}

function isConfigurationStorageUnavailable(error) {
  return error?.code === 'P2021'
    || error?.code === 'P2022'
    || error?.code === 'BOT920_CONFIGURATION_STORAGE_UNAVAILABLE';
}

function configurationStorage(prisma) {
  if (!prisma?.bot920Configuration) {
    const error = new Error('Bot 920 configuration storage is unavailable');
    error.code = 'BOT920_CONFIGURATION_STORAGE_UNAVAILABLE';
    throw error;
  }
  return prisma.bot920Configuration;
}

function validateBotStatus(payload) {
  if (payload?.status !== 'ok' || payload?.service !== '920-le-bot') {
    throw new Error('Réponse de santé du bot invalide.');
  }

  return {
    discord: payload.discord === 'connected' ? 'connected' : 'standby',
    latencyMs: Number.isFinite(payload.latencyMs) ? Math.round(payload.latencyMs) : null,
    guildCount: Number.isInteger(payload.guildCount) && payload.guildCount >= 0 ? payload.guildCount : 0,
    commandCount: Number.isInteger(payload.commandCount) && payload.commandCount >= 0 ? payload.commandCount : 0,
    startedAt: typeof payload.startedAt === 'string' ? payload.startedAt : null,
  };
}

export const defaultBot920Configuration = {
  general: { name: '920 Le Bot !', description: 'Le bot communautaire officiel de RétroBus Essonne.' },
  commands: { enabled: Object.fromEntries(COMMANDS.map((command) => [command, true])) },
  messages: { aboutStatus: 'Socle technique en cours de déploiement' },
  socialLinks: { website: '', instagram: '', discord: '' },
  welcome: {
    welcomeEnabled: false,
    welcomeChannelId: '',
    welcomeMessage: 'Bienvenue sur le serveur RétroBus Essonne !',
    autoRoleId: '',
  },
  logs: { enabled: true },
  fun: { enabled: true },
};

function text(value, fallback, maxLength = 500) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) || fallback : fallback;
}

function url(value) {
  const candidate = text(value, '', 500);
  if (!candidate) return '';
  try {
    const parsed = new URL(candidate);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : '';
  } catch {
    return '';
  }
}

function snowflake(value) {
  const candidate = text(value, '', 20);
  return SNOWFLAKE_PATTERN.test(candidate) ? candidate : '';
}

function isSnowflake(value) {
  return typeof value === 'string' && SNOWFLAKE_PATTERN.test(value);
}

function welcomeSource(value) {
  return value?.welcome && typeof value.welcome === 'object' && !Array.isArray(value.welcome) ? value.welcome : {};
}

export function validateBot920Configuration(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const welcome = welcomeSource(source);
  const welcomeEnabled = welcome.welcomeEnabled ?? welcome.enabled;
  const welcomeMessage = welcome.welcomeMessage ?? welcome.message;
  const errors = [];

  if (typeof welcomeEnabled !== 'boolean') errors.push('Le statut du message d’accueil est invalide.');
  if (typeof welcomeMessage !== 'string' || !welcomeMessage.trim() || welcomeMessage.trim().length > WELCOME_MESSAGE_MAX_LENGTH) {
    errors.push(`Le message d’accueil doit contenir entre 1 et ${WELCOME_MESSAGE_MAX_LENGTH} caractères.`);
  }
  if (welcome.welcomeChannelId && !isSnowflake(welcome.welcomeChannelId)) {
    errors.push('Le canal d’accueil doit être un identifiant Discord valide.');
  }
  if (welcome.autoRoleId && !isSnowflake(welcome.autoRoleId)) {
    errors.push('Le rôle automatique doit être un identifiant Discord valide.');
  }
  if (welcomeEnabled === true && !isSnowflake(welcome.welcomeChannelId)) {
    errors.push('Un canal Discord valide est requis lorsque l’accueil est activé.');
  }

  return errors;
}

export function normalizeBot920Configuration(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const sourceCommands = source.commands?.enabled && typeof source.commands.enabled === 'object' ? source.commands.enabled : {};
  const sourceWelcome = welcomeSource(source);
  return {
    general: {
      name: text(source.general?.name, defaultBot920Configuration.general.name, 100),
      description: text(source.general?.description, defaultBot920Configuration.general.description, 1_000),
    },
    commands: { enabled: Object.fromEntries(COMMANDS.map((command) => [command, sourceCommands[command] !== false])) },
    messages: { aboutStatus: text(source.messages?.aboutStatus, defaultBot920Configuration.messages.aboutStatus, 1_000) },
    socialLinks: {
      website: url(source.socialLinks?.website),
      instagram: url(source.socialLinks?.instagram),
      discord: url(source.socialLinks?.discord),
    },
    welcome: {
      welcomeEnabled: sourceWelcome.welcomeEnabled === true || (sourceWelcome.welcomeEnabled === undefined && sourceWelcome.enabled === true),
      welcomeChannelId: snowflake(sourceWelcome.welcomeChannelId),
      welcomeMessage: text(sourceWelcome.welcomeMessage ?? sourceWelcome.message, defaultBot920Configuration.welcome.welcomeMessage, WELCOME_MESSAGE_MAX_LENGTH),
      autoRoleId: snowflake(sourceWelcome.autoRoleId),
    },
    logs: { enabled: source.logs?.enabled !== false },
    fun: { enabled: source.fun?.enabled !== false },
  };
}

export function createBot920ConfigRouter() {
  const router = Router();

  router.get('/status', async (_request, response) => {
    const checkedAt = new Date().toISOString();
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), BOT920_HEALTH_TIMEOUT_MS);

    try {
      const botResponse = await fetch(resolveBot920HealthUrl(), { method: 'GET', signal: controller.signal });
      if (!botResponse.ok) throw new Error(`Le bot a répondu HTTP ${botResponse.status}.`);
      const bot = validateBotStatus(await botResponse.json());
      return response.json({ available: true, checkedAt, responseTimeMs: Date.now() - startedAt, bot });
    } catch (error) {
      console.warn('Unable to load Bot 920 health status:', error instanceof Error ? error.message : error);
      return response.status(503).json({
        available: false,
        checkedAt,
        error: 'Le statut du bot est temporairement indisponible.',
      });
    } finally {
      clearTimeout(timeout);
    }
  });

  router.get('/config', async (request, response) => {
    try {
      const record = await configurationStorage(request.app.locals.prisma).findUnique({ where: { id: CONFIGURATION_ID } });
      response.json({ configuration: normalizeBot920Configuration(record?.data), updatedAt: record?.updatedAt ?? null, storageAvailable: true });
    } catch (error) {
      if (isConfigurationStorageUnavailable(error)) {
        console.warn('Bot 920 configuration storage unavailable; using defaults.');
        return response.json({ configuration: defaultBot920Configuration, updatedAt: null, storageAvailable: false });
      }
      console.error('Unable to load Bot 920 configuration:', error);
      response.status(500).json({ error: 'Impossible de charger la configuration du bot.' });
    }
  });

  router.put('/config', async (request, response) => {
    const validationErrors = validateBot920Configuration(request.body?.configuration);
    if (validationErrors.length > 0) return response.status(400).json({ error: validationErrors[0], errors: validationErrors });
    const configuration = normalizeBot920Configuration(request.body?.configuration);
    const actorId = request.user?.id || request.user?.userId || null;
    const actorName = request.user?.email || request.user?.matricule || null;

    try {
      const record = await request.app.locals.prisma.$transaction(async (prisma) => {
        const storage = configurationStorage(prisma);
        if (!prisma.bot920ConfigurationAudit) {
          const error = new Error('Bot 920 configuration audit storage is unavailable');
          error.code = 'BOT920_CONFIGURATION_STORAGE_UNAVAILABLE';
          throw error;
        }
        const saved = await storage.upsert({
          where: { id: CONFIGURATION_ID },
          create: { id: CONFIGURATION_ID, data: configuration },
          update: { data: configuration },
        });
        await prisma.bot920ConfigurationAudit.create({ data: { actorId, actorName, data: configuration } });
        return saved;
      });
      response.json({ configuration: normalizeBot920Configuration(record.data), updatedAt: record.updatedAt });
    } catch (error) {
      if (isConfigurationStorageUnavailable(error)) {
        return response.status(503).json({ error: 'Le stockage de configuration du bot n’est pas encore disponible.' });
      }
      console.error('Unable to save Bot 920 configuration:', error);
      response.status(500).json({ error: 'Impossible d’enregistrer la configuration du bot.' });
    }
  });

  return router;
}