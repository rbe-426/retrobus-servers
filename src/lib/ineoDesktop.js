import crypto from 'node:crypto';

// Plan d'un véhicule vu de dessus : largeur = PLAN_ASPECT x hauteur. Les écrans y sont placés en pourcentages.
export const PLAN_ASPECT = 2.5;
export const SCREEN_PLACES = {
  FRONT_DESTINATION: 'Girouette avant',
  SIDE_DESTINATION: 'Girouette latérale',
  REAR_DESTINATION: 'Girouette arrière',
  INSIDE_FRONT: 'Intérieur avant',
  INSIDE_MIDDLE: 'Intérieur milieu',
  INSIDE_REAR: 'Intérieur arrière',
  CUSTOM: 'Emplacement libre',
};
export const PILOT_COMMAND_TYPES = ['CHECK_UPDATE', 'RELOAD', 'TEST_SOUND', 'TEST_SCREEN'];
export const MEDIA_ID_PATTERN = /^[a-f0-9]{32}$/;
export const MAX_MEDIA_BYTES = 6 * 1024 * 1024;
export const PILOT_ONLINE_WINDOW_MS = 45_000;
const COMMAND_EXPIRY_MS = 10 * 60_000;

// Numéro de série de l'UC (ordinateur embarqué) : les valeurs génériques des constructeurs ne distinguent pas deux postes.
const UC_SERIAL_PLACEHOLDERS = new Set(['TOBEFILLEDBYO.E.M.', 'DEFAULTSTRING', 'SYSTEMSERIALNUMBER', 'NOTAVAILABLE', 'NOTAPPLICABLE', 'NONE', 'UNKNOWN', 'N/A', 'NA', '123456789', '0123456789']);
export const normalizeUcSerial = (value) => String(value || '').replace(/\s+/g, '').toUpperCase();
export const isValidUcSerial = (serial) => /^[A-Z0-9._\-/]{4,64}$/.test(serial) && !UC_SERIAL_PLACEHOLDERS.has(serial) && !/^(.)\1+$/.test(serial);

export const newMediaId = () => crypto.randomBytes(16).toString('hex');

export const detectImageMime = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.subarray(0, 4).toString('ascii') === 'GIF8') return 'image/gif';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finite = (value) => (value !== '' && value != null && Number.isFinite(Number(value)) ? Number(value) : null);
const mediaIdOrNull = (value) => (value ? String(value) : null);

export const screenHeightPct = (screen) => screen.widthPct * PLAN_ASPECT * (screen.heightPx / screen.widthPx);

export function validateScreenProfileInput(body = {}) {
  const name = String(body.name || '').trim();
  if (name.length < 1 || name.length > 80) return { error: 'Le nom du profil est obligatoire (80 caractères maximum).' };
  const description = String(body.description || '').trim().slice(0, 300) || null;
  const rawScreens = Array.isArray(body.screens) ? body.screens : [];
  if (rawScreens.length > 24) return { error: 'Un profil ne peut pas contenir plus de 24 écrans.' };

  const screens = [];
  for (const [index, raw] of rawScreens.entries()) {
    const screenName = String(raw?.name || '').trim();
    if (!screenName || screenName.length > 80) return { error: `L'écran n°${index + 1} doit avoir un nom (80 caractères maximum).` };
    const widthPx = finite(raw.widthPx);
    const heightPx = finite(raw.heightPx);
    if (!Number.isInteger(widthPx) || !Number.isInteger(heightPx) || widthPx < 64 || widthPx > 7680 || heightPx < 64 || heightPx > 4320) {
      return { error: `La taille de l'écran « ${screenName} » est invalide (64 à 7680 × 64 à 4320 pixels).` };
    }
    const widthPct = clamp(finite(raw.widthPct) ?? 16, 3, 60);
    const heightPct = widthPct * PLAN_ASPECT * (heightPx / widthPx);
    for (const key of ['offlineMediaId', 'onlineMediaId']) {
      if (raw[key] && !MEDIA_ID_PATTERN.test(String(raw[key]))) return { error: `L'image de l'écran « ${screenName} » est invalide.` };
    }
    screens.push({
      id: raw.id ? String(raw.id) : undefined,
      name: screenName,
      place: Object.prototype.hasOwnProperty.call(SCREEN_PLACES, raw.place) ? raw.place : 'CUSTOM',
      x: clamp(finite(raw.x) ?? 0, 0, Math.max(0, 100 - widthPct)),
      y: clamp(finite(raw.y) ?? 0, 0, Math.max(0, 100 - heightPct)),
      widthPct,
      widthPx,
      heightPx,
      offlineMediaId: mediaIdOrNull(raw.offlineMediaId),
      onlineMediaId: mediaIdOrNull(raw.onlineMediaId),
      sortOrder: index,
    });
  }
  return { value: { name, description, screens } };
}

export function serializeScreenProfile(profile) {
  if (!profile) return null;
  const screens = [...(profile.screens || [])]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((screen) => ({
      id: screen.id, name: screen.name, place: screen.place, x: screen.x, y: screen.y, widthPct: screen.widthPct,
      widthPx: screen.widthPx, heightPx: screen.heightPx, offlineMediaId: screen.offlineMediaId || null, onlineMediaId: screen.onlineMediaId || null,
    }));
  // La révision change dès qu'un réglage ou une image change : le logiciel de l'UC ne retélécharge que si elle diffère.
  // Les identifiants d'écran sont exclus : ils sont recréés à chaque enregistrement sans que rien n'ait changé.
  const comparable = screens.map(({ id, ...rest }) => rest);
  const revision = crypto.createHash('sha1').update(JSON.stringify({ name: profile.name, screens: comparable })).digest('hex').slice(0, 12);
  return { id: profile.id, name: profile.name, description: profile.description || null, revision, screens };
}

const COMMAND_ID_PATTERN = /^[A-Za-z0-9]{10,40}$/;

// Point d'entrée unique du logiciel de l'UC : identification, état, profil écran et commandes du véhicule pilote.
export async function handleDesktopSync({ prisma, body = {}, now = new Date() }) {
  const serial = normalizeUcSerial(body.serial);
  if (!isValidUcSerial(serial)) return { status: 400, payload: { error: 'Numéro de série UC invalide ou non exploitable.' } };

  const hostname = String(body.hostname || '').trim().slice(0, 100) || null;
  const appVersion = /^\d+(?:\.\d+){1,3}$/.test(String(body.appVersion || '')) ? String(body.appVersion) : null;
  const networkOnline = body.online !== false;
  const screensRevision = /^[a-f0-9]{1,40}$/.test(String(body.screensRevision || '')) ? String(body.screensRevision) : null;
  const results = (Array.isArray(body.commandResults) ? body.commandResults : []).slice(0, 20)
    .filter((entry) => COMMAND_ID_PATTERN.test(String(entry?.id || '')) && ['DONE', 'FAILED'].includes(entry?.status));

  await prisma.ineoUcDevice.upsert({
    where: { serial },
    create: { serial, hostname, appVersion, networkOnline, screensRevision, firstSeenAt: now, lastSeenAt: now },
    update: { hostname, appVersion, networkOnline, screensRevision, lastSeenAt: now },
  });

  const screenInclude = { screenProfile: { include: { screens: true } } };
  const pilot = await prisma.ineoPilotVehicle.findUnique({ where: { ucSerial: serial }, include: screenInclude });
  if (pilot) {
    for (const entry of results) {
      await prisma.ineoPilotCommand.updateMany({
        where: { id: entry.id, pilotId: pilot.id, status: { in: ['PENDING', 'DELIVERED'] } },
        data: { status: entry.status, result: String(entry.result || '').slice(0, 300) || null, completedAt: now },
      });
    }
    await prisma.ineoPilotCommand.updateMany({
      where: { pilotId: pilot.id, status: 'PENDING', createdAt: { lt: new Date(now.getTime() - COMMAND_EXPIRY_MS) } },
      data: { status: 'FAILED', result: 'Expirée : le poste pilote était hors ligne.', completedAt: now },
    });
    const pending = await prisma.ineoPilotCommand.findMany({ where: { pilotId: pilot.id, status: 'PENDING' }, orderBy: { createdAt: 'asc' }, take: 10 });
    if (pending.length) {
      await prisma.ineoPilotCommand.updateMany({ where: { id: { in: pending.map((command) => command.id) } }, data: { status: 'DELIVERED', deliveredAt: now } });
    }
    return {
      status: 200,
      payload: {
        registered: true, serial, isPilot: true, pilotName: pilot.name, vehicle: null, profile: null,
        screenProfile: serializeScreenProfile(pilot.screenProfile),
        commands: pending.map((command) => ({ id: command.id, type: command.type })),
      },
    };
  }

  const profile = await prisma.ineoVehicleProfile.findUnique({ where: { ucSerial: serial }, include: { vehicle: true, ...screenInclude } });
  if (!profile) return { status: 200, payload: { registered: false, serial, isPilot: false } };
  const { vehicle } = profile;
  return {
    status: 200,
    payload: {
      registered: true, serial, isPilot: false,
      vehicle: { parc: vehicle.parc, immat: vehicle.immat || null, marque: vehicle.marque || null, modele: vehicle.modele || null },
      profile: { vehicleType: profile.vehicleType, maxSpeedKmh: profile.maxSpeedKmh, lengthM: profile.lengthM, widthM: profile.widthM, heightM: profile.heightM, options: profile.options },
      screenProfile: serializeScreenProfile(profile.screenProfile),
      commands: [],
    },
  };
}
