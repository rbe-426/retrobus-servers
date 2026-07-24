import { Router } from 'express';

const router = Router();
const GAELLE_EMAIL = 'g.champenois@retrobus-essonne.fr';
const DAY_MS = 24 * 60 * 60 * 1000;

const requireAuth = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Non authentifie' });
  next();
};

const isGaelle = (req) => String(req.user?.email || '').trim().toLowerCase() === GAELLE_EMAIL;

const parseDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
};

router.post('/requests', requireAuth, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const {
      contactDate,
      contactName,
      contactRole,
      productionCompany,
      audiovisualProject,
      shootDate
    } = req.body || {};

    const parsedContactDate = parseDate(contactDate);
    const parsedShootDate = parseDate(shootDate);
    const requiredFields = [contactName, contactRole, productionCompany, audiovisualProject];

    if (!parsedContactDate || !parsedShootDate || requiredFields.some((field) => !String(field || '').trim())) {
      return res.status(400).json({ error: 'Les informations de prise de contact et de tournage sont obligatoires.' });
    }

    const leadTimeDays = Math.round((parsedShootDate.getTime() - parsedContactDate.getTime()) / DAY_MS);
    const validationRequired = leadTimeDays <= 15;
    const request = await prisma.retroStudioRequest.create({
      data: {
        contactDate: parsedContactDate,
        contactName: String(contactName).trim(),
        contactRole: String(contactRole).trim(),
        productionCompany: String(productionCompany).trim(),
        audiovisualProject: String(audiovisualProject).trim(),
        shootDate: parsedShootDate,
        leadTimeDays,
        validationRequired,
        status: validationRequired ? 'PENDING_VALIDATION' : 'RECORDED',
        createdBy: req.user.email || req.user.id || null
      }
    });

    if (validationRequired) {
      await prisma.notification.create({
        data: {
          title: `RetroStudio : validation requise (${leadTimeDays} jours)`,
          message: `${request.productionCompany} - ${request.audiovisualProject}. Tournage prévu le ${shootDate}. Validation présidentielle requise.`,
          type: 'warning',
          priority: 'high',
          targetedTo: `user:${GAELLE_EMAIL}`,
          createdBy: req.user.email || req.user.id || 'SYSTEM'
        }
      });
    }

    return res.status(201).json(request);
  } catch (error) {
    console.error('RetroStudio request creation failed:', error.message);
    return res.status(500).json({ error: 'Impossible d enregistrer le dossier RetroStudio.' });
  }
});

router.get('/requests/pending-validation', requireAuth, async (req, res) => {
  if (!isGaelle(req)) return res.status(403).json({ error: 'Validation reservee a la presidente responsable.' });

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
  if (!isGaelle(req)) return res.status(403).json({ error: 'Validation reservee a Gaelle Champenois.' });

  const decision = String(req.body?.decision || '').toUpperCase();
  const validationComment = String(req.body?.comment || '').trim() || null;
  if (!['APPROVED', 'REJECTED'].includes(decision)) {
    return res.status(400).json({ error: 'La decision doit etre APPROVED ou REJECTED.' });
  }

  try {
    const request = await req.app.locals.prisma.retroStudioRequest.update({
      where: { id: req.params.id },
      data: {
        status: decision,
        validatedBy: GAELLE_EMAIL,
        validatedAt: new Date(),
        validationComment
      }
    });
    return res.json(request);
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Dossier RetroStudio introuvable.' });
    console.error('RetroStudio validation failed:', error.message);
    return res.status(500).json({ error: 'Impossible de valider le dossier RetroStudio.' });
  }
});

export default router;