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

const parseDateOrNull = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const RESTORED_PUBLIC_920_PROFILE = Object.freeze({
  description: "Ce véhicule est un exemple emblématique de la gamme Citaro de première génération. Mis en service commercial en juillet 2001, il représente l'évolution technologique des transports urbains du début des années 2000. Équipé d'une climatisation complète et accessible aux personnes à mobilité réduite.",
  history: "Le Mercedes-Benz Citaro est un autobus urbain produit par Daimler AG depuis 1997. Ce modèle a révolutionné les transports publics européens avec son design moderne et ses innovations techniques. Notre exemplaire FG-920-RE a été commandé par Cars Bridet à Wissous pour le réseau du Palladin et mis en service en juillet 2001. Au cours de sa carrière, il a porté successivement les numéros 592, 720, X, puis 920. Il a assuré la desserte Le Palladin jusqu'en août 2014. Après plusieurs années de service fidèle, il est passé brièvement par Brétigny en 2018, puis a rejoint Transdev STRAV à Limeil-Brévannes, avant d'être exploité par Cars Sœur. En mai 2025, ce véhicule historique a trouvé sa place au sein de la collection de l'association RétroBus Essonne, où il témoigne de l'évolution du transport public francilien au début du XXIe siècle.",
  caracteristiques: JSON.stringify([
    { label: 'Numéros de flotte', value: '592 / 720 / X / 920' },
    { label: 'Constructeur', value: 'Mercedes-Benz' },
    { label: 'Modèle', value: 'Citaro' },
    { label: 'Immatriculation', value: 'FG-920-RE' },
    { label: 'Mise en circulation', value: 'juillet 2001' },
    { label: 'Longueur', value: '11,95 m' },
    { label: 'Places assises', value: '32' },
    { label: 'Places debout', value: '64' },
    { label: 'UFR', value: '1' },
    { label: 'Statut', value: 'Préservé' },
    { label: 'Préservé par', value: 'Association RétroBus Essonne' },
    { label: 'Énergie', value: 'Diesel' },
    { label: 'Norme Euro', value: 'Euro II' },
    { label: 'Moteur', value: 'Mercedes-Benz OM906hLA - 279 ch' },
    { label: 'Boîte de vitesses', value: 'Automatique ZF5HP-502C' },
    { label: 'Nombre de portes', value: '2' },
    { label: 'Livrée', value: 'Grise' },
    { label: 'Girouette', value: 'Duhamel LED Oranges + Pastilles Vertes' },
    { label: 'Climatisation', value: 'Complète' }
  ])
});

const buildVehicleCaracteristiques = (project, report) => {
  const vehicle = project.tcInfos?.vehicle || {};
  return [
    ['Origine', 'Process PARC'],
    ['Projet PARC', project.name],
    ['Numéro de parc interne', project.internalFleetNumber],
    ['Constructeur', vehicle.manufacturer],
    ['Modèle', vehicle.model],
    ['Immatriculation', vehicle.registration],
    ['Mise en circulation', vehicle.firstRegistration],
    ['Numéro de série', vehicle.vin],
    ['Longueur', vehicle.length],
    ['Capacité', vehicle.capacity],
    ['Énergie', vehicle.energy],
    ['Norme Euro', vehicle.euroNorm],
    ['Moteur', vehicle.engine],
    ['Boîte de vitesses', vehicle.gearbox],
    ['Nombre de portes', vehicle.doors],
    ['Livrée', vehicle.livery],
    ['Girouette', vehicle.destinationSign],
    ['Climatisation', vehicle.airConditioning],
    ['Date rapatriement', report.appointmentDate],
    ['Heure rapatriement', report.appointmentTime],
    ['Huile', report.oil?.ok ? 'OK' : 'À vérifier'],
    ['LDR / fluides', report.coolant?.ok ? 'OK' : 'À vérifier'],
    ['Niveau gasoil', report.fuelLevel]
  ].filter(([, value]) => value !== undefined && value !== null && String(value).trim())
    .map(([label, value]) => ({ label, value: String(value) }));
};

const upsertInternalVehicleFromProcessParc = async (project, report) => {
  if (!report.moveToOverview || !project.internalFleetNumber) return null;

  const existingVehicle = await prisma.vehicle.findUnique({
    where: { parc: project.internalFleetNumber }
  });

  if (existingVehicle?.isPublic) {
    return existingVehicle;
  }

  const is920OverwrittenByProcessParc = existingVehicle?.parc === '920'
    && /^Véhicule intégré depuis le Process PARC\b/.test(existingVehicle.description || '');

  if (is920OverwrittenByProcessParc) {
    return prisma.vehicle.update({
      where: { parc: '920' },
      data: {
        ...RESTORED_PUBLIC_920_PROFILE,
        isPublic: true,
        updatedAt: new Date()
      }
    });
  }

  const vehicle = project.tcInfos?.vehicle || {};
  const caracteristiques = buildVehicleCaracteristiques(project, report);
  const fuel = Number(report.fuelLevel);
  const now = new Date();
  const vehicleData = {
    parc: project.internalFleetNumber,
    type: 'Véhicule',
    modele: vehicle.model || project.name || 'Véhicule Process PARC',
    marque: vehicle.manufacturer || null,
    subtitle: 'Issu du Process PARC',
    immat: vehicle.registration || null,
    etat: 'Préservé',
    miseEnCirculation: parseDateOrNull(vehicle.firstRegistration),
    energie: vehicle.energy || null,
    description: `Véhicule intégré depuis le Process PARC ${project.name}.`,
    history: report.anomalies ? `Anomalies signalées au rapatriement: ${report.anomalies}` : null,
    caracteristiques: JSON.stringify(caracteristiques),
    isPublic: false,
    fuel: Number.isFinite(fuel) ? fuel : null,
    updatedAt: now
  };

  return prisma.vehicle.upsert({
    where: { parc: project.internalFleetNumber },
    create: {
      ...vehicleData,
      gallery: null,
      backgroundImage: null,
      backgroundPosition: null,
      thumbnailImage: null,
      mileage: null,
      createdAt: now
    },
    update: vehicleData
  });
};

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

    await Promise.all(projects
      .filter((project) => project.status === 'overview' && project.internalFleetNumber)
      .map((project) => {
        const reports = jsonArray(project.repatriementReports);
        const latestReport = reports[0] || {};
        return upsertInternalVehicleFromProcessParc(project, { ...latestReport, moveToOverview: true });
      }));

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

    await upsertInternalVehicleFromProcessParc(updated, report);

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