import { Router } from 'express';
import { randomBytes } from 'node:crypto';

export const AMENDMENT_REASONS = [
  'OPPOSITION_COMPLETE',
  'OPPOSITION_PARTIELLE',
  'MODIFICATION_COMPLETE',
  'MODIFICATION_PARTIELLE',
  'PRECISION',
  'AJOUT',
  'MISE_EN_CONFORMITE',
  'REPORT_PERIODE_TRANSITOIRE'
];
const REJECTION_KINDS = ['LEGAL', 'STATUTAIRE', 'AUTRE'];
const FINAL_STATUSES = ['ADOPTED', 'REJECTED', 'NOT_ADOPTED'];
const CHOICES = ['POUR', 'CONTRE'];
const ARTICLE_HEADING = /^\s*(?:#+\s*)?(?:\*\*)?\s*(art(?:icle)?\.?\s*(?:premier|1er|\d+[a-z]?(?:[.-]\d+)*)\b[^\n]*)$/i;

const newJoinCode = () => randomBytes(4).toString('hex').toUpperCase();

export function splitIntoArticles(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  const articles = [];
  let current = null;
  const preamble = [];

  for (const line of lines) {
    const match = line.match(ARTICLE_HEADING);
    if (match) {
      if (current) articles.push(current);
      current = { label: match[1].replace(/\*\*/g, '').trim().slice(0, 200), body: [] };
    } else if (current) {
      current.body.push(line);
    } else {
      preamble.push(line);
    }
  }
  if (current) articles.push(current);

  const result = articles.map((article) => ({ label: article.label, body: article.body.join('\n').trim() }));
  const intro = preamble.join('\n').trim();
  if (!result.length) {
    return intro ? [{ label: 'Texte intégral', body: intro }] : [];
  }
  if (intro) result.unshift({ label: 'Préambule', body: intro });
  return result;
}

export function createAgModule({ prisma, requireAuth, isPresident }) {
  const router = Router();
  let lockCache = { value: false, at: 0 };

  const identityOf = (req) => String(req.user?.email || req.user?.id || '').trim().toLowerCase();

  const nameOf = async (req) => {
    const email = identityOf(req);
    try {
      const member = await prisma.members.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { firstName: true, lastName: true }
      });
      if (member?.firstName) return `${member.firstName} ${member.lastName || ''}`.trim();
    } catch { /* identité de repli ci-dessous */ }
    return email;
  };

  const currentSession = () => prisma.agSession.findFirst({
    where: { closedAt: null },
    orderBy: { createdAt: 'desc' }
  });

  const requirePresident = (req, res, next) => {
    if (isPresident(req)) return next();
    return res.status(403).json({ error: 'Réservé au président de séance.' });
  };

  const isExcluded = (session, userId) => Array.isArray(session?.excludedUserIds)
    && session.excludedUserIds.includes(userId);

  const tally = (poll) => {
    const pour = poll.votes.filter((vote) => vote.choice === 'POUR');
    const contre = poll.votes.filter((vote) => vote.choice === 'CONTRE');
    return {
      pour: pour.length,
      contre: contre.length,
      total: poll.votes.length,
      verdict: poll.status === 'CLOSED' ? (pour.length > contre.length ? 'ADOPTED' : 'NOT_ADOPTED') : null
    };
  };

  const pollForPresident = (poll) => ({
    id: poll.id,
    title: poll.title,
    status: poll.status,
    position: poll.position,
    amendmentId: poll.amendmentId,
    openedAt: poll.openedAt,
    closedAt: poll.closedAt,
    ...tally(poll),
    voters: {
      POUR: poll.votes.filter((vote) => vote.choice === 'POUR').map((vote) => vote.voterName),
      CONTRE: poll.votes.filter((vote) => vote.choice === 'CONTRE').map((vote) => vote.voterName)
    }
  });

  const publicAmendment = (amendment, poll) => ({
    id: amendment.id,
    documentId: amendment.documentId,
    documentTitle: amendment.document?.title,
    articleLabel: amendment.article?.label,
    reason: amendment.reason,
    proposedText: amendment.proposedText,
    justification: amendment.justification,
    authorName: amendment.authorName,
    status: amendment.status,
    rejectionKind: amendment.rejectionKind,
    rejectionNote: amendment.rejectionNote,
    decidedAt: amendment.decidedAt,
    vote: poll ? { pour: tally(poll).pour, contre: tally(poll).contre, total: poll.votes.length } : null
  });

  const amendmentInclude = {
    document: { select: { title: true } },
    article: { select: { label: true } },
    polls: { include: { votes: true }, orderBy: { createdAt: 'desc' } }
  };

  // Verrouillage global : seul le président garde l'accès hors des routes AG et d'authentification.
  const lockMiddleware = async (req, res, next) => {
    if (!req.user || !req.path.startsWith('/api/')) return next();
    const allowed = ['/api/ag', '/api/auth', '/api/me', '/api/csrf-token', '/api/health'];
    if (allowed.some((prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`))) return next();
    if (isPresident(req)) return next();

    const now = Date.now();
    if (now - lockCache.at > 2000) {
      try {
        const active = await prisma.agSession.findFirst({ where: { modeActive: true }, select: { id: true } });
        lockCache = { value: Boolean(active), at: now };
      } catch {
        lockCache = { value: false, at: now };
      }
    }
    if (!lockCache.value) return next();
    return res.status(423).json({ error: 'Mode AG activé, l\'accès à l\'URBEX est suspendu.', code: 'AG_MODE' });
  };

  router.use(requireAuth);

  router.get('/status', async (req, res) => {
    try {
      const session = await currentSession();
      const userId = identityOf(req);
      const president = isPresident(req);
      if (!session) return res.json({ modeActive: false, isPresident: president, session: null });
      const [joined, openPolls, votes] = await Promise.all([
        prisma.agAttendee.findUnique({ where: { sessionId_userId: { sessionId: session.id, userId } } }),
        prisma.agPoll.count({ where: { sessionId: session.id, status: 'OPEN' } }),
        prisma.agVote.findMany({ where: { userId, poll: { sessionId: session.id, status: 'OPEN' } }, select: { pollId: true } })
      ]);
      res.json({
        modeActive: session.modeActive,
        isPresident: president,
        session: { id: session.id, title: session.title, meetingDate: session.meetingDate },
        joined: Boolean(joined),
        excluded: isExcluded(session, userId),
        openPolls,
        pendingPolls: Math.max(0, openPolls - votes.length)
      });
    } catch (error) {
      console.error('❌ AG status:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  router.post('/join', async (req, res) => {
    try {
      const session = await currentSession();
      const code = String(req.body?.code || '').trim().toUpperCase();
      if (!session || !code || code !== session.joinCode) {
        return res.status(400).json({ error: 'Code de session invalide.' });
      }
      const userId = identityOf(req);
      if (isExcluded(session, userId)) {
        return res.status(403).json({ error: 'Vous ne disposez pas du droit de vote pour cette assemblée.' });
      }
      const name = await nameOf(req);
      await prisma.agAttendee.upsert({
        where: { sessionId_userId: { sessionId: session.id, userId } },
        create: { sessionId: session.id, userId, name },
        update: { name }
      });
      res.json({ joined: true });
    } catch (error) {
      console.error('❌ AG join:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // --- Président : session -------------------------------------------------
  router.get('/session', requirePresident, async (req, res) => {
    try {
      const session = await currentSession();
      if (!session) return res.json({ session: null });
      const attendees = await prisma.agAttendee.findMany({ where: { sessionId: session.id }, orderBy: { joinedAt: 'asc' } });
      res.json({ session, attendees, reasons: AMENDMENT_REASONS });
    } catch (error) {
      console.error('❌ AG session:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  router.post('/session', requirePresident, async (req, res) => {
    try {
      if (await currentSession()) return res.status(409).json({ error: 'Une session est déjà en cours.' });
      const title = String(req.body?.title || '').trim();
      if (!title) return res.status(400).json({ error: 'Titre requis.' });
      const meetingDate = req.body?.meetingDate ? new Date(req.body.meetingDate) : null;
      const session = await prisma.agSession.create({
        data: { title, meetingDate: meetingDate && !Number.isNaN(meetingDate.getTime()) ? meetingDate : null, joinCode: newJoinCode() }
      });
      res.status(201).json({ session });
    } catch (error) {
      console.error('❌ AG session create:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  router.patch('/session', requirePresident, async (req, res) => {
    try {
      const session = await currentSession();
      if (!session) return res.status(404).json({ error: 'Aucune session.' });
      const data = {};
      if (typeof req.body?.modeActive === 'boolean') data.modeActive = req.body.modeActive;
      if (Array.isArray(req.body?.excludedUserIds)) {
        data.excludedUserIds = req.body.excludedUserIds.map((id) => String(id).trim().toLowerCase()).filter(Boolean);
      }
      if (typeof req.body?.title === 'string' && req.body.title.trim()) data.title = req.body.title.trim();
      if (req.body?.rotateCode === true) data.joinCode = newJoinCode();
      if (req.body?.close === true) {
        data.closedAt = new Date();
        data.modeActive = false;
      }
      const updated = await prisma.agSession.update({ where: { id: session.id }, data });
      lockCache = { value: false, at: 0 };
      res.json({ session: updated });
    } catch (error) {
      console.error('❌ AG session update:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // --- Documents ------------------------------------------------------------
  router.get('/documents', async (req, res) => {
    try {
      const session = await currentSession();
      if (!session) return res.json({ documents: [] });
      const documents = await prisma.agDocument.findMany({
        where: { sessionId: session.id },
        orderBy: { createdAt: 'asc' },
        include: { articles: { orderBy: { position: 'asc' } } }
      });
      res.json({ documents });
    } catch (error) {
      console.error('❌ AG documents:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  router.post('/documents', requirePresident, async (req, res) => {
    try {
      const session = await currentSession();
      if (!session) return res.status(409).json({ error: 'Créez d\'abord une session AG.' });
      const title = String(req.body?.title || '').trim();
      const articles = splitIntoArticles(req.body?.text);
      if (!title) return res.status(400).json({ error: 'Titre requis.' });
      if (!articles.length) return res.status(400).json({ error: 'Le document est vide.' });
      const document = await prisma.agDocument.create({
        data: {
          sessionId: session.id,
          title,
          createdBy: identityOf(req),
          articles: { create: articles.map((article, index) => ({ position: index, label: article.label, body: article.body })) }
        },
        include: { articles: { orderBy: { position: 'asc' } } }
      });
      res.status(201).json({ document });
    } catch (error) {
      console.error('❌ AG document create:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  router.delete('/documents/:id', requirePresident, async (req, res) => {
    try {
      await prisma.agDocument.delete({ where: { id: req.params.id } });
      res.json({ ok: true });
    } catch (error) {
      res.status(error.code === 'P2025' ? 404 : 500).json({ error: 'Document introuvable.' });
    }
  });

  // --- Amendements ----------------------------------------------------------
  router.post('/amendments', async (req, res) => {
    try {
      const session = await currentSession();
      if (!session) return res.status(409).json({ error: 'Aucune session AG en cours.' });
      const userId = identityOf(req);
      if (isExcluded(session, userId)) return res.status(403).json({ error: 'Droit de dépôt non accordé.' });
      const reason = String(req.body?.reason || '');
      const proposedText = String(req.body?.proposedText || '').trim();
      if (!AMENDMENT_REASONS.includes(reason)) return res.status(400).json({ error: 'Motif invalide.' });
      if (!proposedText) return res.status(400).json({ error: 'Le texte de l\'amendement est requis.' });
      const article = await prisma.agArticle.findFirst({
        where: { id: String(req.body?.articleId || ''), document: { sessionId: session.id } }
      });
      if (!article) return res.status(404).json({ error: 'Article introuvable.' });
      const amendment = await prisma.agAmendment.create({
        data: {
          documentId: article.documentId,
          articleId: article.id,
          authorId: userId,
          authorName: await nameOf(req),
          reason,
          proposedText,
          justification: String(req.body?.justification || '').trim() || null
        }
      });
      res.status(201).json({ amendment: { id: amendment.id, status: amendment.status } });
    } catch (error) {
      console.error('❌ AG amendment create:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // Adhérent : ses propres dépôts (sans détail d'instruction) + amendements clos.
  router.get('/amendments/mine', async (req, res) => {
    try {
      const rows = await prisma.agAmendment.findMany({
        where: { authorId: identityOf(req) },
        orderBy: { createdAt: 'desc' },
        include: amendmentInclude
      });
      res.json({
        amendments: rows.map((row) => FINAL_STATUSES.includes(row.status)
          ? publicAmendment(row, row.polls[0])
          : { id: row.id, documentTitle: row.document?.title, articleLabel: row.article?.label, reason: row.reason, status: 'IN_REVIEW' })
      });
    } catch (error) {
      console.error('❌ AG amendments mine:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  router.get('/amendments/published', async (req, res) => {
    try {
      const rows = await prisma.agAmendment.findMany({
        where: { status: { in: FINAL_STATUSES } },
        orderBy: { decidedAt: 'desc' },
        include: amendmentInclude
      });
      res.json({ amendments: rows.map((row) => publicAmendment(row, row.polls[0])) });
    } catch (error) {
      console.error('❌ AG amendments published:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  router.get('/amendments', requirePresident, async (req, res) => {
    try {
      const rows = await prisma.agAmendment.findMany({ orderBy: { createdAt: 'desc' }, include: amendmentInclude });
      res.json({
        amendments: rows.map((row) => ({
          ...publicAmendment(row, row.polls[0]),
          createdAt: row.createdAt,
          pollId: row.polls[0]?.id || null,
          pollStatus: row.polls[0]?.status || null
        }))
      });
    } catch (error) {
      console.error('❌ AG amendments:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  router.post('/amendments/:id/reject', requirePresident, async (req, res) => {
    try {
      const kind = String(req.body?.kind || '').toUpperCase();
      if (!REJECTION_KINDS.includes(kind)) return res.status(400).json({ error: 'Motif de rejet invalide.' });
      const amendment = await prisma.agAmendment.findUnique({ where: { id: req.params.id } });
      if (!amendment) return res.status(404).json({ error: 'Amendement introuvable.' });
      if (FINAL_STATUSES.includes(amendment.status)) return res.status(409).json({ error: 'Amendement déjà clos.' });
      await prisma.$transaction([
        prisma.agPoll.deleteMany({ where: { amendmentId: amendment.id, status: 'DRAFT' } }),
        prisma.agAmendment.update({
          where: { id: amendment.id },
          data: { status: 'REJECTED', rejectionKind: kind, rejectionNote: String(req.body?.note || '').trim() || null, decidedAt: new Date() }
        })
      ]);
      res.json({ ok: true });
    } catch (error) {
      console.error('❌ AG amendment reject:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  router.post('/amendments/:id/to-vote', requirePresident, async (req, res) => {
    try {
      const session = await currentSession();
      if (!session) return res.status(409).json({ error: 'Aucune session AG en cours.' });
      const amendment = await prisma.agAmendment.findUnique({ where: { id: req.params.id }, include: { article: true, document: true } });
      if (!amendment) return res.status(404).json({ error: 'Amendement introuvable.' });
      if (amendment.status !== 'SUBMITTED') return res.status(409).json({ error: 'Amendement déjà traité.' });
      const position = await prisma.agPoll.count({ where: { sessionId: session.id } });
      const [, poll] = await prisma.$transaction([
        prisma.agAmendment.update({ where: { id: amendment.id }, data: { status: 'VOTE' } }),
        prisma.agPoll.create({
          data: {
            sessionId: session.id,
            amendmentId: amendment.id,
            title: `Amendement — ${amendment.document.title}, ${amendment.article.label}`,
            position
          }
        })
      ]);
      res.status(201).json({ pollId: poll.id });
    } catch (error) {
      console.error('❌ AG amendment to-vote:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // --- Scrutins -------------------------------------------------------------
  router.get('/polls', requirePresident, async (req, res) => {
    try {
      const session = await currentSession();
      if (!session) return res.json({ polls: [] });
      const polls = await prisma.agPoll.findMany({
        where: { sessionId: session.id },
        orderBy: { position: 'asc' },
        include: { votes: { orderBy: { createdAt: 'asc' } } }
      });
      const attendees = await prisma.agAttendee.count({ where: { sessionId: session.id } });
      res.json({ polls: polls.map(pollForPresident), attendees });
    } catch (error) {
      console.error('❌ AG polls:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  router.post('/polls', requirePresident, async (req, res) => {
    try {
      const session = await currentSession();
      if (!session) return res.status(409).json({ error: 'Aucune session AG en cours.' });
      const title = String(req.body?.title || '').trim();
      if (!title) return res.status(400).json({ error: 'Intitulé requis.' });
      const position = await prisma.agPoll.count({ where: { sessionId: session.id } });
      const poll = await prisma.agPoll.create({ data: { sessionId: session.id, title, position } });
      res.status(201).json({ pollId: poll.id });
    } catch (error) {
      console.error('❌ AG poll create:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  router.post('/polls/:id/open', requirePresident, async (req, res) => {
    try {
      const poll = await prisma.agPoll.findUnique({ where: { id: req.params.id } });
      if (!poll) return res.status(404).json({ error: 'Scrutin introuvable.' });
      if (poll.status !== 'DRAFT') return res.status(409).json({ error: 'Scrutin déjà ouvert ou clos.' });
      await prisma.agPoll.update({ where: { id: poll.id }, data: { status: 'OPEN', openedAt: new Date() } });
      res.json({ ok: true });
    } catch (error) {
      console.error('❌ AG poll open:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  router.post('/polls/:id/close', requirePresident, async (req, res) => {
    try {
      const poll = await prisma.agPoll.findUnique({ where: { id: req.params.id }, include: { votes: true } });
      if (!poll) return res.status(404).json({ error: 'Scrutin introuvable.' });
      if (poll.status !== 'OPEN') return res.status(409).json({ error: 'Scrutin non ouvert.' });
      const now = new Date();
      const verdict = tally({ ...poll, status: 'CLOSED' }).verdict;
      await prisma.$transaction([
        prisma.agPoll.update({ where: { id: poll.id }, data: { status: 'CLOSED', closedAt: now } }),
        ...(poll.amendmentId
          ? [prisma.agAmendment.update({
              where: { id: poll.amendmentId },
              data: { status: verdict, decidedAt: now, rejectionKind: verdict === 'NOT_ADOPTED' ? 'VOTE' : null }
            })]
          : [])
      ]);
      res.json({ ok: true, verdict });
    } catch (error) {
      console.error('❌ AG poll close:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  router.delete('/polls/:id', requirePresident, async (req, res) => {
    try {
      const poll = await prisma.agPoll.findUnique({ where: { id: req.params.id } });
      if (!poll) return res.status(404).json({ error: 'Scrutin introuvable.' });
      if (poll.status !== 'DRAFT') return res.status(409).json({ error: 'Seul un scrutin non ouvert peut être supprimé.' });
      await prisma.$transaction([
        prisma.agPoll.delete({ where: { id: poll.id } }),
        ...(poll.amendmentId ? [prisma.agAmendment.update({ where: { id: poll.amendmentId }, data: { status: 'SUBMITTED' } })] : [])
      ]);
      res.json({ ok: true });
    } catch (error) {
      console.error('❌ AG poll delete:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // --- Adhérent : scrutins ouverts -----------------------------------------
  router.get('/polls/open', async (req, res) => {
    try {
      const session = await currentSession();
      if (!session) return res.json({ polls: [] });
      const userId = identityOf(req);
      const polls = await prisma.agPoll.findMany({
        where: { sessionId: session.id, status: 'OPEN' },
        orderBy: { position: 'asc' },
        include: { votes: { where: { userId }, select: { choice: true } }, amendment: { include: { article: true } } }
      });
      res.json({
        polls: polls.map((poll) => ({
          id: poll.id,
          title: poll.title,
          myChoice: poll.votes[0]?.choice || null,
          amendment: poll.amendment
            ? { articleLabel: poll.amendment.article?.label, reason: poll.amendment.reason, proposedText: poll.amendment.proposedText, justification: poll.amendment.justification }
            : null
        }))
      });
    } catch (error) {
      console.error('❌ AG polls open:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  router.post('/polls/:id/vote', async (req, res) => {
    try {
      const choice = String(req.body?.choice || '').toUpperCase();
      if (!CHOICES.includes(choice)) return res.status(400).json({ error: 'Choix invalide.' });
      const session = await currentSession();
      const userId = identityOf(req);
      const poll = await prisma.agPoll.findUnique({ where: { id: req.params.id } });
      if (!session || !poll || poll.sessionId !== session.id) return res.status(404).json({ error: 'Scrutin introuvable.' });
      if (poll.status !== 'OPEN') return res.status(409).json({ error: 'Ce scrutin n\'est pas ouvert.' });
      if (isExcluded(session, userId)) return res.status(403).json({ error: 'Droit de vote non accordé.' });
      const attendee = await prisma.agAttendee.findUnique({ where: { sessionId_userId: { sessionId: session.id, userId } } });
      if (!attendee) return res.status(403).json({ error: 'Scannez d\'abord le QR code de la session.' });
      try {
        await prisma.agVote.create({ data: { pollId: poll.id, userId, voterName: attendee.name, choice } });
        return res.status(201).json({ voted: true, choice });
      } catch (error) {
        if (error.code !== 'P2002') throw error;
        const existing = await prisma.agVote.findUnique({ where: { pollId_userId: { pollId: poll.id, userId } } });
        return res.status(200).json({ voted: true, alreadyVoted: true, choice: existing?.choice || choice });
      }
    } catch (error) {
      console.error('❌ AG vote:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  return { router, lockMiddleware };
}
