import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const router = Router();
const PRESIDENT_EMAIL = 'belaidiw91@gmail.com';
const PRESIDENT_MATRICULE = 'w.belaidi';
const DAY_MS = 24 * 60 * 60 * 1000;
const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'retrostudio');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, UPLOAD_DIR),
    filename: (_req, file, callback) => callback(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`)
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const allowedTypes = new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png'
    ]);
    callback(allowedTypes.has(file.mimetype) ? null : new Error('Type de fichier non autorise.'), allowedTypes.has(file.mimetype));
  }
});

const requireAuth = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Non authentifie' });
  next();
};

const isPresident = (req) => {
  const email = String(req.user?.email || '').trim().toLowerCase();
  const matricule = String(req.user?.matricule || req.user?.username || '').trim().toLowerCase();
  return email === PRESIDENT_EMAIL || matricule === PRESIDENT_MATRICULE;
};

const parseDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
};

const prepareRequestData = (body, saveAsDraft) => {
  const contactDate = parseDate(body?.contactDate);
  const shootDate = parseDate(body?.shootDate);
  const contactName = String(body?.contactName || '').trim() || null;
  const contactRole = String(body?.contactRole || '').trim() || null;
  const productionCompany = String(body?.productionCompany || '').trim() || null;
  const audiovisualProject = String(body?.audiovisualProject || '').trim() || null;
  const workTitle = String(body?.workTitle || '').trim() || null;
  const approximateShootDate = String(body?.approximateShootDate || '').trim() || null;
  const approximateShootLocation = String(body?.approximateShootLocation || '').trim() || null;
  const circuit = String(body?.circuit || '').trim() || null;
  const synopsisFileName = String(body?.synopsisFileName || '').trim() || null;
  const synopsisFileUrl = String(body?.synopsisFileUrl || '').trim() || null;
  const circuitFileName = String(body?.circuitFileName || '').trim() || null;
  const circuitFileUrl = String(body?.circuitFileUrl || '').trim() || null;
  const hasInvalidDate = (body?.contactDate && !contactDate) || (body?.shootDate && !shootDate);
  const hasAnyInformation = contactDate || shootDate || contactName || contactRole || productionCompany || audiovisualProject;
  const isComplete = contactDate && shootDate && contactName && contactRole && productionCompany && audiovisualProject;

  if (hasInvalidDate) return { error: 'Les dates saisies doivent etre valides.' };
  if (!hasAnyInformation) return { error: 'Ajoutez au moins une information avant d enregistrer le brouillon.' };
  if (!saveAsDraft && !isComplete) return { error: 'Les informations de prise de contact et de tournage sont obligatoires.' };

  const leadTimeDays = contactDate && shootDate
    ? Math.round((shootDate.getTime() - contactDate.getTime()) / DAY_MS)
    : null;
  const validationRequired = !saveAsDraft && leadTimeDays !== null && leadTimeDays <= 15;

  return {
    data: {
      contactDate,
      contactName,
      contactRole,
      productionCompany,
      audiovisualProject,
      shootDate,
      workTitle,
      approximateShootDate,
      approximateShootLocation,
      circuit,
      synopsisFileName,
      synopsisFileUrl,
      circuitFileName,
      circuitFileUrl,
      leadTimeDays,
      validationRequired,
      status: saveAsDraft ? 'DRAFT' : validationRequired ? 'PENDING_VALIDATION' : 'RECORDED'
    },
    validationRequired
  };
};

const createValidationNotification = async (prisma, request, shootDate, createdBy) => {
  if (!request.validationRequired) return;
  await prisma.notification.create({
    data: {
      title: `RetroStudio : validation requise (${request.leadTimeDays} jours)`,
      message: `${request.productionCompany} - ${request.audiovisualProject}. Tournage prévu le ${shootDate}. Validation présidentielle requise.`,
      type: 'warning',
      priority: 'high',
      targetedTo: `user:${PRESIDENT_EMAIL}`,
      createdBy: createdBy || 'SYSTEM'
    }
  });
};

router.post('/requests', requireAuth, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const preparedRequest = prepareRequestData(req.body, Boolean(req.body?.saveAsDraft));
    if (preparedRequest.error) return res.status(400).json({ error: preparedRequest.error });
    const request = await prisma.retroStudioRequest.create({
      data: {
        ...preparedRequest.data,
        createdBy: req.user.email || req.user.id || null
      }
    });

    await createValidationNotification(prisma, request, req.body?.shootDate, req.user.email || req.user.id);

    return res.status(201).json(request);
  } catch (error) {
    console.error('RetroStudio request creation failed:', error.message);
    return res.status(500).json({ error: 'Impossible d enregistrer le dossier RetroStudio.' });
  }
});

router.put('/requests/:id', requireAuth, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const existingRequest = await prisma.retroStudioRequest.findUnique({ where: { id: req.params.id } });
    if (!existingRequest) return res.status(404).json({ error: 'Brouillon RetroStudio introuvable.' });
    if (existingRequest.status === 'REJECTED') return res.status(409).json({ error: 'Un dossier refuse ne peut plus etre modifie.' });

    const preparedRequest = prepareRequestData(req.body, Boolean(req.body?.saveAsDraft));
    if (preparedRequest.error) return res.status(400).json({ error: preparedRequest.error });
    if (existingRequest.status !== 'DRAFT') {
      preparedRequest.data.status = existingRequest.status;
      preparedRequest.data.validationRequired = existingRequest.validationRequired;
    }
    const request = await prisma.retroStudioRequest.update({
      where: { id: req.params.id },
      data: preparedRequest.data
    });

    if (existingRequest.status === 'DRAFT' && request.status === 'PENDING_VALIDATION') {
      await createValidationNotification(prisma, request, req.body?.shootDate, req.user.email || req.user.id);
    }
    return res.json(request);
  } catch (error) {
    console.error('RetroStudio draft update failed:', error.message);
    return res.status(500).json({ error: 'Impossible de mettre a jour le brouillon RetroStudio.' });
  }
});

router.post('/requests/:id/attachments/:kind', requireAuth, upload.single('file'), async (req, res) => {
  const attachmentKind = req.params.kind;
  if (!['synopsis', 'circuit'].includes(attachmentKind)) {
    return res.status(400).json({ error: 'Type de piece jointe inconnu.' });
  }
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier recu.' });

  try {
    const existingRequest = await req.app.locals.prisma.retroStudioRequest.findUnique({ where: { id: req.params.id } });
    if (!existingRequest) return res.status(404).json({ error: 'Brouillon RetroStudio introuvable.' });
    if (existingRequest.status === 'REJECTED') return res.status(409).json({ error: 'Un dossier refuse ne peut plus recevoir de piece jointe.' });

    const fileUrl = `/uploads/retrostudio/${req.file.filename}`;
    const data = attachmentKind === 'synopsis'
      ? { synopsisFileName: req.file.originalname, synopsisFileUrl: fileUrl }
      : { circuitFileName: req.file.originalname, circuitFileUrl: fileUrl };
    const request = await req.app.locals.prisma.retroStudioRequest.update({ where: { id: req.params.id }, data });
    return res.json(request);
  } catch (error) {
    fs.unlink(req.file.path, () => {});
    console.error('RetroStudio attachment upload failed:', error.message);
    return res.status(500).json({ error: 'Impossible d enregistrer la piece jointe RetroStudio.' });
  }
});

router.get('/requests', requireAuth, async (req, res) => {
  try {
    const requests = await req.app.locals.prisma.retroStudioRequest.findMany({
      where: { status: { in: ['DRAFT', 'RECORDED', 'PENDING_VALIDATION', 'APPROVED'] } },
      orderBy: [{ shootDate: 'asc' }, { createdAt: 'desc' }]
    });
    return res.json(requests);
  } catch (error) {
    console.error('RetroStudio ongoing requests failed:', error.message);
    return res.status(500).json({ error: 'Impossible de charger les demandes RetroStudio en cours.' });
  }
});

router.get('/requests/pending-validation', requireAuth, async (req, res) => {
  if (!isPresident(req)) return res.status(403).json({ error: 'Validation reservee au president.' });

  try {
    const requests = await req.app.locals.prisma.retroStudioRequest.findMany({
      where: { status: 'PENDING_VALIDATION' },
      orderBy: [{ shootDate: 'asc' }, { createdAt: 'asc' }]
    });
    return res.json(requests);
  } catch (error) {
    console.error('RetroStudio pending requests failed:', error.message);
    return res.status(500).json({ error: 'Impossible de charger les validations RetroStudio.' });
  }
});

router.put('/requests/:id/validation', requireAuth, async (req, res) => {
  if (!isPresident(req)) return res.status(403).json({ error: 'Validation reservee au president.' });

  const decision = String(req.body?.decision || '').toUpperCase();
  const validationComment = String(req.body?.comment || '').trim() || null;
  if (!['APPROVED', 'REJECTED'].includes(decision)) {
    return res.status(400).json({ error: 'La decision doit etre APPROVED ou REJECTED.' });
  }

  try {
    const result = await req.app.locals.prisma.retroStudioRequest.updateMany({
      where: { id: req.params.id, status: 'PENDING_VALIDATION' },
      data: {
        status: decision,
        validatedBy: PRESIDENT_EMAIL,
        validatedAt: new Date(),
        validationComment
      }
    });

    if (result.count === 0) {
      return res.status(409).json({ error: 'Ce dossier est introuvable ou a deja ete traite.' });
    }

    const request = await req.app.locals.prisma.retroStudioRequest.findUnique({ where: { id: req.params.id } });
    return res.json(request);
  } catch (error) {
    console.error('RetroStudio validation failed:', error.message);
    return res.status(500).json({ error: 'Impossible de valider le dossier RetroStudio.' });
  }
});

export default router;