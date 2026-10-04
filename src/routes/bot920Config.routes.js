import { Router } from 'express';

const CONFIGURATION_ID = 'default';
const COMMANDS = ['ping', 'about', 'anniversaire', 'phrase', 'bus', 'panne', 'destin', 'controle', 'diagnostic', 'tirage', 'ecouter', 'kick', 'mute', 'unmute', 'ban', 'tempban', 'unban'];
const SNOWFLAKE_PATTERN = /^\d{17,20}$/;
const WELCOME_MESSAGE_MAX_LENGTH = 1_800;
const BOT920_HEALTH_TIMEOUT_MS = 4_000;
const AUTOMOD_TYPES = new Set(['ANTI_SPAM', 'LINK', 'WORD']);
const AUTOMOD_ACTIONS = new Set(['DELETE', 'TIMEOUT', 'ALERT']);
const AUTOMOD_SEVERITIES = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const AUTOMOD_EXCEPTION_TYPES = new Set(['ROLE', 'MEMBER', 'CHANNEL']);
const AUTOMOD_MATCH_TYPES = new Set(['PARTIAL', 'EXACT']);
const LOG_RULE_TYPES = new Set(['MODERATION']);
const MODERATION_LOG_EVENT_TYPES = new Set(['kick', 'mute', 'unmute', 'ban', 'tempban', 'unban']);
const TEXT_CHANNEL_TYPES = new Set(['TEXT', 'ANNOUNCEMENT']);

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

function guildFoundationStorage(prisma) {
  if (!prisma?.discordGuild || !prisma?.bot920PanelAuditEvent) {
    const error = new Error('Bot 920 guild foundation storage is unavailable');
    error.code = 'BOT920_GUILD_FOUNDATION_STORAGE_UNAVAILABLE';
    throw error;
  }
  return prisma;
}

function isGuildFoundationStorageUnavailable(error) {
  return error?.code === 'P2021'
    || error?.code === 'P2022'
    || error?.code === 'BOT920_GUILD_FOUNDATION_STORAGE_UNAVAILABLE';
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
  plugins: {
    reactionRoles: { enabled: false },
    tickets: { enabled: false },
    automations: { enabled: false },
    pollsGiveaways: { enabled: false },
    reminders: { enabled: false },
    levels: { enabled: false },
    socialAlerts: { enabled: false },
    statisticsChannels: { enabled: false },
    music: { enabled: true },
    automod: { enabled: false, antiSpam: true, antiRaid: true, blockedLinks: false, alertChannelId: '', spamMessageLimit: 6, spamWindowSeconds: 10, timeoutMinutes: 10, raidJoinLimit: 8, raidWindowSeconds: 60 },
  },
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

function pluginSource(value) {
  return value?.plugins && typeof value.plugins === 'object' && !Array.isArray(value.plugins) ? value.plugins : {};
}

function plugin(value, fallback) {
  return { enabled: value?.enabled === true || (value?.enabled === undefined && fallback.enabled) };
}

function integer(value, fallback, min, max) {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : fallback;
}

function optionalInteger(value, min, max) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : undefined;
}

function normalizeAutoModExceptions(value) {
  const entries = Array.isArray(value) ? value : [];
  const seen = new Set();
  return entries.map((entry) => ({
    entityType: String(entry?.entityType || '').trim().toUpperCase(),
    entityId: String(entry?.entityId || '').trim(),
  })).filter((entry) => {
    const key = `${entry.entityType}:${entry.entityId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function validateAutoModExceptions(value, errors) {
  if (value !== undefined && !Array.isArray(value)) errors.push('Les exceptions doivent être une liste.');
  const exceptions = normalizeAutoModExceptions(value);
  if (exceptions.length > 250) errors.push('Une règle ne peut pas contenir plus de 250 exceptions.');
  for (const exception of exceptions) {
    if (!AUTOMOD_EXCEPTION_TYPES.has(exception.entityType)) errors.push('Le type d’exception AutoMod est invalide.');
    if (!isSnowflake(exception.entityId)) errors.push('Une exception doit utiliser un identifiant Discord valide.');
  }
  return exceptions;
}

function validateAutoModRule(value = {}, { partial = false } = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const errors = [];
  const type = String(source.type || '').trim().toUpperCase();
  const name = String(source.name || '').trim();
  const action = String(source.action || 'TIMEOUT').trim().toUpperCase();
  const severity = String(source.severity || 'MEDIUM').trim().toUpperCase();
  const threshold = optionalInteger(source.threshold, 2, 100);
  const windowSeconds = optionalInteger(source.windowSeconds, 2, 3_600);
  const timeoutMinutes = optionalInteger(source.timeoutMinutes, 1, 40_320);
  const alertChannelId = source.alertChannelId == null || source.alertChannelId === '' ? null : String(source.alertChannelId).trim();
  const exceptions = validateAutoModExceptions(source.exceptions, errors);

  if (!partial || source.type !== undefined) {
    if (!AUTOMOD_TYPES.has(type)) errors.push('Le type de règle AutoMod est invalide.');
  }
  if (!partial || source.name !== undefined) {
    if (!name || name.length > 100) errors.push('Le nom de la règle doit contenir entre 1 et 100 caractères.');
  }
  if (!AUTOMOD_ACTIONS.has(action)) errors.push('L’action AutoMod est invalide.');
  if (!AUTOMOD_SEVERITIES.has(severity)) errors.push('La sévérité AutoMod est invalide.');
  if (threshold === undefined) errors.push('Le seuil AutoMod est invalide.');
  if (windowSeconds === undefined) errors.push('La fenêtre AutoMod est invalide.');
  if (timeoutMinutes === undefined) errors.push('La durée de timeout est invalide.');
  if (alertChannelId && !isSnowflake(alertChannelId)) errors.push('Le canal d’alerte doit être un identifiant Discord valide.');
  if (type === 'ANTI_SPAM' && (threshold == null || windowSeconds == null)) errors.push('La règle anti-spam nécessite un seuil et une fenêtre.');
  if (action === 'TIMEOUT' && timeoutMinutes == null) errors.push('Une action timeout nécessite une durée.');

  return {
    errors,
    data: {
      type, name, enabled: source.enabled !== false, severity, action,
      threshold: threshold ?? null, windowSeconds: windowSeconds ?? null, timeoutMinutes: timeoutMinutes ?? null,
      alertChannelId, deleteMessage: source.deleteMessage !== false, notifyUser: source.notifyUser === true, exceptions,
    },
  };
}

function validateAutoModWord(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const phrase = String(source.phrase || '').trim();
  const matchType = String(source.matchType || 'PARTIAL').trim().toUpperCase();
  const severity = String(source.severity || 'MEDIUM').trim().toUpperCase();
  const action = String(source.action || 'TIMEOUT').trim().toUpperCase();
  const errors = [];
  if (!phrase || phrase.length > 200) errors.push('Le mot ou expression doit contenir entre 1 et 200 caractères.');
  if (!AUTOMOD_MATCH_TYPES.has(matchType)) errors.push('Le mode de correspondance est invalide.');
  if (!AUTOMOD_SEVERITIES.has(severity)) errors.push('La sévérité AutoMod est invalide.');
  if (!AUTOMOD_ACTIONS.has(action)) errors.push('L’action AutoMod est invalide.');
  return { errors, data: { phrase, matchType, severity, action, enabled: source.enabled !== false } };
}

function autoModStorage(prisma) {
  if (!prisma?.autoModRule || !prisma?.autoModWord || !prisma?.autoModException) {
    const error = new Error('AutoMod storage is unavailable');
    error.code = 'BOT920_AUTOMOD_STORAGE_UNAVAILABLE';
    throw error;
  }
  return prisma;
}

function isAutoModStorageUnavailable(error) {
  return error?.code === 'P2021' || error?.code === 'P2022' || error?.code === 'BOT920_AUTOMOD_STORAGE_UNAVAILABLE';
}

function logStorage(prisma) {
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

function validateLogRule(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const type = String(source.type || 'MODERATION').trim().toUpperCase();
  const channelId = String(source.channelId || '').trim();
  const errors = [];
  if (!LOG_RULE_TYPES.has(type)) errors.push('Le type de journal est invalide.');
  if (!isSnowflake(channelId)) errors.push('Le canal de journal doit être un identifiant Discord valide.');
  return { errors, data: { type, enabled: source.enabled !== false, channelId } };
}

async function validateLogChannel(prisma, guildId, channelId) {
  const channel = await prisma.discordGuildChannel.findFirst({ where: { id: channelId, guildId }, select: { id: true, name: true, type: true } });
  return channel && TEXT_CHANNEL_TYPES.has(channel.type) ? channel : null;
}

function logPreview(rule, source = {}) {
  const eventType = MODERATION_LOG_EVENT_TYPES.has(String(source.eventType || '').toLowerCase()) ? String(source.eventType).toLowerCase() : 'ban';
  const targetTag = text(source.targetTag, 'Membre Discord', 100);
  const moderatorTag = text(source.moderatorTag, 'Modérateur Discord', 100);
  const reason = text(source.reason, 'Aucun motif précisé.', 400);
  return {
    rule: { id: rule?.id ?? null, type: rule?.type ?? 'MODERATION', enabled: rule?.enabled !== false, channelId: rule?.channelId ?? '' },
    event: { eventType, targetTag, moderatorTag, reason, durationMinutes: optionalInteger(source.durationMinutes, 1, 43_200) ?? null },
    content: `Modération : ${targetTag} - ${eventType} par ${moderatorTag}. Motif : ${reason}`,
  };
}

function auditLogRule(prisma, request, guildId, action, beforeData, afterData) {
  return prisma.bot920PanelAuditEvent.create({ data: {
    guildId, actorId: request.user?.id ?? null, actorName: request.user?.username ?? request.user?.email ?? null,
    module: 'logs', action, beforeData, afterData,
  } });
}

function auditAutoMod(prisma, request, guildId, action, beforeData, afterData) {
  return prisma.bot920PanelAuditEvent.create({ data: {
    guildId, actorId: request.user?.id ?? null, actorName: request.user?.username ?? request.user?.email ?? null,
    module: 'automod', action, beforeData, afterData,
  } });
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
  const sourcePlugins = pluginSource(source);
  const sourceAutomod = sourcePlugins.automod && typeof sourcePlugins.automod === 'object' ? sourcePlugins.automod : {};
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
    plugins: {
      reactionRoles: plugin(sourcePlugins.reactionRoles, defaultBot920Configuration.plugins.reactionRoles),
      tickets: plugin(sourcePlugins.tickets, defaultBot920Configuration.plugins.tickets),
      automations: plugin(sourcePlugins.automations, defaultBot920Configuration.plugins.automations),
      pollsGiveaways: plugin(sourcePlugins.pollsGiveaways, defaultBot920Configuration.plugins.pollsGiveaways),
      reminders: plugin(sourcePlugins.reminders, defaultBot920Configuration.plugins.reminders),
      levels: plugin(sourcePlugins.levels, defaultBot920Configuration.plugins.levels),
      socialAlerts: plugin(sourcePlugins.socialAlerts, defaultBot920Configuration.plugins.socialAlerts),
      statisticsChannels: plugin(sourcePlugins.statisticsChannels, defaultBot920Configuration.plugins.statisticsChannels),
      music: plugin(sourcePlugins.music, defaultBot920Configuration.plugins.music),
      automod: {
        enabled: sourceAutomod.enabled === true,
        antiSpam: sourceAutomod.antiSpam !== false,
        antiRaid: sourceAutomod.antiRaid !== false,
        blockedLinks: sourceAutomod.blockedLinks === true,
        alertChannelId: snowflake(sourceAutomod.alertChannelId),
        spamMessageLimit: integer(sourceAutomod.spamMessageLimit, defaultBot920Configuration.plugins.automod.spamMessageLimit, 2, 20),
        spamWindowSeconds: integer(sourceAutomod.spamWindowSeconds, defaultBot920Configuration.plugins.automod.spamWindowSeconds, 2, 300),
        timeoutMinutes: integer(sourceAutomod.timeoutMinutes, defaultBot920Configuration.plugins.automod.timeoutMinutes, 1, 40_320),
        raidJoinLimit: integer(sourceAutomod.raidJoinLimit, defaultBot920Configuration.plugins.automod.raidJoinLimit, 2, 100),
        raidWindowSeconds: integer(sourceAutomod.raidWindowSeconds, defaultBot920Configuration.plugins.automod.raidWindowSeconds, 5, 600),
      },
    },
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

  router.get('/guilds', async (request, response) => {
    try {
      const prisma = guildFoundationStorage(request.app.locals.prisma);
      const guilds = await prisma.discordGuild.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, iconUrl: true, memberCount: true, lastSyncedAt: true, settings: { select: { version: true, publishedAt: true } } },
      });
      response.json({ guilds });
    } catch (error) {
      if (isGuildFoundationStorageUnavailable(error)) return response.status(503).json({ error: 'La synchronisation des serveurs Discord n’est pas encore disponible.' });
      console.error('Unable to load Bot 920 Discord guilds:', error);
      response.status(500).json({ error: 'Impossible de charger les serveurs Discord.' });
    }
  });

  router.get('/guilds/:guildId/context', async (request, response) => {
    if (!isSnowflake(request.params.guildId)) return response.status(400).json({ error: 'Identifiant de serveur Discord invalide.' });
    try {
      const prisma = guildFoundationStorage(request.app.locals.prisma);
      const guild = await prisma.discordGuild.findUnique({
        where: { id: request.params.guildId },
        include: {
          channels: { orderBy: [{ position: 'asc' }, { name: 'asc' }] },
          roles: { orderBy: [{ position: 'desc' }, { name: 'asc' }] },
          settings: { select: { version: true, publishedAt: true, updatedAt: true } },
        },
      });
      if (!guild) return response.status(404).json({ error: 'Serveur Discord introuvable. Attendez la prochaine synchronisation du bot.' });
      response.json({ guild });
    } catch (error) {
      if (isGuildFoundationStorageUnavailable(error)) return response.status(503).json({ error: 'Le contexte Discord est temporairement indisponible.' });
      console.error('Unable to load Bot 920 Discord guild context:', error);
      response.status(500).json({ error: 'Impossible de charger le contexte Discord.' });
    }
  });

  router.get('/guilds/:guildId/settings', async (request, response) => {
    if (!isSnowflake(request.params.guildId)) return response.status(400).json({ error: 'Identifiant de serveur Discord invalide.' });
    try {
      const prisma = guildFoundationStorage(request.app.locals.prisma);
      const guild = await prisma.discordGuild.findUnique({ where: { id: request.params.guildId }, select: { id: true, settings: true } });
      if (!guild) return response.status(404).json({ error: 'Serveur Discord introuvable.' });
      response.json({ configuration: normalizeBot920Configuration(guild.settings?.data), version: guild.settings?.version ?? 0, publishedAt: guild.settings?.publishedAt ?? null });
    } catch (error) {
      if (isGuildFoundationStorageUnavailable(error)) return response.status(503).json({ error: 'La configuration par serveur est indisponible.' });
      console.error('Unable to load Bot 920 guild settings:', error);
      response.status(500).json({ error: 'Impossible de charger la configuration du serveur.' });
    }
  });

  router.put('/guilds/:guildId/settings', async (request, response) => {
    if (!isSnowflake(request.params.guildId)) return response.status(400).json({ error: 'Identifiant de serveur Discord invalide.' });
    const errors = validateBot920Configuration(request.body?.configuration);
    if (errors.length) return response.status(400).json({ error: errors[0], errors });
    const configuration = normalizeBot920Configuration(request.body.configuration);
    try {
      const prisma = guildFoundationStorage(request.app.locals.prisma);
      const guild = await prisma.discordGuild.findUnique({ where: { id: request.params.guildId }, select: { id: true } });
      if (!guild) return response.status(404).json({ error: 'Serveur Discord introuvable.' });
      const previous = await prisma.bot920GuildSettings.findUnique({ where: { guildId: guild.id } });
      const settings = await prisma.bot920GuildSettings.upsert({
        where: { guildId: guild.id },
        create: { guildId: guild.id, data: configuration },
        update: { data: configuration, version: { increment: 1 }, publishedAt: new Date() },
      });
      await prisma.bot920PanelAuditEvent.create({ data: {
        guildId: guild.id, actorId: request.user?.id ?? null, actorName: request.user?.username ?? null,
        module: 'configuration', action: 'publish', beforeData: previous?.data ?? null, afterData: configuration,
      } });
      response.json({ configuration: normalizeBot920Configuration(settings.data), version: settings.version, publishedAt: settings.publishedAt });
    } catch (error) {
      if (isGuildFoundationStorageUnavailable(error)) return response.status(503).json({ error: 'La configuration par serveur est indisponible.' });
      console.error('Unable to publish Bot 920 guild settings:', error);
      response.status(500).json({ error: 'Impossible de publier la configuration du serveur.' });
    }
  });

  router.get('/guilds/:guildId/audit', async (request, response) => {
    if (!isSnowflake(request.params.guildId)) return response.status(400).json({ error: 'Identifiant de serveur Discord invalide.' });
    try {
      const prisma = guildFoundationStorage(request.app.locals.prisma);
      const events = await prisma.bot920PanelAuditEvent.findMany({ where: { guildId: request.params.guildId }, orderBy: { createdAt: 'desc' }, take: 100 });
      response.json({ events });
    } catch (error) {
      if (isGuildFoundationStorageUnavailable(error)) return response.status(503).json({ error: 'Le journal d’audit est indisponible.' });
      console.error('Unable to load Bot 920 audit events:', error);
      response.status(500).json({ error: 'Impossible de charger le journal d’audit.' });
    }
  });

  router.get('/guilds/:guildId/moderation-cases', async (request, response) => {
    if (!isSnowflake(request.params.guildId)) return response.status(400).json({ error: 'Identifiant de serveur Discord invalide.' });
    try {
      const prisma = guildFoundationStorage(request.app.locals.prisma);
      if (!prisma.discordModerationCase) return response.status(503).json({ error: 'Le stockage de modération est indisponible.' });
      const cases = await prisma.discordModerationCase.findMany({
        where: { guildId: request.params.guildId },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
      response.json({ cases });
    } catch (error) {
      if (isGuildFoundationStorageUnavailable(error) || error?.code === 'P2021' || error?.code === 'P2022') return response.status(503).json({ error: 'L’historique de modération est indisponible.' });
      console.error('Unable to load Bot 920 moderation cases:', error);
      response.status(500).json({ error: 'Impossible de charger l’historique de modération.' });
    }
  });

  router.get('/guilds/:guildId/logging', async (request, response) => {
    if (!isSnowflake(request.params.guildId)) return response.status(400).json({ error: 'Identifiant de serveur Discord invalide.' });
    try {
      const prisma = logStorage(guildFoundationStorage(request.app.locals.prisma));
      const guild = await prisma.discordGuild.findUnique({ where: { id: request.params.guildId }, select: { id: true } });
      if (!guild) return response.status(404).json({ error: 'Serveur Discord introuvable.' });
      const rules = await prisma.discordLogRule.findMany({ where: { guildId: guild.id }, orderBy: { createdAt: 'asc' } });
      response.json({ rules });
    } catch (error) {
      if (isLogStorageUnavailable(error) || isGuildFoundationStorageUnavailable(error)) return response.status(503).json({ error: 'Le stockage des journaux est indisponible.' });
      console.error('Unable to load Discord log rules:', error);
      response.status(500).json({ error: 'Impossible de charger les règles de journaux.' });
    }
  });

  router.post('/guilds/:guildId/logging/rules', async (request, response) => {
    if (!isSnowflake(request.params.guildId)) return response.status(400).json({ error: 'Identifiant de serveur Discord invalide.' });
    const { errors, data } = validateLogRule(request.body);
    if (errors.length) return response.status(400).json({ error: errors[0], errors });
    try {
      const prisma = logStorage(guildFoundationStorage(request.app.locals.prisma));
      const guild = await prisma.discordGuild.findUnique({ where: { id: request.params.guildId }, select: { id: true } });
      if (!guild) return response.status(404).json({ error: 'Serveur Discord introuvable.' });
      if (!await validateLogChannel(prisma, guild.id, data.channelId)) return response.status(400).json({ error: 'Le salon de journal doit être un salon textuel synchronisé de ce serveur.' });
      const rule = await prisma.$transaction(async (transaction) => {
        const created = await transaction.discordLogRule.create({ data: { ...data, guildId: guild.id } });
        await auditLogRule(transaction, request, guild.id, 'rule.create', null, created);
        return created;
      });
      response.status(201).json({ rule });
    } catch (error) {
      if (error?.code === 'P2002') return response.status(409).json({ error: 'Une règle de journaux de ce type existe déjà pour ce serveur.' });
      if (isLogStorageUnavailable(error) || isGuildFoundationStorageUnavailable(error)) return response.status(503).json({ error: 'Le stockage des journaux est indisponible.' });
      console.error('Unable to create Discord log rule:', error);
      response.status(500).json({ error: 'Impossible de créer la règle de journaux.' });
    }
  });

  router.put('/guilds/:guildId/logging/rules/:ruleId', async (request, response) => {
    if (!isSnowflake(request.params.guildId)) return response.status(400).json({ error: 'Identifiant de serveur Discord invalide.' });
    const { errors, data } = validateLogRule(request.body);
    if (errors.length) return response.status(400).json({ error: errors[0], errors });
    try {
      const prisma = logStorage(guildFoundationStorage(request.app.locals.prisma));
      const existing = await prisma.discordLogRule.findFirst({ where: { id: request.params.ruleId, guildId: request.params.guildId } });
      if (!existing) return response.status(404).json({ error: 'Règle de journaux introuvable.' });
      if (!await validateLogChannel(prisma, existing.guildId, data.channelId)) return response.status(400).json({ error: 'Le salon de journal doit être un salon textuel synchronisé de ce serveur.' });
      const rule = await prisma.$transaction(async (transaction) => {
        const updated = await transaction.discordLogRule.update({ where: { id: existing.id }, data });
        await auditLogRule(transaction, request, existing.guildId, 'rule.update', existing, updated);
        return updated;
      });
      response.json({ rule });
    } catch (error) {
      if (error?.code === 'P2002') return response.status(409).json({ error: 'Une règle de journaux de ce type existe déjà pour ce serveur.' });
      if (isLogStorageUnavailable(error) || isGuildFoundationStorageUnavailable(error)) return response.status(503).json({ error: 'Le stockage des journaux est indisponible.' });
      console.error('Unable to update Discord log rule:', error);
      response.status(500).json({ error: 'Impossible de modifier la règle de journaux.' });
    }
  });

  router.delete('/guilds/:guildId/logging/rules/:ruleId', async (request, response) => {
    if (!isSnowflake(request.params.guildId)) return response.status(400).json({ error: 'Identifiant de serveur Discord invalide.' });
    try {
      const prisma = logStorage(guildFoundationStorage(request.app.locals.prisma));
      const existing = await prisma.discordLogRule.findFirst({ where: { id: request.params.ruleId, guildId: request.params.guildId } });
      if (!existing) return response.status(404).json({ error: 'Règle de journaux introuvable.' });
      await prisma.$transaction(async (transaction) => {
        await transaction.discordLogRule.delete({ where: { id: existing.id } });
        await auditLogRule(transaction, request, existing.guildId, 'rule.delete', existing, null);
      });
      response.status(204).end();
    } catch (error) {
      if (isLogStorageUnavailable(error) || isGuildFoundationStorageUnavailable(error)) return response.status(503).json({ error: 'Le stockage des journaux est indisponible.' });
      console.error('Unable to delete Discord log rule:', error);
      response.status(500).json({ error: 'Impossible de supprimer la règle de journaux.' });
    }
  });

  router.get('/guilds/:guildId/logging/events', async (request, response) => {
    if (!isSnowflake(request.params.guildId)) return response.status(400).json({ error: 'Identifiant de serveur Discord invalide.' });
    try {
      const prisma = logStorage(guildFoundationStorage(request.app.locals.prisma));
      const events = await prisma.discordLogEvent.findMany({ where: { guildId: request.params.guildId }, orderBy: { createdAt: 'desc' }, take: 200 });
      response.json({ events });
    } catch (error) {
      if (isLogStorageUnavailable(error) || isGuildFoundationStorageUnavailable(error)) return response.status(503).json({ error: 'Le stockage des journaux est indisponible.' });
      console.error('Unable to load Discord log events:', error);
      response.status(500).json({ error: 'Impossible de charger les événements de journaux.' });
    }
  });

  router.post('/guilds/:guildId/logging/preview', async (request, response) => {
    if (!isSnowflake(request.params.guildId)) return response.status(400).json({ error: 'Identifiant de serveur Discord invalide.' });
    try {
      const prisma = logStorage(guildFoundationStorage(request.app.locals.prisma));
      const rule = await prisma.discordLogRule.findFirst({ where: { guildId: request.params.guildId, type: 'MODERATION' } });
      response.json({ preview: logPreview(rule, request.body) });
    } catch (error) {
      if (isLogStorageUnavailable(error) || isGuildFoundationStorageUnavailable(error)) return response.status(503).json({ error: 'Le stockage des journaux est indisponible.' });
      console.error('Unable to preview Discord log:', error);
      response.status(500).json({ error: 'Impossible de générer l’aperçu du journal.' });
    }
  });

  router.get('/guilds/:guildId/automod', async (request, response) => {
    if (!isSnowflake(request.params.guildId)) return response.status(400).json({ error: 'Identifiant de serveur Discord invalide.' });
    try {
      const prisma = autoModStorage(guildFoundationStorage(request.app.locals.prisma));
      const guild = await prisma.discordGuild.findUnique({ where: { id: request.params.guildId }, select: { id: true } });
      if (!guild) return response.status(404).json({ error: 'Serveur Discord introuvable.' });
      const [rules, words] = await Promise.all([
        prisma.autoModRule.findMany({ where: { guildId: guild.id }, include: { exceptions: { orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'asc' } }),
        prisma.autoModWord.findMany({ where: { guildId: guild.id }, orderBy: { phrase: 'asc' } }),
      ]);
      response.json({ rules, words });
    } catch (error) {
      if (isAutoModStorageUnavailable(error) || isGuildFoundationStorageUnavailable(error)) return response.status(503).json({ error: 'Le stockage AutoMod est indisponible.' });
      console.error('Unable to load AutoMod configuration:', error);
      response.status(500).json({ error: 'Impossible de charger la configuration AutoMod.' });
    }
  });

  router.post('/guilds/:guildId/automod/rules', async (request, response) => {
    if (!isSnowflake(request.params.guildId)) return response.status(400).json({ error: 'Identifiant de serveur Discord invalide.' });
    const { errors, data } = validateAutoModRule(request.body);
    if (errors.length) return response.status(400).json({ error: errors[0], errors });
    try {
      const prisma = autoModStorage(guildFoundationStorage(request.app.locals.prisma));
      const guild = await prisma.discordGuild.findUnique({ where: { id: request.params.guildId }, select: { id: true } });
      if (!guild) return response.status(404).json({ error: 'Serveur Discord introuvable.' });
      const rule = await prisma.$transaction(async (transaction) => {
        const created = await transaction.autoModRule.create({ data: { ...data, guildId: guild.id, exceptions: { create: data.exceptions } }, include: { exceptions: true } });
        await auditAutoMod(transaction, request, guild.id, 'rule.create', null, created);
        return created;
      });
      response.status(201).json({ rule });
    } catch (error) {
      if (error?.code === 'P2002') return response.status(409).json({ error: 'Une règle de ce type existe déjà pour ce serveur.' });
      if (isAutoModStorageUnavailable(error) || isGuildFoundationStorageUnavailable(error)) return response.status(503).json({ error: 'Le stockage AutoMod est indisponible.' });
      console.error('Unable to create AutoMod rule:', error);
      response.status(500).json({ error: 'Impossible de créer la règle AutoMod.' });
    }
  });

  router.put('/guilds/:guildId/automod/rules/:ruleId', async (request, response) => {
    if (!isSnowflake(request.params.guildId)) return response.status(400).json({ error: 'Identifiant de serveur Discord invalide.' });
    const { errors, data } = validateAutoModRule(request.body);
    if (errors.length) return response.status(400).json({ error: errors[0], errors });
    try {
      const prisma = autoModStorage(guildFoundationStorage(request.app.locals.prisma));
      const existing = await prisma.autoModRule.findFirst({ where: { id: request.params.ruleId, guildId: request.params.guildId }, include: { exceptions: true } });
      if (!existing) return response.status(404).json({ error: 'Règle AutoMod introuvable.' });
      const rule = await prisma.$transaction(async (transaction) => {
        const updated = await transaction.autoModRule.update({
          where: { id: existing.id }, data: { ...data, exceptions: { deleteMany: {}, create: data.exceptions } }, include: { exceptions: true },
        });
        await auditAutoMod(transaction, request, existing.guildId, 'rule.update', existing, updated);
        return updated;
      });
      response.json({ rule });
    } catch (error) {
      if (error?.code === 'P2002') return response.status(409).json({ error: 'Une règle de ce type existe déjà pour ce serveur.' });
      if (isAutoModStorageUnavailable(error) || isGuildFoundationStorageUnavailable(error)) return response.status(503).json({ error: 'Le stockage AutoMod est indisponible.' });
      console.error('Unable to update AutoMod rule:', error);
      response.status(500).json({ error: 'Impossible de modifier la règle AutoMod.' });
    }
  });

  router.delete('/guilds/:guildId/automod/rules/:ruleId', async (request, response) => {
    if (!isSnowflake(request.params.guildId)) return response.status(400).json({ error: 'Identifiant de serveur Discord invalide.' });
    try {
      const prisma = autoModStorage(guildFoundationStorage(request.app.locals.prisma));
      const existing = await prisma.autoModRule.findFirst({ where: { id: request.params.ruleId, guildId: request.params.guildId }, include: { exceptions: true } });
      if (!existing) return response.status(404).json({ error: 'Règle AutoMod introuvable.' });
      await prisma.$transaction(async (transaction) => {
        await transaction.autoModRule.delete({ where: { id: existing.id } });
        await auditAutoMod(transaction, request, existing.guildId, 'rule.delete', existing, null);
      });
      response.status(204).end();
    } catch (error) {
      if (isAutoModStorageUnavailable(error) || isGuildFoundationStorageUnavailable(error)) return response.status(503).json({ error: 'Le stockage AutoMod est indisponible.' });
      console.error('Unable to delete AutoMod rule:', error);
      response.status(500).json({ error: 'Impossible de supprimer la règle AutoMod.' });
    }
  });

  router.post('/guilds/:guildId/automod/words', async (request, response) => {
    if (!isSnowflake(request.params.guildId)) return response.status(400).json({ error: 'Identifiant de serveur Discord invalide.' });
    const { errors, data } = validateAutoModWord(request.body);
    if (errors.length) return response.status(400).json({ error: errors[0], errors });
    try {
      const prisma = autoModStorage(guildFoundationStorage(request.app.locals.prisma));
      const guild = await prisma.discordGuild.findUnique({ where: { id: request.params.guildId }, select: { id: true } });
      if (!guild) return response.status(404).json({ error: 'Serveur Discord introuvable.' });
      const word = await prisma.$transaction(async (transaction) => {
        const created = await transaction.autoModWord.create({ data: { ...data, guildId: guild.id } });
        await auditAutoMod(transaction, request, guild.id, 'word.create', null, created);
        return created;
      });
      response.status(201).json({ word });
    } catch (error) {
      if (error?.code === 'P2002') return response.status(409).json({ error: 'Cette expression existe déjà pour ce serveur.' });
      if (isAutoModStorageUnavailable(error) || isGuildFoundationStorageUnavailable(error)) return response.status(503).json({ error: 'Le stockage AutoMod est indisponible.' });
      console.error('Unable to create AutoMod word:', error);
      response.status(500).json({ error: 'Impossible d’ajouter le mot filtré.' });
    }
  });

  router.put('/guilds/:guildId/automod/words/:wordId', async (request, response) => {
    if (!isSnowflake(request.params.guildId)) return response.status(400).json({ error: 'Identifiant de serveur Discord invalide.' });
    const { errors, data } = validateAutoModWord(request.body);
    if (errors.length) return response.status(400).json({ error: errors[0], errors });
    try {
      const prisma = autoModStorage(guildFoundationStorage(request.app.locals.prisma));
      const existing = await prisma.autoModWord.findFirst({ where: { id: request.params.wordId, guildId: request.params.guildId } });
      if (!existing) return response.status(404).json({ error: 'Mot filtré introuvable.' });
      const word = await prisma.$transaction(async (transaction) => {
        const updated = await transaction.autoModWord.update({ where: { id: existing.id }, data });
        await auditAutoMod(transaction, request, existing.guildId, 'word.update', existing, updated);
        return updated;
      });
      response.json({ word });
    } catch (error) {
      if (error?.code === 'P2002') return response.status(409).json({ error: 'Cette expression existe déjà pour ce serveur.' });
      if (isAutoModStorageUnavailable(error) || isGuildFoundationStorageUnavailable(error)) return response.status(503).json({ error: 'Le stockage AutoMod est indisponible.' });
      console.error('Unable to update AutoMod word:', error);
      response.status(500).json({ error: 'Impossible de modifier le mot filtré.' });
    }
  });

  router.delete('/guilds/:guildId/automod/words/:wordId', async (request, response) => {
    if (!isSnowflake(request.params.guildId)) return response.status(400).json({ error: 'Identifiant de serveur Discord invalide.' });
    try {
      const prisma = autoModStorage(guildFoundationStorage(request.app.locals.prisma));
      const existing = await prisma.autoModWord.findFirst({ where: { id: request.params.wordId, guildId: request.params.guildId } });
      if (!existing) return response.status(404).json({ error: 'Mot filtré introuvable.' });
      await prisma.$transaction(async (transaction) => {
        await transaction.autoModWord.delete({ where: { id: existing.id } });
        await auditAutoMod(transaction, request, existing.guildId, 'word.delete', existing, null);
      });
      response.status(204).end();
    } catch (error) {
      if (isAutoModStorageUnavailable(error) || isGuildFoundationStorageUnavailable(error)) return response.status(503).json({ error: 'Le stockage AutoMod est indisponible.' });
      console.error('Unable to delete AutoMod word:', error);
      response.status(500).json({ error: 'Impossible de supprimer le mot filtré.' });
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