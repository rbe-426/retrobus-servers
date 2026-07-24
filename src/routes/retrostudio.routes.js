import { Router } from 'express';

const router = Router();
const PRESIDENT_EMAIL = 'belaidiw91@gmail.com';
const PRESIDENT_MATRICULE = 'w.belaidi';
const DAY_MS = 24 * 60 * 60 * 1000;

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
    if (existingRequest.status !== 'DRAFT') return res.status(409).json({ error: 'Seuls les brouillons peuvent etre modifies.' });

    const preparedRequest = prepareRequestData(req.body, Boolean(req.body?.saveAsDraft));
    if (preparedRequest.error) return res.status(400).json({ error: preparedRequest.error });
    const request = await prisma.retroStudioRequest.update({
      where: { id: req.params.id },
      data: preparedRequest.data
    });

    await createValidationNotification(prisma, request, req.body?.shootDate, req.user.email || req.user.id);
    return res.json(request);
  } catch (error) {
    console.error('RetroStudio draft update failed:', error.message);
    return res.status(500).json({ error: 'Impossible de mettre a jour le brouillon RetroStudio.' });
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