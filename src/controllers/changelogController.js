import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Formatte une date en format français (JJ/MM/AAAA)
 */
const formatDateFR = (date) => {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Formatte un changelog pour l'affichage (avec date FR)
 */
const formatChangelog = (changelog) => {
  return {
    ...changelog,
    dateFR: formatDateFR(changelog.date),
    changes: Array.isArray(changelog.changes) ? changelog.changes : []
  };
};

/**
 * GET /api/changelog - Récupérer tous les changelogs
 */
export const getAllChangelogs = async (req, res) => {
  try {
    const changelogs = await prisma.changelog.findMany({
      orderBy: { date: 'desc' }
    });
    
    const formatted = changelogs.map(formatChangelog);
    res.json(formatted);
  } catch (error) {
    console.error('❌ Erreur récupération changelogs:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération des changelogs' });
  }
};

/**
 * GET /api/changelog/:id - Récupérer un changelog spécifique
 */
export const getChangelogById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const changelog = await prisma.changelog.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!changelog) {
      return res.status(404).json({ error: 'Changelog non trouvé' });
    }
    
    res.json(formatChangelog(changelog));
  } catch (error) {
    console.error('❌ Erreur récupération changelog:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

/**
 * POST /api/changelog - Créer un nouveau changelog
 */
export const createChangelog = async (req, res) => {
  try {
    const { title, version, date, changes } = req.body;
    
    // Validation
    if (!title || !version) {
      return res.status(400).json({ error: 'Le titre et la version sont requis' });
    }
    
    if (!Array.isArray(changes)) {
      return res.status(400).json({ error: 'Le champ "changes" doit être un tableau' });
    }
    
    const changelog = await prisma.changelog.create({
      data: {
        title,
        version,
        date: date ? new Date(date) : new Date(),
        changes: changes
      }
    });
    
    res.status(201).json(formatChangelog(changelog));
  } catch (error) {
    console.error('❌ Erreur création changelog:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la création du changelog' });
  }
};

/**
 * PUT /api/changelog/:id - Mettre à jour un changelog
 */
export const updateChangelog = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, version, date, changes } = req.body;
    
    // Validation
    if (changes && !Array.isArray(changes)) {
      return res.status(400).json({ error: 'Le champ "changes" doit être un tableau' });
    }
    
    const data = {};
    if (title !== undefined) data.title = title;
    if (version !== undefined) data.version = version;
    if (date !== undefined) data.date = new Date(date);
    if (changes !== undefined) data.changes = changes;
    
    const changelog = await prisma.changelog.update({
      where: { id: parseInt(id) },
      data
    });
    
    res.json(formatChangelog(changelog));
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Changelog non trouvé' });
    }
    console.error('❌ Erreur mise à jour changelog:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la mise à jour' });
  }
};

/**
 * DELETE /api/changelog/:id - Supprimer un changelog
 */
export const deleteChangelog = async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.changelog.delete({
      where: { id: parseInt(id) }
    });
    
    res.json({ success: true, message: 'Changelog supprimé avec succès' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Changelog non trouvé' });
    }
    console.error('❌ Erreur suppression changelog:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la suppression' });
  }
};

/**
 * GET /api/changelog/stats - Statistiques des changelogs
 */
export const getChangelogStats = async (req, res) => {
  try {
    const [total, lastMonth] = await Promise.all([
      prisma.changelog.count(),
      prisma.changelog.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);
    
    const latest = await prisma.changelog.findFirst({
      orderBy: { date: 'desc' }
    });
    
    res.json({
      total,
      lastMonth,
      latestVersion: latest ? latest.version : null,
      latestDate: latest ? formatDateFR(latest.date) : null
    });
  } catch (error) {
    console.error('❌ Erreur stats changelog:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};
