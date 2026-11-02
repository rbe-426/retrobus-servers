import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { isGeneralLimiterExempt } from '../src/lib/rateLimitPolicy.js';

const request = (method, path, headers = {}) => ({ method, path, headers });

test('desktop routes never consume the global quota', () => {
  for (const path of ['/api/ineo-rbe-desktop/sync', '/api/ineo-rbe-desktop/identify', '/api/ineo-rbe-desktop/update', '/api/ineo-rbe-desktop/media/abc']) {
    assert.equal(isGeneralLimiterExempt(request('POST', path)), true, path);
  }
});

test('pilot polling is exempt only for authenticated GET requests', () => {
  assert.equal(isGeneralLimiterExempt(request('GET', '/api/ineo/pilot', { authorization: 'Bearer x' })), true);
  assert.equal(isGeneralLimiterExempt(request('GET', '/api/ineo/pilot')), false);
  assert.equal(isGeneralLimiterExempt(request('PUT', '/api/ineo/pilot', { authorization: 'Bearer x' })), false);
});

test('every other API route keeps the global quota', () => {
  for (const path of ['/api/ineo/missions', '/api/members', '/api/ineo/vehicle-profiles', '/api/ineo-rbe-desktopX/sync']) {
    assert.equal(isGeneralLimiterExempt(request('GET', path, { authorization: 'Bearer x' })), false, path);
  }
});

test('a 429 from the limiter carries the CORS headers when CORS runs first', async () => {
  const app = express();
  app.use((req, res, next) => { res.header('Access-Control-Allow-Origin', 'https://retrobus-interne.fr'); next(); });
  app.use(rateLimit({ windowMs: 60_000, max: 1, skip: isGeneralLimiterExempt, standardHeaders: true, legacyHeaders: false }));
  app.get('/api/ineo/missions', (_req, res) => res.json({ ok: true }));
  app.get('/api/ineo-rbe-desktop/update', (_req, res) => res.json({ ok: true }));
  const server = app.listen(0);
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(`${base}/api/ineo/missions`)).status, 200);
    const limited = await fetch(`${base}/api/ineo/missions`);
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get('access-control-allow-origin'), 'https://retrobus-interne.fr');
    for (let attempt = 0; attempt < 5; attempt += 1) assert.equal((await fetch(`${base}/api/ineo-rbe-desktop/update`)).status, 200);
  } finally {
    server.close();
  }
});
