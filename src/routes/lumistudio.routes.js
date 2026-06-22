import { Router } from 'express';
import crypto from 'crypto';

const router = Router();

const resolveBaseUrl = () => String(process.env.LUMISTUDIO_PUBLIC_URL || 'https://www.retrobus-interne.fr/myrbe/lumistudio').trim();
const resolveHealthUrl = () => String(process.env.LUMISTUDIO_HEALTH_URL || '').trim();
const shouldAppendUser = () => String(process.env.LUMISTUDIO_APPEND_USER || 'false').toLowerCase() === 'true';
const sharedSecret = () => String(process.env.LUMISTUDIO_SHARED_SECRET || '');

const requireAuth = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Non authentifie' });
  next();
};

const getUserData = (req) => {
  const id = String(req.user?.id || req.user?.userId || req.user?.sub || req.user?.email || 'unknown');
  const email = String(req.user?.email || '');
  const role = String(req.user?.role || (Array.isArray(req.user?.roles) ? req.user.roles[0] : '') || 'MEMBER');
  return { id, email, role };
};

const buildSignedPayload = ({ id, email, role, ts, nonce }) => `${id}.${email}.${role}.${ts}.${nonce}`;

const buildLaunchUrl = (req) => {
  const base = resolveBaseUrl();
  const url = new URL(base);

  if (!shouldAppendUser()) {
    return url.toString();
  }

  const { id, email, role } = getUserData(req);
  const ts = Date.now().toString();
  const nonce = crypto.randomUUID();
  const payload = buildSignedPayload({ id, email, role, ts, nonce });

  url.searchParams.set('uid', id);
  if (email) url.searchParams.set('email', email);
  url.searchParams.set('role', role);
  url.searchParams.set('ts', ts);
  url.searchParams.set('nonce', nonce);

  const secret = sharedSecret();
  if (secret) {
    const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    url.searchParams.set('sig', sig);
  }

  return url.toString();
};

router.get('/config', requireAuth, (req, res) => {
  res.json({
    ok: true,
    baseUrl: resolveBaseUrl(),
    appendUser: shouldAppendUser(),
    healthUrlConfigured: !!resolveHealthUrl()
  });
});

router.get('/launch', requireAuth, (req, res) => {
  try {
    const launchUrl = buildLaunchUrl(req);
    return res.json({ ok: true, launchUrl });
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Impossible de generer l\'URL Lumistudio', details: error.message });
  }
});

router.get('/health', requireAuth, async (req, res) => {
  const base = resolveBaseUrl();
  const target = resolveHealthUrl() || base;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(target, { method: 'GET', signal: controller.signal });
    clearTimeout(timeout);

    return res.json({
      ok: true,
      target,
      reachable: response.ok,
      status: response.status
    });
  } catch (error) {
    return res.json({
      ok: true,
      target,
      reachable: false,
      error: error.message
    });
  }
});

export default router;
