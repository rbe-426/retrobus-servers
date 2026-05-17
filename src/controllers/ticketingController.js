/**
 * Ticketing Controller - Gestion de la billetterie du musée
 */

// Données mock pour le développement (à remplacer par Prisma plus tard)
let ticketTypes = [
  { id: 'plein', name: 'Adulte', label: 'Adulte', price: 25, description: 'Adulte sans réduction', active: true, sold: 3842, revenue: 96050 },
  { id: 'reduit', name: 'Jeunesse / Étudiant', label: 'Jeunesse / Étudiant', price: 15, description: 'Étudiants, demandeurs d\'emploi de moins de 26 ans (14-26)', active: true, sold: 2156, revenue: 32340 },
  { id: 'enfant', name: 'Enfant -14 ans', label: 'Enfant -14 ans', price: 5, description: 'Enfants de 0 à 13 ans', active: true, sold: 1842, revenue: 9210 },
  { id: 'groupe', name: 'Tarif Groupe', label: 'Tarif Groupe', price: 10, description: 'À partir de 10 personnes', active: false, sold: 1518, revenue: 15180 },
  { id: 'famille', name: 'Pass Famille', label: 'Pass Famille', price: 28, description: '2 adultes + 2 enfants', active: false, sold: 445, revenue: 12460 },
  { id: 'annuel', name: 'Abonnement Annuel', label: 'Abonnement Annuel', price: 80, description: 'Accès illimité pendant 1 an', active: false, sold: 127, revenue: 10160 }
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

// Codes promotionnels généraux
let promoCodes = [
  {
    id: 'SUMMER2026',
    code: 'SUMMER2026',
    name: 'Promo été 2026',
    type: 'percentage',
    value: 20,
    description: 'Réduction été 2026',
    active: true,
    validFrom: '2026-06-01',
    validUntil: '2026-08-31',
    maxUses: 1000,
    usedCount: 127,
    conditions: 'Valable du 1er juin au 31 août 2026',
    createdAt: new Date().toISOString(),
    createdBy: 'admin'
  }
];

// Codes internes (gestes commerciaux)
let internalCodes = [
  {
    id: 'MRBE26',
    code: 'MRBE26',
    name: 'Code Président 2026',
    type: 'percentage',
    value: 100,
    description: 'Geste commercial président',
    active: true,
    validFrom: '2026-01-01',
    validUntil: '2026-12-31',
    maxUses: 50,
    usedCount: 3,
    restrictedTo: ['Waiyl BELAIDI'], // Seul le président peut l'utiliser
    conditions: 'Usage réservé au président Waiyl BELAIDI',
    createdAt: new Date().toISOString(),
    createdBy: 'Waiyl BELAIDI',
    isInternal: true
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

// ============================================
// CODES PROMOTIONNELS
// ============================================

/**
 * POST /api/ticketing/promo-codes/validate - Valider un code promo ou interne
 */
export const validatePromoCode = async (req, res) => {
  try {
    const { code, userName } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Code requis' });
    }

    const codeUpper = code.toUpperCase();

    // Chercher dans les codes promo généraux
    let promoCode = promoCodes.find(p => p.code === codeUpper && p.active);

    // Si pas trouvé, chercher dans les codes internes
    let isInternal = false;
    if (!promoCode) {
      promoCode = internalCodes.find(c => c.code === codeUpper && c.active);
      isInternal = true;
    }

    // Code non trouvé
    if (!promoCode) {
      console.log('❌ Code invalide:', codeUpper);
      return res.status(404).json({ 
        error: 'Code invalide ou expiré',
        valid: false 
      });
    }

    // Vérifier si le code interne est restreint à certains utilisateurs
    if (isInternal && promoCode.restrictedTo && promoCode.restrictedTo.length > 0) {
      if (!userName) {
        console.log('❌ Code interne: userName manquant');
        return res.status(403).json({ 
          error: 'Code réservé à usage interne',
          valid: false,
          message: 'Ce code est réservé à des utilisateurs spécifiques'
        });
      }
      
      // Vérification insensible à la casse
      const userNameLower = userName.toLowerCase().trim();
      const isAuthorized = promoCode.restrictedTo.some(authorizedUser => 
        authorizedUser.toLowerCase().trim() === userNameLower
      );
      
      if (!isAuthorized) {
        console.log('❌ Code interne non autorisé pour:', userName);
        console.log('   Utilisateurs autorisés:', promoCode.restrictedTo);
        return res.status(403).json({ 
          error: 'Code réservé à usage interne',
          valid: false,
          message: 'Ce code est réservé à des utilisateurs spécifiques'
        });
      }
      
      console.log('✅ Code interne autorisé pour:', userName);
    }

    // Vérifier les dates de validité
    const now = new Date();
    const validFrom = new Date(promoCode.validFrom);
    const validUntil = new Date(promoCode.validUntil);

    if (now < validFrom || now > validUntil) {
      console.log('❌ Code expiré:', codeUpper);
      return res.status(400).json({ 
        error: 'Code expiré',
        valid: false,
        validFrom: promoCode.validFrom,
        validUntil: promoCode.validUntil
      });
    }

    // Vérifier le nombre d'utilisations
    if (promoCode.maxUses && promoCode.usedCount >= promoCode.maxUses) {
      console.log('❌ Code épuisé:', codeUpper);
      return res.status(400).json({ 
        error: 'Code épuisé',
        valid: false,
        message: 'Ce code a atteint sa limite d\'utilisation'
      });
    }

    console.log('✅ Code valide:', codeUpper, isInternal ? '(interne)' : '(promo)');
    res.json({
      valid: true,
      code: promoCode,
      isInternal: isInternal,
      reduction: {
        type: promoCode.type,
        value: promoCode.value,
        name: promoCode.name,
        description: promoCode.description
      }
    });
  } catch (error) {
    console.error('❌ Erreur validatePromoCode:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la validation du code',
      details: error.message 
    });
  }
};

/**
 * GET /api/ticketing/promo-codes - Liste des codes promo
 */
export const getPromoCodes = async (req, res) => {
  try {
    console.log('📋 Codes promo récupérés:', promoCodes.length);
    res.json(promoCodes);
  } catch (error) {
    console.error('❌ Erreur getPromoCodes:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des codes promo',
      details: error.message 
    });
  }
};

/**
 * GET /api/ticketing/internal-codes - Liste des codes internes
 */
export const getInternalCodes = async (req, res) => {
  try {
    console.log('📋 Codes internes récupérés:', internalCodes.length);
    res.json(internalCodes);
  } catch (error) {
    console.error('❌ Erreur getInternalCodes:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des codes internes',
      details: error.message 
    });
  }
};

/**
 * POST /api/ticketing/promo-codes - Créer un code promo
 */
export const createPromoCode = async (req, res) => {
  try {
    const codeData = req.body;
    
    // Vérifier si le code existe déjà
    const exists = promoCodes.some(p => p.code === codeData.code.toUpperCase()) ||
                   internalCodes.some(c => c.code === codeData.code.toUpperCase());
    
    if (exists) {
      return res.status(400).json({ error: 'Ce code existe déjà' });
    }

    const newCode = {
      id: codeData.code.toUpperCase(),
      code: codeData.code.toUpperCase(),
      name: codeData.name,
      type: codeData.type || 'percentage',
      value: codeData.value,
      description: codeData.description || '',
      active: codeData.active !== undefined ? codeData.active : true,
      validFrom: codeData.validFrom,
      validUntil: codeData.validUntil,
      maxUses: codeData.maxUses || null,
      usedCount: 0,
      conditions: codeData.conditions || '',
      createdAt: new Date().toISOString(),
      createdBy: codeData.createdBy || 'admin'
    };

    promoCodes.push(newCode);

    console.log('✅ Code promo créé:', newCode.code);
    res.status(201).json(newCode);
  } catch (error) {
    console.error('❌ Erreur createPromoCode:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la création du code promo',
      details: error.message 
    });
  }
};

/**
 * POST /api/ticketing/internal-codes - Créer un code interne
 */
export const createInternalCode = async (req, res) => {
  try {
    const codeData = req.body;
    
    // Vérifier si le code existe déjà
    const exists = promoCodes.some(p => p.code === codeData.code.toUpperCase()) ||
                   internalCodes.some(c => c.code === codeData.code.toUpperCase());
    
    if (exists) {
      return res.status(400).json({ error: 'Ce code existe déjà' });
    }

    const newCode = {
      id: codeData.code.toUpperCase(),
      code: codeData.code.toUpperCase(),
      name: codeData.name,
      type: codeData.type || 'percentage',
      value: codeData.value,
      description: codeData.description || '',
      active: codeData.active !== undefined ? codeData.active : true,
      validFrom: codeData.validFrom,
      validUntil: codeData.validUntil,
      maxUses: codeData.maxUses || null,
      usedCount: 0,
      restrictedTo: codeData.restrictedTo || [],
      conditions: codeData.conditions || '',
      createdAt: new Date().toISOString(),
      createdBy: codeData.createdBy || 'admin',
      isInternal: true
    };

    internalCodes.push(newCode);

    console.log('✅ Code interne créé:', newCode.code);
    res.status(201).json(newCode);
  } catch (error) {
    console.error('❌ Erreur createInternalCode:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la création du code interne',
      details: error.message 
    });
  }
};

/**
 * PUT /api/ticketing/promo-codes/:id - Mettre à jour un code promo
 */
export const updatePromoCode = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const index = promoCodes.findIndex(p => p.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Code promo non trouvé' });
    }

    promoCodes[index] = {
      ...promoCodes[index],
      ...updates,
      id: promoCodes[index].id,
      code: promoCodes[index].code,
      updatedAt: new Date().toISOString()
    };

    console.log('✅ Code promo mis à jour:', id);
    res.json(promoCodes[index]);
  } catch (error) {
    console.error('❌ Erreur updatePromoCode:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la mise à jour du code promo',
      details: error.message 
    });
  }
};

/**
 * PUT /api/ticketing/internal-codes/:id - Mettre à jour un code interne
 */
export const updateInternalCode = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const index = internalCodes.findIndex(c => c.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Code interne non trouvé' });
    }

    internalCodes[index] = {
      ...internalCodes[index],
      ...updates,
      id: internalCodes[index].id,
      code: internalCodes[index].code,
      isInternal: true,
      updatedAt: new Date().toISOString()
    };

    console.log('✅ Code interne mis à jour:', id);
    res.json(internalCodes[index]);
  } catch (error) {
    console.error('❌ Erreur updateInternalCode:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la mise à jour du code interne',
      details: error.message 
    });
  }
};

/**
 * DELETE /api/ticketing/promo-codes/:id - Supprimer un code promo
 */
export const deletePromoCode = async (req, res) => {
  try {
    const { id } = req.params;
    const index = promoCodes.findIndex(p => p.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Code promo non trouvé' });
    }

    promoCodes.splice(index, 1);

    console.log('✅ Code promo supprimé:', id);
    res.json({ success: true, message: 'Code promo supprimé' });
  } catch (error) {
    console.error('❌ Erreur deletePromoCode:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la suppression du code promo',
      details: error.message 
    });
  }
};

/**
 * DELETE /api/ticketing/internal-codes/:id - Supprimer un code interne
 */
export const deleteInternalCode = async (req, res) => {
  try {
    const { id } = req.params;
    const index = internalCodes.findIndex(c => c.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Code interne non trouvé' });
    }

    internalCodes.splice(index, 1);

    console.log('✅ Code interne supprimé:', id);
    res.json({ success: true, message: 'Code interne supprimé' });
  } catch (error) {
    console.error('❌ Erreur deleteInternalCode:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la suppression du code interne',
      details: error.message 
    });
  }
};
