import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();
let processParcTableReady = false;

const requireAuth = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Non authentifie' });
  next();
};

const decodeEntities = (value = '') => String(value)
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#039;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));

const cleanText = (html = '') => decodeEntities(String(html)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
  .replace(/<br\s*\/?>(\s*)/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim());

const extractRows = (html) => {
  const rows = [];
  const trMatches = String(html).match(/<tr[\s\S]*?<\/tr>/gi) || [];

  trMatches.forEach((rowHtml) => {
    const cells = [];
    const cellRegex = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
    let match;
    while ((match = cellRegex.exec(rowHtml))) {
      const text = cleanText(match[1]);
      if (text) cells.push(text);
    }
    if (cells.length >= 2) rows.push([cells[0], cells.slice(1).join(' ')]);
  });

  return rows;
};

const pickRows = (rows) => {
  const entries = {};
  rows.forEach(([key, value]) => {
    const normalizedKey = key.toLowerCase();
    if (!entries[normalizedKey]) entries[normalizedKey] = value;
  });
  const get = (...keys) => keys.map((key) => entries[key.toLowerCase()]).find(Boolean) || '';

  return {
    fleetNumber: get('Numéro', 'N°'),
    manufacturer: get('Constructeur'),
    model: get('Modèle', 'Modele'),
    registration: get('Immatriculation'),
    firstRegistration: get('Mise en circulation'),
    vin: get('Numéro de série', 'Numero de serie'),
    length: get('Longueur'),
    capacity: get('Nombre de places'),
    status: get('Statut'),
    energy: get('Énergie', 'Energie'),
    euroNorm: get('Norme Euro'),
    engine: get('Moteur'),
    gearbox: get('Boîte de vitesses', 'Boite de vitesses'),
    doors: get('Nombre de portes'),
    livery: get('Livrée', 'Livree'),
    destinationSign: get('Girouette'),
    airConditioning: get('Climatisation')
  };
};

const extractTitle = (html) => {
  const heading = String(html).match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
    || String(html).match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)
    || String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return heading ? cleanText(heading[1]).replace(/\s+-\s+TC Infos.*$/i, '') : '';
};

const validateTcInfosUrl = (rawUrl) => {
  const parsed = new URL(String(rawUrl || '').trim());
  const host = parsed.hostname.toLowerCase();

  if (!['tc-infos.fr', 'www.tc-infos.fr'].includes(host)) {
    throw new Error('Le lien doit pointer vers tc-infos.fr');
  }

  if (!/^\/vehicule\/\d+\/?$/.test(parsed.pathname)) {
    throw new Error('Le lien doit cibler une fiche véhicule TC Infos');
  }

  parsed.hash = '';
  return parsed;
};

const jsonArray = (value) => Array.isArray(value) ? value : [];

const serializeProject = (project) => ({
  ...project,
  documents: jsonArray(project.documents),
  mailCaptures: jsonArray(project.mailCaptures),
  reminders: jsonArray(project.reminders),
  repatriementReports: jsonArray(project.repatriementReports),
  createdAt: project.createdAt?.toISOString?.() || project.createdAt,
  updatedAt: project.updatedAt?.toISOString?.() || project.updatedAt,
  movedToOverviewAt: project.movedToOverviewAt?.toISOString?.() || project.movedToOverviewAt || null
});

const projectPayload = (body = {}, req) => ({
  id: body.id || `parc-${Date.now()}`,
  name: String(body.name || '').trim(),
  internalFleetNumber: String(body.internalFleetNumber || '').trim(),
  source: String(body.source || 'manual'),
  status: String(body.status || 'pre_project'),
  tcInfos: body.tcInfos || null,
  documents: jsonArray(body.documents),
  mailCaptures: jsonArray(body.mailCaptures),
  reminders: jsonArray(body.reminders),
  repatriementReports: jsonArray(body.repatriementReports),
  movedToOverviewAt: body.movedToOverviewAt ? new Date(body.movedToOverviewAt) : null,
  createdBy: req.user?.email || req.user?.id || null
});

const ensureProcessParcTable = async () => {
  if (processParcTableReady) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ProcessParcProject" (
      "id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "internalFleetNumber" TEXT NOT NULL,
      "source" TEXT NOT NULL DEFAULT 'manual',
      "status" TEXT NOT NULL DEFAULT 'pre_project',
      "tcInfos" JSONB,
      "documents" JSONB NOT NULL DEFAULT '[]',
      "mailCaptures" JSONB NOT NULL DEFAULT '[]',
      "reminders" JSONB NOT NULL DEFAULT '[]',
      "repatriementReports" JSONB NOT NULL DEFAULT '[]',
      "movedToOverviewAt" TIMESTAMP(3),
      "createdBy" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "ProcessParcProject_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "ProcessParcProject_status_idx" ON "ProcessParcProject"("status")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "ProcessParcProject_internalFleetNumber_idx" ON "ProcessParcProject"("internalFleetNumber")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "ProcessParcProject_createdAt_idx" ON "ProcessParcProject"("createdAt")');
  processParcTableReady = true;
};

router.get('/projects', requireAuth, async (_req, res) => {
  try {
    await ensureProcessParcTable();
    const projects = await prisma.processParcProject.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return res.json(projects.map(serializeProject));
  } catch (error) {
    console.error('Erreur liste Process PARC:', error);
    return res.status(500).json({ error: 'Impossible de charger les projets Process PARC' });
  }
});

router.post('/projects', requireAuth, async (req, res) => {
  try {
    await ensureProcessParcTable();
    const data = projectPayload(req.body, req);
    if (!data.name || !data.internalFleetNumber) {
      return res.status(400).json({ error: 'Nom du projet et numero de parc requis' });
    }

    const project = await prisma.processParcProject.create({ data });
    return res.status(201).json(serializeProject(project));
  } catch (error) {
    console.error('Erreur creation Process PARC:', error);
    return res.status(500).json({ error: 'Impossible de creer le projet Process PARC' });
  }
});

router.put('/projects/:id', requireAuth, async (req, res) => {
  try {
    await ensureProcessParcTable();
    const data = projectPayload({ ...req.body, id: req.params.id }, req);
    if (!data.name || !data.internalFleetNumber) {
      return res.status(400).json({ error: 'Nom du projet et numero de parc requis' });
    }

    const project = await prisma.processParcProject.upsert({
      where: { id: req.params.id },
      create: data,
      update: {
        name: data.name,
        internalFleetNumber: data.internalFleetNumber,
        source: data.source,
        status: data.status,
        tcInfos: data.tcInfos,
        documents: data.documents,
        mailCaptures: data.mailCaptures,
        reminders: data.reminders,
        repatriementReports: data.repatriementReports,
        movedToOverviewAt: data.movedToOverviewAt
      }
    });

    return res.json(serializeProject(project));
  } catch (error) {
    console.error('Erreur mise a jour Process PARC:', error);
    return res.status(500).json({ error: 'Impossible de mettre a jour le projet Process PARC' });
  }
});

router.post('/projects/:id/repatriement-reports', requireAuth, async (req, res) => {
  try {
    await ensureProcessParcTable();
    const project = await prisma.processParcProject.findUnique({ where: { id: req.params.id } });
    if (!project) return res.status(404).json({ error: 'Projet Process PARC introuvable' });

    const report = {
      ...req.body,
      id: req.body?.id || `rapatriement-${Date.now()}`,
      projectId: req.params.id,
      submittedAt: req.body?.submittedAt || new Date().toISOString()
    };
    const reports = jsonArray(project.repatriementReports);
    const nextReports = reports.some((item) => item.id === report.id) ? reports : [report, ...reports];

    const updated = await prisma.processParcProject.update({
      where: { id: req.params.id },
      data: {
        repatriementReports: nextReports,
        status: report.moveToOverview ? 'overview' : project.status,
        movedToOverviewAt: report.moveToOverview ? new Date(report.closedAt || report.submittedAt) : project.movedToOverviewAt
      }
    });

    return res.json(serializeProject(updated));
  } catch (error) {
    console.error('Erreur relevé Process PARC:', error);
    return res.status(500).json({ error: 'Impossible de sauvegarder le releve de rapatriement' });
  }
});

router.post('/tc-infos/identify', requireAuth, async (req, res) => {
  try {
    const target = validateTcInfosUrl(req.body?.url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(target.toString(), {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'RetroBus-Process-PARC/1.0',
        'Accept': 'text/html,application/xhtml+xml'
      }
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(502).json({ ok: false, error: `TC Infos a repondu ${response.status}` });
    }

    const html = await response.text();
    const rows = extractRows(html);
    const vehicle = pickRows(rows);
    const title = extractTitle(html) || [vehicle.manufacturer, vehicle.model, vehicle.fleetNumber ? `n°${vehicle.fleetNumber}` : ''].filter(Boolean).join(' ');

    return res.json({
      ok: true,
      source: 'tc-infos',
      sourceUrl: target.toString(),
      tcInfosId: target.pathname.split('/').filter(Boolean).pop(),
      title,
      vehicle,
      detectedFields: Object.entries(vehicle).filter(([, value]) => Boolean(value)).length
    });
  } catch (error) {
    return res.status(400).json({ ok: false, error: error.message || 'Lien TC Infos invalide' });
  }
});

export default router;