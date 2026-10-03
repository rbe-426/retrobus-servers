import { Router } from 'express';

const CONFIGURATION_ID = 'default';
const COMMANDS = ['ping', 'about', 'anniversaire', 'phrase', 'bus', 'panne', 'destin', 'controle', 'diagnostic', 'tirage'];
const SNOWFLAKE_PATTERN = /^\d{17,20}$/;
const WELCOME_MESSAGE_MAX_LENGTH = 1_800;

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
  if (welcome.welcomeChannelId && !SNOWFLAKE_PATTERN.test(String(welcome.welcomeChannelId))) {
    errors.push('Le canal d’accueil doit être un identifiant Discord valide.');
  }
  if (welcome.autoRoleId && !SNOWFLAKE_PATTERN.test(String(welcome.autoRoleId))) {
    errors.push('Le rôle automatique doit être un identifiant Discord valide.');
  }
  if (welcomeEnabled === true && !SNOWFLAKE_PATTERN.test(String(welcome.welcomeChannelId || ''))) {
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

  router.get('/config', async (request, response) => {
    try {
      const record = await request.app.locals.prisma.bot920Configuration.findUnique({ where: { id: CONFIGURATION_ID } });
      response.json({ configuration: normalizeBot920Configuration(record?.data), updatedAt: record?.updatedAt ?? null });
    } catch (error) {
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
        const saved = await prisma.bot920Configuration.upsert({
          where: { id: CONFIGURATION_ID },
          create: { id: CONFIGURATION_ID, data: configuration },
          update: { data: configuration },
        });
        await prisma.bot920ConfigurationAudit.create({ data: { actorId, actorName, data: configuration } });
        return saved;
      });
      response.json({ configuration: normalizeBot920Configuration(record.data), updatedAt: record.updatedAt });
    } catch (error) {
      console.error('Unable to save Bot 920 configuration:', error);
      response.status(500).json({ error: 'Impossible d’enregistrer la configuration du bot.' });
    }
  });

  return router;
}