/**
 * System Routes - Routes système et santé
 * GET /health
 * GET /api/health
 * GET /api/version
 * GET /api/status
 */

import express from 'express';

const router = express.Router();

// Health check endpoints
router.get('/health', (req, res) => {
  res.json({
    ok: true,
    time: new Date().toISOString(),
    version: 'rebuild-1',
    environment: process.env.NODE_ENV || 'development',
    uptime: Math.floor(process.uptime())
  });
});

router.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    time: new Date().toISOString(),
    version: 'rebuild-1',
    environment: process.env.NODE_ENV || 'development',
    uptime: Math.floor(process.uptime())
  });
});

// Version endpoint
router.get('/api/version', (req, res) => {
  res.json({
    version: 'rebuild-1',
    api: 'RetroClub API',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Status endpoint (required authentication)
router.get('/api/status', (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
}, (req, res) => {
  res.json({
    status: 'operational',
    timestamp: new Date().toISOString(),
    user: {
      id: req.user?.id,
      email: req.user?.email
    }
  });
});

export default router;
