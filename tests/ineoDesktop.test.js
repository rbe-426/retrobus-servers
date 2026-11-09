import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {
  buildUpdateManifest, compareVersions, detectImageMime, handleDesktopSync, isValidImei, isValidUcSerial, newMediaId, nextContentRevision, normalizeImei, normalizeProduct, serializeScreenProfile, validateContentConfig, validateDesktopReleaseInput, validateScreenProfileInput,
} from '../src/lib/ineoDesktop.js';

test('IMEI de console : 15 chiffres avec clé de Luhn', () => {
  assert.equal(isValidImei(normalizeImei('49-015420 323751 8')), true);
  for (const bad of ['490154203237519', '12345', '49015420323751A', '']) assert.equal(isValidImei(bad), false);
});

test('content config keeps the startup announcement and lists the files it needs', () => {
  const sound = `${newMediaId()}.mp3`;
  const image = `${newMediaId()}.png`;
  const { value, error } = validateContentConfig({
    announcements: [{ id: 'a1', name: 'Bienvenue', trigger: 'START', soundFile: sound, enabled: true, evil: 'x' }, { name: 'Autre', trigger: '??', soundFile: '../secret.mp3' }],
    screens: [{ id: 's1', name: 'Avant', place: 'FRONT_DESTINATION', x: 500, widthPx: 1920, heightPx: 480, onlineImage: image }],
  });
  assert.equal(error, undefined);
  assert.equal(value.announcements[0].trigger, 'START');
  assert.equal('evil' in value.announcements[0], false);
  assert.equal(value.announcements[1].trigger, 'PRE');
  assert.equal(value.announcements[1].soundFile, null);
  assert.equal(value.screens[0].x, 100);
  assert.deepEqual(value.files.sort(), [sound, image].sort());
});

test('content config is optional and rejects non-objects', () => {
  assert.equal(validateContentConfig(undefined).value, null);
  assert.ok(validateContentConfig([]).error);
});

const mediaA = newMediaId();
const mediaB = newMediaId();

function createFakePrisma({ pilot = null, vehicleProfile = null, commands = [] } = {}) {
  const state = { devices: new Map(), commands: commands.map((command) => ({ ...command })) };
  const matches = (command, where) => Object.entries(where).every(([key, expected]) => {
    if (expected && typeof expected === 'object' && 'in' in expected) return expected.in.includes(command[key]);
    if (expected && typeof expected === 'object' && 'lt' in expected) return command[key] < expected.lt;
    return command[key] === expected;
  });
  return {
    state,
    ineoUcDevice: { upsert: async ({ where, create, update }) => { state.devices.set(where.serial, { ...(state.devices.get(where.serial) || create), ...update }); } },
    ineoContentRevision: { findFirst: async () => (state.contentRevision ? { revision: state.contentRevision } : null) },
    ineoPilotVehicle: { findUnique: async ({ where }) => (pilot && pilot.ucSerial === where.ucSerial ? pilot : null) },
    ineoVehicleProfile: { findUnique: async ({ where }) => (vehicleProfile && vehicleProfile.ucSerial === where.ucSerial ? vehicleProfile : null) },
    ineoPilotCommand: {
      updateMany: async ({ where, data }) => { state.commands.filter((command) => matches(command, where)).forEach((command) => Object.assign(command, data)); },
      findMany: async ({ where }) => state.commands.filter((command) => matches(command, where)),
    },
  };
}

const screenProfile = {
  id: 'profile1', name: '920 complet', description: null,
  screens: [
    { id: 's2', name: 'Intérieur', place: 'INSIDE_FRONT', x: 70, y: 40, widthPct: 16, widthPx: 1280, heightPx: 720, offlineMediaId: mediaA, onlineMediaId: mediaB, sortOrder: 1 },
    { id: 's1', name: 'Girouette', place: 'FRONT_DESTINATION', x: 78, y: 4, widthPct: 18, widthPx: 1920, heightPx: 300, offlineMediaId: null, onlineMediaId: null, sortOrder: 0 },
  ],
};

test('serial validation rejects generic manufacturer values', () => {
  assert.equal(isValidUcSerial('NHQPEEF0084081065F7600'), true);
  for (const bad of ['TOBEFILLEDBYO.E.M.', 'DEFAULTSTRING', '00000000', 'AB', '<script>']) assert.equal(isValidUcSerial(bad), false);
});

test('screen profile validation clamps geometry and rejects invalid media', () => {
  const { value } = validateScreenProfileInput({ name: ' Test ', screens: [{ name: 'A', x: 500, y: -4, widthPct: 90, widthPx: 1920, heightPx: 1080 }] });
  assert.equal(value.name, 'Test');
  assert.equal(value.screens[0].widthPct, 60);
  assert.equal(value.screens[0].x, 40);
  assert.equal(value.screens[0].y, 0);
  assert.ok(validateScreenProfileInput({ name: '', screens: [] }).error);
  assert.ok(validateScreenProfileInput({ name: 'X', screens: [{ name: 'A', widthPx: 10, heightPx: 10 }] }).error);
  assert.ok(validateScreenProfileInput({ name: 'X', screens: [{ name: 'A', widthPx: 800, heightPx: 600, onlineMediaId: '../etc' }] }).error);
});

test('revision is stable, ordered by sortOrder and changes with content', () => {
  const first = serializeScreenProfile(screenProfile);
  assert.deepEqual(first.screens.map((screen) => screen.id), ['s1', 's2']);
  assert.equal(serializeScreenProfile({ ...screenProfile }).revision, first.revision);
  const changed = serializeScreenProfile({ ...screenProfile, screens: [{ ...screenProfile.screens[0], x: 11 }, screenProfile.screens[1]] });
  assert.notEqual(changed.revision, first.revision);
});

test('image detection uses magic bytes', () => {
  assert.equal(detectImageMime(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(8)])), 'image/png');
  assert.equal(detectImageMime(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), null);
});

test('desktop release validation accepts a Windows executable and computes its hash', () => {
  const exe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(2048, 1)]);
  const { value } = validateDesktopReleaseInput({ version: ' 26.11.001 ', notes: ' Correctifs ', dataBase64: exe.toString('base64') });
  assert.equal(value.version, '26.11.001');
  assert.equal(value.fileName, 'Ineo-Retrobus-Setup-26.11.001.exe');
  assert.equal(value.notes, 'Correctifs');
  assert.equal(value.size, exe.length);
  assert.equal(value.sha256, crypto.createHash('sha256').update(exe).digest('hex'));
});

test('desktop release validation handles the maintenance product', () => {
  const exe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(2048, 1)]).toString('base64');
  const { value } = validateDesktopReleaseInput({ product: 'maintenance', version: '26.11.001', dataBase64: exe });
  assert.equal(value.product, 'MAINTENANCE');
  assert.equal(value.fileName, 'Ineo-Maintenance-Setup-26.11.001.exe');
  assert.equal(normalizeProduct(undefined), 'UC');
  assert.equal(normalizeProduct('autre'), null);
  assert.ok(validateDesktopReleaseInput({ product: 'autre', version: '26.11.001', dataBase64: exe }).error);
});

test('desktop release validation rejects bad versions and non-executables', () => {
  const exe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(2048, 1)]).toString('base64');
  for (const version of ['', '1.0', 'v26.11.001', '26.11.1', '26.13.001', '26.00.001', '1.0.3', '26.11.001.0', '../26.11.001']) assert.ok(validateDesktopReleaseInput({ version, dataBase64: exe }).error, version);
  assert.ok(validateDesktopReleaseInput({ version: '26.11.001', dataBase64: Buffer.from('#!/bin/sh\n'.repeat(200)).toString('base64') }).error);
  assert.ok(validateDesktopReleaseInput({ version: '26.11.001', dataBase64: '' }).error);
  assert.ok(validateDesktopReleaseInput({ version: '26.11.001', dataBase64: 'not base64 !!' }).error);
});

test('version comparison orders releases numerically', () => {
  assert.ok(compareVersions('1.0.10', '1.0.9') > 0);
  assert.ok(compareVersions('1.1.0', '1.0.99') > 0);
  assert.equal(compareVersions('2.0.0', '2.0.0'), 0);
  assert.ok(compareVersions('26.11.002', '26.11.001') > 0);
  assert.ok(compareVersions('26.11.001', '1.0.3') > 0);
  assert.equal(compareVersions('26.11.001', '26.11.1'), 0);
});

test('update manifest: nothing published means no update and no error', () => {
  const { status, payload } = buildUpdateManifest({ env: {}, release: null, currentVersion: '1.0.0', baseUrl: 'https://api.example' });
  assert.equal(status, 200);
  assert.deepEqual(payload, { updateAvailable: false });
});

test('update manifest: rejects an invalid installed version and flags half-configured variables', () => {
  assert.equal(buildUpdateManifest({ env: {}, release: null, currentVersion: 'abc', baseUrl: 'https://api.example' }).status, 400);
  const partial = buildUpdateManifest({ env: { version: '1.0.1' }, release: null, currentVersion: '1.0.0', baseUrl: 'https://api.example' });
  assert.equal(partial.status, 503);
});

test('update manifest: an uploaded installer is served by the API itself', () => {
  const release = { id: 'ckabcdefghij0123456789', version: '1.1.0', sha256: 'a'.repeat(64), notes: 'Compatible XP' };
  const { payload } = buildUpdateManifest({ env: {}, release, currentVersion: '1.0.2', baseUrl: 'https://api.example' });
  assert.equal(payload.updateAvailable, true);
  assert.equal(payload.installerUrl, 'https://api.example/api/ineo-rbe-desktop/installer/ckabcdefghij0123456789');
  assert.equal(payload.sha256, 'a'.repeat(64));
  assert.equal(payload.releaseNotes, 'Compatible XP');
  assert.equal(buildUpdateManifest({ env: {}, release, currentVersion: '1.1.0', baseUrl: 'https://api.example' }).payload.updateAvailable, false);
});

test('update manifest: the newest source wins and a tie prefers the API-hosted installer', () => {
  const env = { version: '1.0.1', installerUrl: 'https://github.com/x/y/Setup.exe', sha256: 'b'.repeat(64), releaseNotes: 'GitHub' };
  const release = (version) => ({ id: 'ckabcdefghij0123456789', version, sha256: 'a'.repeat(64), notes: null });
  assert.equal(buildUpdateManifest({ env, release: release('1.0.0'), currentVersion: '0.9.0', baseUrl: 'https://api.example' }).payload.installerUrl, env.installerUrl);
  assert.match(buildUpdateManifest({ env, release: release('1.0.2'), currentVersion: '1.0.0', baseUrl: 'https://api.example' }).payload.installerUrl, /\/installer\//);
  assert.match(buildUpdateManifest({ env, release: release('1.0.1'), currentVersion: '1.0.0', baseUrl: 'https://api.example' }).payload.installerUrl, /\/installer\//);
  assert.equal(buildUpdateManifest({ env, release: null, currentVersion: '1.0.0', baseUrl: 'https://api.example' }).payload.installerUrl, env.installerUrl);
});

test('update manifest: an http installer URL in the variables is never offered', () => {
  const env = { version: '1.0.1', installerUrl: 'http://insecure.example/Setup.exe', sha256: 'b'.repeat(64) };
  assert.equal(buildUpdateManifest({ env, release: null, currentVersion: '1.0.0', baseUrl: 'https://api.example' }).status, 503);
});

test('sync rejects an unusable serial', async () => {
  const result = await handleDesktopSync({ prisma: createFakePrisma(), body: { serial: 'DEFAULTSTRING' } });
  assert.equal(result.status, 400);
});

test('sync reports an unregistered UC and records it', async () => {
  const prisma = createFakePrisma();
  const result = await handleDesktopSync({ prisma, body: { serial: 'abc 12345', hostname: 'PC-BUS', appVersion: '1.0.1', online: false } });
  assert.deepEqual(result.payload, { registered: false, serial: 'ABC12345', isPilot: false, contentRevision: null });
  assert.equal(prisma.state.devices.get('ABC12345').networkOnline, false);
});

test('sync exposes the published content revision and records the one applied by the UC', async () => {
  const prisma = createFakePrisma();
  prisma.state.contentRevision = '26.11.002';
  const { payload } = await handleDesktopSync({ prisma, body: { serial: 'abc 12345', contentRevision: '26.11.001' } });
  assert.equal(payload.contentRevision, '26.11.002');
  assert.equal(prisma.state.devices.get('ABC12345').contentRevision, '26.11.001');
});

test('content revisions are numbered AA.MM.NNN and restart each month', () => {
  assert.equal(nextContentRevision(null, new Date('2026-11-08T10:00:00')), '26.11.001');
  assert.equal(nextContentRevision('26.11.009', new Date('2026-11-20T10:00:00')), '26.11.010');
  assert.equal(nextContentRevision('26.11.010', new Date('2026-12-01T10:00:00')), '26.12.001');
});

test('sync returns the vehicle profile and its screen profile', async () => {
  const prisma = createFakePrisma({ vehicleProfile: { ucSerial: 'SN920', vehicleType: 'BUS STANDARD', maxSpeedKmh: 90, vehicle: { parc: '920', immat: 'AB-920-CD', marque: 'Mercedes', modele: 'Citaro' }, screenProfile } });
  const { payload } = await handleDesktopSync({ prisma, body: { serial: 'SN920' } });
  assert.equal(payload.registered, true);
  assert.equal(payload.isPilot, false);
  assert.equal(payload.vehicle.parc, '920');
  assert.equal(payload.screenProfile.screens.length, 2);
  assert.deepEqual(payload.commands, []);
});

test('pilot receives pending commands once, can report results, and stale commands expire', async () => {
  const now = new Date('2026-11-02T12:00:00Z');
  const prisma = createFakePrisma({
    pilot: { id: 'pilot1', name: 'Véhicule pilote', ucSerial: 'PILOT0001', screenProfile },
    commands: [
      { id: 'cmdFresh0001', pilotId: 'pilot1', type: 'RELOAD', status: 'PENDING', createdAt: new Date(now.getTime() - 5_000) },
      { id: 'cmdStale0001', pilotId: 'pilot1', type: 'TEST_SOUND', status: 'PENDING', createdAt: new Date(now.getTime() - 3_600_000) },
      { id: 'cmdOther0001', pilotId: 'otherPilot', type: 'RELOAD', status: 'PENDING', createdAt: now },
    ],
  });
  const first = await handleDesktopSync({ prisma, now, body: { serial: 'PILOT0001', screensRevision: 'abc123' } });
  assert.equal(first.payload.isPilot, true);
  assert.deepEqual(first.payload.commands, [{ id: 'cmdFresh0001', type: 'RELOAD' }]);
  assert.equal(prisma.state.commands.find((command) => command.id === 'cmdStale0001').status, 'FAILED');
  assert.equal(prisma.state.devices.get('PILOT0001').screensRevision, 'abc123');

  const second = await handleDesktopSync({ prisma, now, body: { serial: 'PILOT0001' } });
  assert.deepEqual(second.payload.commands, []);

  await handleDesktopSync({
    prisma, now,
    body: { serial: 'PILOT0001', commandResults: [{ id: 'cmdFresh0001', status: 'DONE', result: 'ok' }, { id: 'cmdOther0001', status: 'DONE', result: 'piraté' }] },
  });
  assert.equal(prisma.state.commands.find((command) => command.id === 'cmdFresh0001').status, 'DONE');
  assert.equal(prisma.state.commands.find((command) => command.id === 'cmdOther0001').status, 'PENDING');
});
