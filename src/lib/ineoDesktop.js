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

// IMEI d'une console mobile : 15 chiffres, clé de Luhn valide.
export const normalizeImei = (value) => String(value || '').replace(/[\s-]/g, '');
export function isValidImei(imei) {
  if (!/^\d{15}$/.test(imei)) return false;
  let sum = 0;
  for (let index = 0; index < 15; index += 1) {
    let digit = Number(imei[14 - index]);
    if (index % 2 === 1) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit;
  }
  return sum % 10 === 0;
}

// Contenu SAEIV d'une révision : annonces sonores et écrans, avec leurs fichiers (nom aléatoire + extension).
export const CONTENT_FILE_PATTERN = /^[a-f0-9]{32}\.(wav|mp3|wma|png|jpe?g|bmp|gif)$/;
export const MAX_CONTENT_FILE_BYTES = 25 * 1024 * 1024;
export const contentFolderOf = (name) => (/\.(wav|mp3|wma)$/.test(name) ? 'sounds' : 'screens');
const ANNOUNCEMENT_TRIGGERS = ['GPS', 'PRE', 'START'];

const finiteOr = (value, fallback) => (Number.isFinite(Number(value)) && value !== null && value !== '' ? Number(value) : fallback);
const textOf = (value, max) => String(value ?? '').trim().slice(0, max);
const contentFileOrNull = (value) => (CONTENT_FILE_PATTERN.test(String(value || '')) ? String(value) : null);

// Ne garde que les champs connus : le logiciel de l'UC applique tel quel ce qui est publié ici.
export function validateContentConfig(config) {
  if (config === undefined || config === null) return { value: null };
  if (typeof config !== 'object' || Array.isArray(config)) return { error: 'Contenu SAEIV invalide.' };
  const rawAnnouncements = Array.isArray(config.announcements) ? config.announcements : [];
  const rawScreens = Array.isArray(config.screens) ? config.screens : [];
  if (rawAnnouncements.length > 300 || rawScreens.length > 60) return { error: 'Le contenu SAEIV contient trop d’éléments.' };
  const announcements = rawAnnouncements.map((item) => ({
    id: textOf(item?.id, 40),
    name: textOf(item?.name, 120),
    trigger: ANNOUNCEMENT_TRIGGERS.includes(item?.trigger) ? item.trigger : 'PRE',
    latitude: finiteOr(item?.latitude, 0),
    longitude: finiteOr(item?.longitude, 0),
    distanceMeters: Math.min(5000, Math.max(0, Math.round(finiteOr(item?.distanceMeters, 100)))),
    soundFile: contentFileOrNull(item?.soundFile),
    soundName: textOf(item?.soundName, 120),
    enabled: item?.enabled !== false,
  }));
  const screens = rawScreens.map((item) => ({
    id: textOf(item?.id, 40),
    name: textOf(item?.name, 120),
    place: Object.prototype.hasOwnProperty.call(SCREEN_PLACES, item?.place) ? item.place : 'CUSTOM',
    x: Math.min(100, Math.max(0, finiteOr(item?.x, 0))),
    y: Math.min(100, Math.max(0, finiteOr(item?.y, 0))),
    widthPct: Math.min(100, Math.max(1, finiteOr(item?.widthPct, 16))),
    widthPx: Math.min(8192, Math.max(16, Math.round(finiteOr(item?.widthPx, 1280)))),
    heightPx: Math.min(8192, Math.max(16, Math.round(finiteOr(item?.heightPx, 720)))),
    offlineImage: contentFileOrNull(item?.offlineImage),
    offlineName: textOf(item?.offlineName, 120),
    onlineImage: contentFileOrNull(item?.onlineImage),
    onlineName: textOf(item?.onlineName, 120),
  }));
  const rawLines = Array.isArray(config.lines) ? config.lines : [];
  if (rawLines.length > 200) return { error: 'Le contenu SAEIV contient trop de lignes.' };
  const lines = rawLines.map(sanitizeContentLine).filter((line) => line.name);
  const files = [...new Set([...announcements.map((item) => item.soundFile), ...screens.flatMap((item) => [item.offlineImage, item.onlineImage])].filter(Boolean))];
  return { value: { announcements, screens, lines, files } };
}

const roundCoord = (value) => Math.round(finiteOr(value, 0) * 1e6) / 1e6;
const sanitizeStops = (value) => (Array.isArray(value) ? value : []).slice(0, 300).map((stop) => ({
  city: textOf(stop?.city, 80),
  label: textOf(stop?.label, 120),
  lat: roundCoord(stop?.lat),
  lng: roundCoord(stop?.lng),
}));
const sanitizePath = (value) => (Array.isArray(value) ? value : []).slice(0, 5000)
  .map((point) => (Array.isArray(point) ? [roundCoord(point[0]), roundCoord(point[1])] : [roundCoord(point?.lat), roundCoord(point?.lng)]));

// Ligne publiée : identité, destinations, couleur et itinéraires aller/retour (arrêts + tracé).
function sanitizeContentLine(item) {
  return {
    id: textOf(item?.id, 40),
    name: textOf(item?.name, 80),
    color: /^#[0-9a-fA-F]{6}$/.test(String(item?.color || '')) ? String(item.color) : '#9F063A',
    destination1: textOf(item?.destination1, 120),
    destination2: textOf(item?.destination2, 120),
    outboundStops: sanitizeStops(item?.outboundStops),
    outboundPath: sanitizePath(item?.outboundPath),
    returnStops: sanitizeStops(item?.returnStops),
    returnPath: sanitizePath(item?.returnPath),
  };
}

export const MAX_INSTALLER_BYTES = 60 * 1024 * 1024;
// Format ANNEE.MOIS.REVISION (ex. 26.11.001 : première révision de novembre 2026).
export const RELEASE_VERSION_PATTERN = /^\d{2}\.(?:0[1-9]|1[0-2])\.\d{3}$/;

// Un installateur Windows est un exécutable PE : il commence par « MZ ». Refuse les fichiers manifestement d'un autre type.
export const isWindowsExecutable = (buffer) => Buffer.isBuffer(buffer) && buffer.length > 1024 && buffer[0] === 0x4d && buffer[1] === 0x5a;
// Un APK est une archive ZIP : elle commence par « PK\x03\x04 ».
export const isAndroidPackage = (buffer) => Buffer.isBuffer(buffer) && buffer.length > 1024 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;

export const RELEASE_PRODUCTS = ['UC', 'MAINTENANCE', 'PLANNING', 'CONSOLE'];
export const normalizeProduct = (value) => {
  const product = String(value || 'UC').trim().toUpperCase();
  return RELEASE_PRODUCTS.includes(product) ? product : null;
};
const INSTALLER_FILE_PREFIX = { UC: 'Ineo-Retrobus-Setup', MAINTENANCE: 'Ineo-Maintenance-Setup', PLANNING: 'Ineo-Planning-Setup', CONSOLE: 'Ineo-Console' };

export function validateDesktopReleaseInput(body = {}) {
  const product = normalizeProduct(body.product);
  if (!product) return { error: 'Logiciel inconnu : UC, MAINTENANCE, PLANNING ou CONSOLE.' };
  const version = String(body.version || '').trim();
  if (!RELEASE_VERSION_PATTERN.test(version)) return { error: 'La version doit être au format ANNEE.MOIS.REVISION, par exemple 26.11.001.' };
  const notes = String(body.notes || '').trim().slice(0, 500) || null;
  const base64 = String(body.dataBase64 || '');
  if (!base64 || !/^[A-Za-z0-9+/=\s]+$/.test(base64)) return { error: 'Fichier invalide.' };
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length > MAX_INSTALLER_BYTES) return { error: `L’installateur doit faire moins de ${MAX_INSTALLER_BYTES / 1024 / 1024} Mo.`, status: 413 };
  const isApk = product === 'CONSOLE';
  if (isApk ? !isAndroidPackage(buffer) : !isWindowsExecutable(buffer)) return { error: isApk ? 'Ce fichier n’est pas un APK Android (.apk).' : 'Ce fichier n’est pas un installateur Windows (.exe).' };
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  return { value: { product, version, notes, buffer, sha256, size: buffer.length, fileName: `${INSTALLER_FILE_PREFIX[product]}-${version}.${isApk ? 'apk' : 'exe'}` } };
}

// Compare deux versions « a.b.c » : positif si left est plus récente.
export const compareVersions = (left, right) => {
  const parse = (version) => String(version).split('.').map((part) => Number.parseInt(part, 10) || 0);
  const [leftParts, rightParts] = [parse(left), parse(right)];
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference) return difference;
  }
  return 0;
};

export const DESKTOP_INSTALLER_ID_PATTERN = /^[a-z0-9]{20,32}$/;
const VERSION_PATTERN = /^\d+(?:\.\d+){1,3}$/;

// Manifeste de mise à jour du logiciel embarqué. Deux sources possibles :
// - les variables INEO_RBE_DESKTOP_* (installateur hébergé ailleurs, ex. GitHub Release) ;
// - l'installateur mis en ligne dans l'URBEX, servi par cette API (seule adresse joignable depuis un Windows ancien sans TLS 1.2).
// La version la plus récente l'emporte ; à version égale, l'installateur de l'URBEX est préféré.
export function buildUpdateManifest({ env = {}, release = null, currentVersion, baseUrl }) {
  if (!VERSION_PATTERN.test(String(currentVersion || ''))) return { status: 400, payload: { error: 'Version installée invalide.' } };

  const envVersion = String(env.version || '').trim();
  const envUrl = String(env.installerUrl || '').trim();
  const envSha = String(env.sha256 || '').trim().toLowerCase();
  const envTouched = Boolean(envVersion || envUrl || envSha);
  let envUrlIsHttps = false;
  try { envUrlIsHttps = new URL(envUrl).protocol === 'https:'; } catch { envUrlIsHttps = false; }
  const envComplete = VERSION_PATTERN.test(envVersion) && envUrlIsHttps && /^[a-f0-9]{64}$/.test(envSha);

  const candidates = [];
  if (release) {
    candidates.push({
      version: release.version, sha256: release.sha256, releaseNotes: release.notes || '',
      installerUrl: `${baseUrl}/api/ineo-rbe-desktop/installer/${release.id}`, source: 'urbex',
    });
  }
  if (envComplete) {
    candidates.push({
      version: envVersion, sha256: envSha, releaseNotes: String(env.releaseNotes || '').trim().slice(0, 500),
      installerUrl: envUrl, source: 'env',
    });
  }

  if (!candidates.length) {
    // Variables partiellement renseignées : erreur explicite ; rien de publié : pas de mise à jour, ce n'est pas une erreur.
    if (envTouched) return { status: 503, payload: { error: 'Le manifeste de mise à jour Inéo RétroBus est incomplet : vérifiez les variables INEO_RBE_DESKTOP_* sur Railway.' } };
    return { status: 200, payload: { updateAvailable: false } };
  }

  const best = candidates.reduce((winner, candidate) => {
    const difference = compareVersions(candidate.version, winner.version);
    return difference > 0 || (difference === 0 && candidate.source === 'urbex') ? candidate : winner;
  });
  return {
    status: 200,
    payload: {
      updateAvailable: compareVersions(best.version, currentVersion) > 0,
      version: best.version, installerUrl: best.installerUrl, sha256: best.sha256, releaseNotes: best.releaseNotes,
    },
  };
}

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
export const CONTENT_REVISION_PATTERN = /^\d{2}\.\d{2}\.\d{3}$/;

// Numéro de révision de contenu AA.MM.NNN : le compteur repart à 001 chaque mois.
export function nextContentRevision(lastRevision, now = new Date()) {
  const prefix = `${String(now.getFullYear()).slice(-2)}.${String(now.getMonth() + 1).padStart(2, '0')}`;
  const last = String(lastRevision || '');
  const counter = last.startsWith(`${prefix}.`) ? Number(last.slice(prefix.length + 1)) + 1 : 1;
  return `${prefix}.${String(counter).padStart(3, '0')}`;
}

// Point d'entrée unique du logiciel de l'UC : identification, état, profil écran et commandes du véhicule pilote.
export async function handleDesktopSync({ prisma, body = {}, now = new Date() }) {
  const serial = normalizeUcSerial(body.serial);
  if (!isValidUcSerial(serial)) return { status: 400, payload: { error: 'Numéro de série UC invalide ou non exploitable.' } };

  const hostname = String(body.hostname || '').trim().slice(0, 100) || null;
  const appVersion = /^\d+(?:\.\d+){1,3}$/.test(String(body.appVersion || '')) ? String(body.appVersion) : null;
  const networkOnline = body.online !== false;
  const screensRevision = /^[a-f0-9]{1,40}$/.test(String(body.screensRevision || '')) ? String(body.screensRevision) : null;
  const contentRevision = CONTENT_REVISION_PATTERN.test(String(body.contentRevision || '')) ? String(body.contentRevision) : null;
  const results = (Array.isArray(body.commandResults) ? body.commandResults : []).slice(0, 20)
    .filter((entry) => COMMAND_ID_PATTERN.test(String(entry?.id || '')) && ['DONE', 'FAILED'].includes(entry?.status));

  await prisma.ineoUcDevice.upsert({
    where: { serial },
    create: { serial, hostname, appVersion, networkOnline, screensRevision, contentRevision, firstSeenAt: now, lastSeenAt: now },
    update: { hostname, appVersion, networkOnline, screensRevision, contentRevision, lastSeenAt: now },
  });
  // Révision applicable à cet UC : publiée pour tous les véhicules, ou ciblant uniquement son véhicule.
  const latestContentFor = async (parc) => {
    const latest = await prisma.ineoContentRevision.findFirst({
      where: { OR: [{ targetParc: null }, ...(parc ? [{ targetParc: parc }] : [])] },
      orderBy: { createdAt: 'desc' },
      select: { revision: true },
    });
    return latest?.revision || null;
  };
  const publishedContentRevision = await latestContentFor(null);

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
      where: { pilotId: pilot.id, status: { in: ['PENDING', 'DELIVERED'] }, createdAt: { lt: new Date(now.getTime() - COMMAND_EXPIRY_MS) } },
      data: { status: 'FAILED', result: 'Expirée : le poste pilote n’a pas répondu.', completedAt: now },
    });
    const pending = await prisma.ineoPilotCommand.findMany({ where: { pilotId: pilot.id, status: 'PENDING' }, orderBy: { createdAt: 'asc' }, take: 10 });
    if (pending.length) {
      await prisma.ineoPilotCommand.updateMany({ where: { id: { in: pending.map((command) => command.id) } }, data: { status: 'DELIVERED', deliveredAt: now } });
    }
    return {
      status: 200,
      payload: {
        registered: true, serial, isPilot: true, pilotName: pilot.name, vehicle: null, profile: null, contentRevision: publishedContentRevision,
        screenProfile: serializeScreenProfile(pilot.screenProfile),
        commands: pending.map((command) => ({ id: command.id, type: command.type })),
      },
    };
  }

  const profile = await prisma.ineoVehicleProfile.findUnique({ where: { ucSerial: serial }, include: { vehicle: true, ...screenInclude } });
  if (!profile) return { status: 200, payload: { registered: false, serial, isPilot: false, contentRevision: publishedContentRevision } };
  const { vehicle } = profile;
  const vehicleContentRevision = await latestContentFor(profile.vehicleParc);
  return {
    status: 200,
    payload: {
      registered: true, serial, isPilot: false, contentRevision: vehicleContentRevision,
      vehicle: { parc: vehicle.parc, immat: vehicle.immat || null, marque: vehicle.marque || null, modele: vehicle.modele || null },
      profile: { vehicleType: profile.vehicleType, maxSpeedKmh: profile.maxSpeedKmh, lengthM: profile.lengthM, widthM: profile.widthM, heightM: profile.heightM, options: profile.options },
      screenProfile: serializeScreenProfile(profile.screenProfile),
      commands: [],
    },
  };
}
