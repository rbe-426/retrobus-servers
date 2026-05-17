/**
 * Museum Controller - Gestion des modules du musée
 */

// Données mock pour le développement
const modules = [
  {
    id: 'collections',
    title: 'Gestion des Collections',
    description: 'Inventaire, catalogage et suivi des pièces du musée',
    icon: 'FiArchive',
    color: 'rbe.500',
    badge: 'Essentiel',
    stats: { items: '2,450', categories: '12' }
  },
  {
    id: 'expositions',
    title: 'Expositions',
    description: 'Planification et gestion des expositions',
    icon: 'FiImage',
    color: 'blue.500',
    badge: 'Actif',
    stats: { current: '3', upcoming: '5' }
  },
  {
    id: 'conservation',
    title: 'Conservation',
    description: 'Suivi des travaux de restauration',
    icon: 'FiPackage',
    color: 'green.500',
    badge: 'Prioritaire',
    stats: { inProgress: '8', planned: '12' }
  },
  {
    id: 'loans',
    title: 'Prêts & Emprunts',
    description: 'Gestion des prêts d\'œuvres',
    icon: 'FiTrendingUp',
    color: 'purple.500',
    badge: 'Actif',
    stats: { active: '4', pending: '2' }
  },
  {
    id: 'mediation',
    title: 'Médiation Culturelle',
    description: 'Ateliers et programmes éducatifs',
    icon: 'FiBook',
    color: 'orange.500',
    badge: 'Actif',
    stats: { workshops: '24', participants: '450' }
  },
  {
    id: 'documentation',
    title: 'Documentation',
    description: 'Archives et ressources documentaires',
    icon: 'FiFileText',
    color: 'teal.500',
    badge: 'Référence',
    stats: { documents: '1,840', digital: '980' }
  },
  {
    id: 'sponsorship',
    title: 'Mécénat',
    description: 'Gestion des dons et des mécènes',
    icon: 'FiGift',
    color: 'pink.500',
    badge: 'Actif',
    stats: { sponsors: '18', raised: '€45k' }
  },
  {
    id: 'events',
    title: 'Événements',
    description: 'Organisation d\'événements culturels',
    icon: 'FiCalendar',
    color: 'cyan.500',
    badge: 'En cours',
    stats: { upcoming: '7', past: '34' }
  }
];

let collections = [];
let exhibitions = [];
let conservationItems = [];
let loans = [];
let mediationItems = [];
let documentation = [];
let sponsorships = [];
let museumEvents = [];

/**
 * GET /api/museum/stats - Statistiques globales
 */
export const getStats = async (req, res) => {
  try {
    const stats = {
      totalModules: modules.length,
      customization: '100%',
      support: '24/7'
    };

    console.log('📊 Stats musée récupérées');
    res.json(stats);
  } catch (error) {
    console.error('❌ Erreur getStats:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des stats',
      details: error.message 
    });
  }
};

/**
 * GET /api/museum/modules - Liste des modules
 */
export const getModules = async (req, res) => {
  try {
    console.log(`🏛️ ${modules.length} modules récupérés`);
    res.json(modules);
  } catch (error) {
    console.error('❌ Erreur getModules:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des modules',
      details: error.message 
    });
  }
};

/**
 * GET /api/museum/modules/:id - Détails d'un module
 */
export const getModule = async (req, res) => {
  try {
    const { id } = req.params;
    const module = modules.find(m => m.id === id);

    if (!module) {
      return res.status(404).json({ error: 'Module non trouvé' });
    }

    console.log('📦 Module récupéré:', id);
    res.json(module);
  } catch (error) {
    console.error('❌ Erreur getModule:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération du module',
      details: error.message 
    });
  }
};

// ========== COLLECTIONS ==========

export const getCollections = async (req, res) => {
  try {
    console.log(`🗂️ ${collections.length} collections récupérées`);
    res.json(collections);
  } catch (error) {
    console.error('❌ Erreur getCollections:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des collections', details: error.message });
  }
};

export const getCollection = async (req, res) => {
  try {
    const item = collections.find(c => c.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Collection non trouvée' });
    res.json(item);
  } catch (error) {
    console.error('❌ Erreur getCollection:', error);
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

export const createCollection = async (req, res) => {
  try {
    const newItem = { id: `col_${Date.now()}`, ...req.body, createdAt: new Date() };
    collections.push(newItem);
    console.log('✅ Collection créée:', newItem.id);
    res.status(201).json(newItem);
  } catch (error) {
    console.error('❌ Erreur createCollection:', error);
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

export const updateCollection = async (req, res) => {
  try {
    const index = collections.findIndex(c => c.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Collection non trouvée' });
    collections[index] = { ...collections[index], ...req.body };
    console.log('✅ Collection mise à jour:', req.params.id);
    res.json(collections[index]);
  } catch (error) {
    console.error('❌ Erreur updateCollection:', error);
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

export const deleteCollection = async (req, res) => {
  try {
    const index = collections.findIndex(c => c.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Collection non trouvée' });
    collections.splice(index, 1);
    console.log('✅ Collection supprimée:', req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Erreur deleteCollection:', error);
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

export const getCollectionsStats = async (req, res) => {
  try {
    res.json({ total: collections.length, active: collections.filter(c => c.active).length });
  } catch (error) {
    console.error('❌ Erreur getCollectionsStats:', error);
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

// ========== EXHIBITIONS ==========

export const getExhibitions = async (req, res) => {
  try {
    console.log(`🖼️ ${exhibitions.length} expositions récupérées`);
    res.json(exhibitions);
  } catch (error) {
    console.error('❌ Erreur getExhibitions:', error);
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

export const getExhibition = async (req, res) => {
  try {
    const item = exhibitions.find(e => e.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Exposition non trouvée' });
    res.json(item);
  } catch (error) {
    console.error('❌ Erreur getExhibition:', error);
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

export const createExhibition = async (req, res) => {
  try {
    const newItem = { id: `exh_${Date.now()}`, ...req.body, createdAt: new Date() };
    exhibitions.push(newItem);
    console.log('✅ Exposition créée:', newItem.id);
    res.status(201).json(newItem);
  } catch (error) {
    console.error('❌ Erreur createExhibition:', error);
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

export const updateExhibition = async (req, res) => {
  try {
    const index = exhibitions.findIndex(e => e.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Exposition non trouvée' });
    exhibitions[index] = { ...exhibitions[index], ...req.body };
    console.log('✅ Exposition mise à jour:', req.params.id);
    res.json(exhibitions[index]);
  } catch (error) {
    console.error('❌ Erreur updateExhibition:', error);
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

export const deleteExhibition = async (req, res) => {
  try {
    const index = exhibitions.findIndex(e => e.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Exposition non trouvée' });
    exhibitions.splice(index, 1);
    console.log('✅ Exposition supprimée:', req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Erreur deleteExhibition:', error);
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

export const getExhibitionsStats = async (req, res) => {
  try {
    res.json({ total: exhibitions.length, current: exhibitions.filter(e => e.status === 'current').length });
  } catch (error) {
    console.error('❌ Erreur getExhibitionsStats:', error);
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

// ========== CONSERVATION ==========

export const getConservationItems = async (req, res) => {
  try {
    console.log(`🔧 ${conservationItems.length} items de conservation récupérés`);
    res.json(conservationItems);
  } catch (error) {
    console.error('❌ Erreur getConservationItems:', error);
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

export const getConservationItem = async (req, res) => {
  try {
    const item = conservationItems.find(c => c.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Item non trouvé' });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

export const createConservationItem = async (req, res) => {
  try {
    const newItem = { id: `cons_${Date.now()}`, ...req.body, createdAt: new Date() };
    conservationItems.push(newItem);
    res.status(201).json(newItem);
  } catch (error) {
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

export const updateConservationItem = async (req, res) => {
  try {
    const index = conservationItems.findIndex(c => c.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Item non trouvé' });
    conservationItems[index] = { ...conservationItems[index], ...req.body };
    res.json(conservationItems[index]);
  } catch (error) {
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

export const deleteConservationItem = async (req, res) => {
  try {
    const index = conservationItems.findIndex(c => c.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Item non trouvé' });
    conservationItems.splice(index, 1);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

export const getConservationStats = async (req, res) => {
  try {
    res.json({ total: conservationItems.length, inProgress: conservationItems.filter(c => c.status === 'inProgress').length });
  } catch (error) {
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

// ========== LOANS (Prêts) ==========

export const getLoans = async (req, res) => {
  try {
    console.log(`📤 ${loans.length} prêts récupérés`);
    res.json(loans);
  } catch (error) {
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

export const getLoan = async (req, res) => {
  try {
    const item = loans.find(l => l.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Prêt non trouvé' });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

export const createLoan = async (req, res) => {
  try {
    const newItem = { id: `loan_${Date.now()}`, ...req.body, createdAt: new Date() };
    loans.push(newItem);
    res.status(201).json(newItem);
  } catch (error) {
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

export const updateLoan = async (req, res) => {
  try {
    const index = loans.findIndex(l => l.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Prêt non trouvé' });
    loans[index] = { ...loans[index], ...req.body };
    res.json(loans[index]);
  } catch (error) {
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

export const deleteLoan = async (req, res) => {
  try {
    const index = loans.findIndex(l => l.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Prêt non trouvé' });
    loans.splice(index, 1);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

export const getLoansStats = async (req, res) => {
  try {
    res.json({ total: loans.length, active: loans.filter(l => l.status === 'active').length });
  } catch (error) {
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

// ========== MEDIATION ==========

export const getMediationItems = async (req, res) => {
  try {
    console.log(`👨‍🏫 ${mediationItems.length} items de médiation récupérés`);
    res.json(mediationItems);
  } catch (error) {
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

export const getMediationItem = async (req, res) => {
  try {
    const item = mediationItems.find(m => m.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Item non trouvé' });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

export const createMediationItem = async (req, res) => {
  try {
    const newItem = { id: `med_${Date.now()}`, ...req.body, createdAt: new Date() };
    mediationItems.push(newItem);
    res.status(201).json(newItem);
  } catch (error) {
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

export const updateMediationItem = async (req, res) => {
  try {
    const index = mediationItems.findIndex(m => m.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Item non trouvé' });
    mediationItems[index] = { ...mediationItems[index], ...req.body };
    res.json(mediationItems[index]);
  } catch (error) {
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

export const deleteMediationItem = async (req, res) => {
  try {
    const index = mediationItems.findIndex(m => m.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Item non trouvé' });
    mediationItems.splice(index, 1);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

export const getMediationStats = async (req, res) => {
  try {
    res.json({ total: mediationItems.length, active: mediationItems.filter(m => m.status === 'active').length });
  } catch (error) {
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

// ========== DOCUMENTATION ==========

export const getDocumentation = async (req, res) => {
  try {
    console.log(`📚 ${documentation.length} documents récupérés`);
    res.json(documentation);
  } catch (error) {
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

export const getDocumentationItem = async (req, res) => {
  try {
    const item = documentation.find(d => d.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Document non trouvé' });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

export const createDocumentationItem = async (req, res) => {
  try {
    const newItem = { id: `doc_${Date.now()}`, ...req.body, createdAt: new Date() };
    documentation.push(newItem);
    res.status(201).json(newItem);
  } catch (error) {
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

export const updateDocumentationItem = async (req, res) => {
  try {
    const index = documentation.findIndex(d => d.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Document non trouvé' });
    documentation[index] = { ...documentation[index], ...req.body };
    res.json(documentation[index]);
  } catch (error) {
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

export const deleteDocumentationItem = async (req, res) => {
  try {
    const index = documentation.findIndex(d => d.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Document non trouvé' });
    documentation.splice(index, 1);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

export const getDocumentationStats = async (req, res) => {
  try {
    res.json({ total: documentation.length, digital: documentation.filter(d => d.digital).length });
  } catch (error) {
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

// ========== SPONSORSHIP (Mécénat) ==========

export const getSponsorships = async (req, res) => {
  try {
    console.log(`💎 ${sponsorships.length} mécénats récupérés`);
    res.json(sponsorships);
  } catch (error) {
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

export const getSponsorship = async (req, res) => {
  try {
    const item = sponsorships.find(s => s.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Mécénat non trouvé' });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

export const createSponsorship = async (req, res) => {
  try {
    const newItem = { id: `spons_${Date.now()}`, ...req.body, createdAt: new Date() };
    sponsorships.push(newItem);
    res.status(201).json(newItem);
  } catch (error) {
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

export const updateSponsorship = async (req, res) => {
  try {
    const index = sponsorships.findIndex(s => s.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Mécénat non trouvé' });
    sponsorships[index] = { ...sponsorships[index], ...req.body };
    res.json(sponsorships[index]);
  } catch (error) {
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

export const deleteSponsorship = async (req, res) => {
  try {
    const index = sponsorships.findIndex(s => s.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Mécénat non trouvé' });
    sponsorships.splice(index, 1);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

export const getSponsorshipStats = async (req, res) => {
  try {
    res.json({ total: sponsorships.length, active: sponsorships.filter(s => s.status === 'active').length });
  } catch (error) {
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

// ========== MUSEUM EVENTS ==========

export const getMuseumEvents = async (req, res) => {
  try {
    console.log(`🎉 ${museumEvents.length} événements musée récupérés`);
    res.json(museumEvents);
  } catch (error) {
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

export const getMuseumEvent = async (req, res) => {
  try {
    const item = museumEvents.find(e => e.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Événement non trouvé' });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

export const createMuseumEvent = async (req, res) => {
  try {
    const newItem = { id: `mevent_${Date.now()}`, ...req.body, createdAt: new Date() };
    museumEvents.push(newItem);
    res.status(201).json(newItem);
  } catch (error) {
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

export const updateMuseumEvent = async (req, res) => {
  try {
    const index = museumEvents.findIndex(e => e.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Événement non trouvé' });
    museumEvents[index] = { ...museumEvents[index], ...req.body };
    res.json(museumEvents[index]);
  } catch (error) {
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

export const deleteMuseumEvent = async (req, res) => {
  try {
    const index = museumEvents.findIndex(e => e.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Événement non trouvé' });
    museumEvents.splice(index, 1);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};

export const getMuseumEventsStats = async (req, res) => {
  try {
    res.json({ total: museumEvents.length, upcoming: museumEvents.filter(e => e.status === 'upcoming').length });
  } catch (error) {
    res.status(500).json({ error: 'Erreur', details: error.message });
  }
};
