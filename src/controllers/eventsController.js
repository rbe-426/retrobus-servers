/**
 * Events Controller - Gestion des événements
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['error'],
});

/**
 * GET /api/events - Récupérer tous les événements
 */
export const getAllEvents = async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      orderBy: { date: 'desc' },
      include: {
        Vehicle: {
          select: {
            parc: true,
            marque: true,
            modele: true,
          }
        }
      }
    });

    console.log(`📅 ${events.length} événements récupérés`);
    res.json(events);
  } catch (error) {
    console.error('❌ Erreur getAllEvents:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des événements',
      details: error.message 
    });
  }
};

/**
 * GET /api/events/:id - Récupérer un événement par ID
 */
export const getEventById = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        Vehicle: true,
        EventRegistration: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!event) {
      return res.status(404).json({ error: 'Événement non trouvé' });
    }

    res.json(event);
  } catch (error) {
    console.error('❌ Erreur getEventById:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération de l\'événement',
      details: error.message 
    });
  }
};

/**
 * POST /api/events - Créer un nouvel événement
 */
export const createEvent = async (req, res) => {
  try {
    const eventData = req.body;

    // Générer un ID unique
    const id = `event_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const event = await prisma.event.create({
      data: {
        id,
        title: eventData.title,
        date: new Date(eventData.date),
        time: eventData.time,
        location: eventData.location,
        description: eventData.description,
        helloAssoUrl: eventData.helloAssoUrl,
        adultPrice: eventData.adultPrice,
        childPrice: eventData.childPrice,
        vehicleId: eventData.vehicleId,
        status: eventData.status || 'DRAFT',
        layout: eventData.layout,
        extras: typeof eventData.extras === 'object' 
          ? JSON.stringify(eventData.extras) 
          : eventData.extras,
        maxParticipants: eventData.maxParticipants,
        currentParticipants: 0,
        updatedAt: new Date()
      }
    });

    console.log(`✅ Événement créé: ${event.id}`);
    res.status(201).json(event);
  } catch (error) {
    console.error('❌ Erreur createEvent:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la création de l\'événement',
      details: error.message 
    });
  }
};

/**
 * PUT /api/events/:id - Mettre à jour un événement
 */
export const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Préparer les données de mise à jour
    const data = {
      updatedAt: new Date()
    };

    if (updateData.title !== undefined) data.title = updateData.title;
    if (updateData.date !== undefined) data.date = new Date(updateData.date);
    if (updateData.time !== undefined) data.time = updateData.time;
    if (updateData.location !== undefined) data.location = updateData.location;
    if (updateData.description !== undefined) data.description = updateData.description;
    if (updateData.helloAssoUrl !== undefined) data.helloAssoUrl = updateData.helloAssoUrl;
    if (updateData.adultPrice !== undefined) data.adultPrice = updateData.adultPrice;
    if (updateData.childPrice !== undefined) data.childPrice = updateData.childPrice;
    if (updateData.vehicleId !== undefined) data.vehicleId = updateData.vehicleId;
    if (updateData.status !== undefined) data.status = updateData.status;
    if (updateData.layout !== undefined) data.layout = updateData.layout;
    if (updateData.maxParticipants !== undefined) data.maxParticipants = updateData.maxParticipants;
    if (updateData.currentParticipants !== undefined) data.currentParticipants = updateData.currentParticipants;
    
    if (updateData.extras !== undefined) {
      data.extras = typeof updateData.extras === 'object' 
        ? JSON.stringify(updateData.extras) 
        : updateData.extras;
    }

    const event = await prisma.event.update({
      where: { id },
      data
    });

    console.log(`✅ Événement mis à jour: ${event.id}`);
    res.json(event);
  } catch (error) {
    console.error('❌ Erreur updateEvent:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Événement non trouvé' });
    }
    
    res.status(500).json({ 
      error: 'Erreur lors de la mise à jour de l\'événement',
      details: error.message 
    });
  }
};

/**
 * DELETE /api/events/:id - Supprimer un événement
 */
export const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.event.delete({
      where: { id }
    });

    console.log(`✅ Événement supprimé: ${id}`);
    res.json({ success: true, message: 'Événement supprimé' });
  } catch (error) {
    console.error('❌ Erreur deleteEvent:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Événement non trouvé' });
    }
    
    res.status(500).json({ 
      error: 'Erreur lors de la suppression de l\'événement',
      details: error.message 
    });
  }
};

/**
 * GET /api/events/:id/participants - Récupérer les participants d'un événement
 */
export const getEventParticipants = async (req, res) => {
  try {
    const { id } = req.params;

    const participants = await prisma.registration.findMany({
      where: { eventId: id },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`👥 ${participants.length} participants pour l'événement ${id}`);
    res.json(participants);
  } catch (error) {
    console.error('❌ Erreur getEventParticipants:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des participants',
      details: error.message 
    });
  }
};

/**
 * POST /api/events/:id/participants - Ajouter un participant à un événement
 */
export const addEventParticipant = async (req, res) => {
  try {
    const { id: eventId } = req.params;
    const participantData = req.body;

    const participant = await prisma.registration.create({
      data: {
        eventId,
        participantName: participantData.participantName || participantData.name,
        participantEmail: participantData.participantEmail || participantData.email,
        adultTickets: participantData.adultTickets || 1,
        childTickets: participantData.childTickets || 0,
        registrationStatus: participantData.registrationStatus || participantData.status || 'pending',
        paymentMethod: participantData.paymentMethod || 'internal',
        validationCode: participantData.validationCode,
        vehicleName: participantData.vehicleName,
        vehicleModel: participantData.vehicleModel,
        vehicleYear: participantData.vehicleYear,
        isClubMember: participantData.isClubMember || false,
        clubName: participantData.clubName,
        notes: participantData.notes
      }
    });

    // Incrémenter le compteur de participants
    await prisma.event.update({
      where: { id: eventId },
      data: {
        currentParticipants: {
          increment: (participantData.adultTickets || 1) + (participantData.childTickets || 0)
        }
      }
    });

    console.log(`✅ Participant ajouté: ${participant.id}`);
    res.status(201).json(participant);
  } catch (error) {
    console.error('❌ Erreur addEventParticipant:', error);
    res.status(500).json({ 
      error: 'Erreur lors de l\'ajout du participant',
      details: error.message 
    });
  }
};

/**
 * PUT /api/events/:id/participants/:participantId - Mettre à jour un participant
 */
export const updateEventParticipant = async (req, res) => {
  try {
    const { participantId } = req.params;
    const updateData = req.body;

    const data = {};

    if (updateData.participantName !== undefined) data.participantName = updateData.participantName;
    if (updateData.participantEmail !== undefined) data.participantEmail = updateData.participantEmail;
    if (updateData.adultTickets !== undefined) data.adultTickets = updateData.adultTickets;
    if (updateData.childTickets !== undefined) data.childTickets = updateData.childTickets;
    if (updateData.registrationStatus !== undefined) data.registrationStatus = updateData.registrationStatus;
    if (updateData.status !== undefined) data.registrationStatus = updateData.status;
    if (updateData.paymentMethod !== undefined) data.paymentMethod = updateData.paymentMethod;
    if (updateData.validationCode !== undefined) data.validationCode = updateData.validationCode;
    if (updateData.vehicleName !== undefined) data.vehicleName = updateData.vehicleName;
    if (updateData.vehicleModel !== undefined) data.vehicleModel = updateData.vehicleModel;
    if (updateData.vehicleYear !== undefined) data.vehicleYear = updateData.vehicleYear;
    if (updateData.isClubMember !== undefined) data.isClubMember = updateData.isClubMember;
    if (updateData.clubName !== undefined) data.clubName = updateData.clubName;
    if (updateData.notes !== undefined) data.notes = updateData.notes;

    const participant = await prisma.registration.update({
      where: { id: participantId },
      data
    });

    console.log(`✅ Participant mis à jour: ${participant.id}`);
    res.json(participant);
  } catch (error) {
    console.error('❌ Erreur updateEventParticipant:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Participant non trouvé' });
    }
    
    res.status(500).json({ 
      error: 'Erreur lors de la mise à jour du participant',
      details: error.message 
    });
  }
};

/**
 * DELETE /api/events/:id/participants/:participantId - Supprimer un participant
 */
export const deleteEventParticipant = async (req, res) => {
  try {
    const { id: eventId, participantId } = req.params;

    // Récupérer le participant pour savoir combien de tickets il avait
    const participant = await prisma.registration.findUnique({
      where: { id: participantId }
    });

    if (participant) {
      // Décrémenter le compteur de participants
      await prisma.event.update({
        where: { id: eventId },
        data: {
          currentParticipants: {
            decrement: participant.adultTickets + participant.childTickets
          }
        }
      });
    }

    await prisma.registration.delete({
      where: { id: participantId }
    });

    console.log(`✅ Participant supprimé: ${participantId}`);
    res.json({ success: true, message: 'Participant supprimé' });
  } catch (error) {
    console.error('❌ Erreur deleteEventParticipant:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Participant non trouvé' });
    }
    
    res.status(500).json({ 
      error: 'Erreur lors de la suppression du participant',
      details: error.message 
    });
  }
};
