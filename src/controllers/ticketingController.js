/**
 * Ticketing Controller - Gestion de la billetterie du musée
 */

// Données mock pour le développement (à remplacer par Prisma plus tard)
let ticketTypes = [
  { id: 'plein', name: 'Tarif Plein', label: 'Tarif Plein', price: 12, description: 'Adulte sans réduction', active: true, sold: 3842, revenue: 46104 },
  { id: 'reduit', name: 'Tarif Réduit', label: 'Tarif Réduit', price: 8, description: 'Étudiants, seniors, demandeurs d\'emploi', active: true, sold: 2156, revenue: 17248 },
  { id: 'enfant', name: 'Tarif Enfant', label: 'Tarif Enfant', price: 5, description: 'Enfants de 6 à 12 ans', active: true, sold: 1842, revenue: 9210 },
  { id: 'groupe', name: 'Tarif Groupe', label: 'Tarif Groupe', price: 10, description: 'À partir de 10 personnes', active: true, sold: 1518, revenue: 15180 },
  { id: 'famille', name: 'Pass Famille', label: 'Pass Famille', price: 28, description: '2 adultes + 2 enfants', active: false, sold: 445, revenue: 12460 },
  { id: 'annuel', name: 'Abonnement Annuel', label: 'Abonnement Annuel', price: 80, description: 'Accès illimité pendant 1 an', active: true, sold: 127, revenue: 10160 }
];

let discounts = [
  { 
    id: 'etudiant', 
    name: 'Étudiant', 
    type: 'percentage', 
    value: 33, 
    conditions: 'Carte étudiante valide', 
    active: true,
    onlineAvailable: false,
    appliedTo: ['plein']
  },
  { 
    id: 'senior', 
    name: 'Senior +65', 
    type: 'percentage', 
    value: 25, 
    conditions: 'Âge 65 ans et plus', 
    active: true,
    onlineAvailable: false,
    appliedTo: ['plein']
  },
  { 
    id: 'rsa', 
    name: 'RSA', 
    type: 'percentage', 
    value: 100, 
    conditions: 'Bénéficiaire (ou ayant droit toléré) d\'un RSA - Certificat de moins de trois mois avec validité des droits en cours (droits dits "ouverts")', 
    active: true,
    onlineAvailable: false,
    appliedTo: ['adulte', 'jeunesse', 'enfant']
  },
  { 
    id: 'css', 
    name: 'CSS (ex-CMUC-C)', 
    type: 'percentage', 
    value: 75, 
    conditions: 'Bénéficiaire (ou ayant droit toléré) de la CSS sans participation financière - Certificat de moins de trois mois avec validité des droits en cours (droits dits "ouverts")', 
    active: true,
    onlineAvailable: false,
    appliedTo: ['adulte', 'jeunesse', 'enfant']
  },
  { 
    id: 'famille-nombreuse', 
    name: 'Famille Nombreuse', 
    type: 'fixed', 
    value: 5, 
    conditions: 'Carte famille nombreuse (3+ enfants)', 
    active: true,
    onlineAvailable: false,
    appliedTo: ['plein', 'enfant']
  }
];

let sales = [];
let groupReservations = [];

/**
 * GET /api/ticketing/stats - Statistiques globales
 */
export const getStats = async (req, res) => {
  try {
    const stats = {
      todayVisitors: 127,
      monthVisitors: 8458,
      monthRevenue: '€78,487',
      growth: '+23%',
      monthlyGoal: 10000,
      goalPercentage: 84.6
    };

    console.log('📊 Stats billetterie récupérées');
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
 * GET /api/ticketing/stats/weekly - Statistiques hebdomadaires
 */
export const getWeeklyStats = async (req, res) => {
  try {
    const weeklyData = [89, 102, 95, 118, 145, 312, 287];
    
    console.log('📅 Stats hebdomadaires récupérées');
    res.json(weeklyData);
  } catch (error) {
    console.error('❌ Erreur getWeeklyStats:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des stats hebdomadaires',
      details: error.message 
    });
  }
};

/**
 * GET /api/ticketing/stats/monthly - Statistiques mensuelles
 */
export const getMonthlyStats = async (req, res) => {
  try {
    const monthlyData = {
      currentMonth: 8458,
      previousMonth: 6890,
      goal: 10000,
      percentage: 84.6,
      growth: '+22.8%'
    };
    
    console.log('📆 Stats mensuelles récupérées');
    res.json(monthlyData);
  } catch (error) {
    console.error('❌ Erreur getMonthlyStats:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des stats mensuelles',
      details: error.message 
    });
  }
};

/**
 * GET /api/ticketing/types - Liste des types de tarifs
 */
export const getTicketTypes = async (req, res) => {
  try {
    console.log(`🎫 ${ticketTypes.length} types de tarifs récupérés`);
    res.json(ticketTypes);
  } catch (error) {
    console.error('❌ Erreur getTicketTypes:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des types de tarifs',
      details: error.message 
    });
  }
};

/**
 * POST /api/ticketing/types - Créer un type de tarif
 */
export const createTicketType = async (req, res) => {
  try {
    const { title, price, description, color, active } = req.body;
    
    const newType = {
      id: `type_${Date.now()}`,
      title,
      price: `${price}€`,
      description,
      color: color || 'gray.500',
      active: active !== false,
      sold: 0,
      revenue: '€0'
    };

    ticketTypes.push(newType);

    console.log('✅ Type de tarif créé:', newType.title);
    res.status(201).json(newType);
  } catch (error) {
    console.error('❌ Erreur createTicketType:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la création du type de tarif',
      details: error.message 
    });
  }
};

/**
 * PUT /api/ticketing/types/:id - Mettre à jour un type de tarif
 */
export const updateTicketType = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const index = ticketTypes.findIndex(t => t.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Type de tarif non trouvé' });
    }

    ticketTypes[index] = { ...ticketTypes[index], ...updates };

    console.log('✅ Type de tarif mis à jour:', id);
    res.json(ticketTypes[index]);
  } catch (error) {
    console.error('❌ Erreur updateTicketType:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la mise à jour du type de tarif',
      details: error.message 
    });
  }
};

/**
 * DELETE /api/ticketing/types/:id - Supprimer un type de tarif
 */
export const deleteTicketType = async (req, res) => {
  try {
    const { id } = req.params;

    const index = ticketTypes.findIndex(t => t.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Type de tarif non trouvé' });
    }

    ticketTypes.splice(index, 1);

    console.log('✅ Type de tarif supprimé:', id);
    res.json({ success: true, message: 'Type de tarif supprimé' });
  } catch (error) {
    console.error('❌ Erreur deleteTicketType:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la suppression du type de tarif',
      details: error.message 
    });
  }
};

/**
 * GET /api/ticketing/sales - Liste des ventes
 */
export const getSales = async (req, res) => {
  try {
    const { page = 1, limit = 20, startDate, endDate, ticketTypeId } = req.query;

    let filteredSales = [...sales];

    if (ticketTypeId) {
      filteredSales = filteredSales.filter(s => s.ticketTypeId === ticketTypeId);
    }

    if (startDate || endDate) {
      // Filtrage par date si nécessaire
    }

    const start = (page - 1) * limit;
    const paginatedSales = filteredSales.slice(start, start + parseInt(limit));

    console.log(`💰 ${paginatedSales.length} ventes récupérées`);
    res.json({
      data: paginatedSales,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredSales.length,
        pages: Math.ceil(filteredSales.length / limit)
      }
    });
  } catch (error) {
    console.error('❌ Erreur getSales:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des ventes',
      details: error.message 
    });
  }
};

/**
 * POST /api/ticketing/sales - Créer une vente
 */
export const createSale = async (req, res) => {
  try {
    const { ticketTypeId, quantity, paymentMethod, customerName } = req.body;

    const newSale = {
      id: `sale_${Date.now()}`,
      ticketTypeId,
      quantity,
      paymentMethod,
      customerName,
      date: new Date().toISOString(),
      createdAt: new Date()
    };

    sales.push(newSale);

    console.log('✅ Vente créée:', newSale.id);
    res.status(201).json(newSale);
  } catch (error) {
    console.error('❌ Erreur createSale:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la création de la vente',
      details: error.message 
    });
  }
};

/**
 * GET /api/ticketing/attendance - Statistiques de fréquentation
 */
export const getAttendance = async (req, res) => {
  try {
    const attendance = {
      today: 127,
      week: 845,
      month: 8458,
      year: 94567
    };

    console.log('📈 Fréquentation récupérée');
    res.json(attendance);
  } catch (error) {
    console.error('❌ Erreur getAttendance:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération de la fréquentation',
      details: error.message 
    });
  }
};

/**
 * GET /api/ticketing/group-reservations - Réservations de groupe
 */
export const getGroupReservations = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;

    let filteredReservations = [...groupReservations];

    if (status) {
      filteredReservations = filteredReservations.filter(r => r.status === status);
    }

    const start = (page - 1) * limit;
    const paginatedReservations = filteredReservations.slice(start, start + parseInt(limit));

    console.log(`👥 ${paginatedReservations.length} réservations de groupe récupérées`);
    res.json({
      data: paginatedReservations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredReservations.length,
        pages: Math.ceil(filteredReservations.length / limit)
      }
    });
  } catch (error) {
    console.error('❌ Erreur getGroupReservations:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des réservations',
      details: error.message 
    });
  }
};

/**
 * POST /api/ticketing/group-reservations - Créer une réservation de groupe
 */
export const createGroupReservation = async (req, res) => {
  try {
    const { groupName, contactName, email, phone, date, time, persons, notes } = req.body;

    const newReservation = {
      id: `reservation_${Date.now()}`,
      groupName,
      contactName,
      email,
      phone,
      date,
      time,
      persons,
      notes,
      status: 'pending',
      createdAt: new Date()
    };

    groupReservations.push(newReservation);

    console.log('✅ Réservation de groupe créée:', newReservation.id);
    res.status(201).json(newReservation);
  } catch (error) {
    console.error('❌ Erreur createGroupReservation:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la création de la réservation',
      details: error.message 
    });
  }
};

/**
 * PUT /api/ticketing/group-reservations/:id - Mettre à jour une réservation de groupe
 */
export const updateGroupReservation = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const index = groupReservations.findIndex(r => r.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Réservation non trouvée' });
    }

    groupReservations[index] = { ...groupReservations[index], ...updates };

    console.log('✅ Réservation mise à jour:', id);
    res.json(groupReservations[index]);
  } catch (error) {
    console.error('❌ Erreur updateGroupReservation:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la mise à jour de la réservation',
      details: error.message 
    });
  }
};

// ========== DISCOUNTS (Réductions) ==========

/**
 * GET /api/ticketing/discounts - Liste des réductions
 */
export const getDiscounts = async (req, res) => {
  try {
    console.log(`💰 ${discounts.length} réductions récupérées`);
    res.json(discounts);
  } catch (error) {
    console.error('❌ Erreur getDiscounts:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des réductions',
      details: error.message 
    });
  }
};

/**
 * GET /api/ticketing/discounts/:id - Détails d'une réduction
 */
export const getDiscount = async (req, res) => {
  try {
    const { id } = req.params;
    const discount = discounts.find(d => d.id === id);

    if (!discount) {
      return res.status(404).json({ error: 'Réduction non trouvée' });
    }

    console.log('💰 Réduction récupérée:', id);
    res.json(discount);
  } catch (error) {
    console.error('❌ Erreur getDiscount:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération de la réduction',
      details: error.message 
    });
  }
};

/**
 * POST /api/ticketing/discounts - Créer une réduction
 */
export const createDiscount = async (req, res) => {
  try {
    const newDiscount = {
      id: `discount_${Date.now()}`,
      ...req.body,
      createdAt: new Date()
    };

    discounts.push(newDiscount);

    console.log('✅ Réduction créée:', newDiscount.id);
    res.status(201).json(newDiscount);
  } catch (error) {
    console.error('❌ Erreur createDiscount:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la création de la réduction',
      details: error.message 
    });
  }
};

/**
 * PUT /api/ticketing/discounts/:id - Mettre à jour une réduction
 */
export const updateDiscount = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const index = discounts.findIndex(d => d.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Réduction non trouvée' });
    }

    discounts[index] = { ...discounts[index], ...updates };

    console.log('✅ Réduction mise à jour:', id);
    res.json(discounts[index]);
  } catch (error) {
    console.error('❌ Erreur updateDiscount:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la mise à jour de la réduction',
      details: error.message 
    });
  }
};

/**
 * DELETE /api/ticketing/discounts/:id - Supprimer une réduction
 */
export const deleteDiscount = async (req, res) => {
  try {
    const { id } = req.params;
    const index = discounts.findIndex(d => d.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Réduction non trouvée' });
    }

    discounts.splice(index, 1);

    console.log('✅ Réduction supprimée:', id);
    res.json({ success: true, message: 'Réduction supprimée' });
  } catch (error) {
    console.error('❌ Erreur deleteDiscount:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la suppression de la réduction',
      details: error.message 
    });
  }
};
