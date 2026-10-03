import { Router } from 'express';

const CONFIGURATION_ID = 'default';
const COMMANDS = ['ping', 'about', 'anniversaire', 'phrase', 'bus', 'panne', 'destin', 'controle', 'diagnostic', 'tirage'];

export const defaultBot920Configuration = {
  general: { name: '920 Le Bot !', description: 'Le bot communautaire officiel de RétroBus Essonne.' },
  commands: { enabled: Object.fromEntries(COMMANDS.map((command) => [command, true])) },
  messages: { aboutStatus: 'Socle technique en cours de déploiement' },
  socialLinks: { website: '', instagram: '', discord: '' },
  welcome: { enabled: false, message: 'Bienvenue sur le serveur RétroBus Essonne !' },
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

export function normalizeBot920Configuration(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const sourceCommands = source.commands?.enabled && typeof source.commands.enabled === 'object' ? source.commands.enabled : {};
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
      enabled: source.welcome?.enabled === true,
      message: text(source.welcome?.message, defaultBot920Configuration.welcome.message, 1_000),
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