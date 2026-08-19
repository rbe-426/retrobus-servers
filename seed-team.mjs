/**
 * Script de migration des données d'équipe
 * Initialise la table TeamMember avec les données par défaut
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_TEAM_MEMBERS = [
  {
    id: 'team_1',
    name: 'Waiyl Belaidi',
    role: "Président de l'association",
    roleColor: 'red',
    hierarchy: 1,
    hierarchy2: 1, // Membre du Bureau
    joinDate: 'Mars 2025',
    memberType: 'Membre fondateur',
    catchphrase: "RBE c'est surtout une famille de mordus d'automobile",
    image: 'https://via.placeholder.com/150?text=WB',
    email: 'w.belaidi@retrobus-essonne.fr',
    phone: '+33 6 XX XX XX XX',
    expertise: [
      { label: 'SAEIV', color: 'blue' },
      { label: 'Medias', color: 'blue' },
      { label: 'Technique', color: 'blue' },
    ],
    order: 0
  },
  {
    id: 'team_2',
    name: 'Methusan Ravichandran',
    role: 'Vice-Président',
    roleColor: 'orange',
    hierarchy: 1,
    hierarchy2: 1, // Membre du Bureau
    joinDate: 'Mars 2025',
    memberType: 'Membre fondateur',
    catchphrase: "RBE c'est surtout une famille de mordus d'automobile",
    image: 'https://via.placeholder.com/150?text=MR',
    email: 'm.ravichandran@retrobus-essonne.fr',
    phone: '+33 6 XX XX XX XX',
    expertise: [
      { label: 'Medias', color: 'purple' },
      { label: 'Formations', color: 'purple' },
    ],
    order: 1
  },
  {
    id: 'team_3',
    name: 'Jaffer Camaroudine',
    role: "Conseil d'Administration",
    roleColor: 'blue',
    hierarchy: 2,
    hierarchy2: 1, // Membre du Bureau
    joinDate: 'Mars 2025',
    memberType: 'Membre fondateur',
    catchphrase: "Préserver les véhicules que je voyais rouler quand j'étais enfant",
    image: '/assets/team/jaffer-camaroudine.jpg',
    email: 'j.camaroudine@retrobus-essonne.fr',
    phone: '+33 6 XX XX XX XX',
    expertise: [
      { label: 'Conduite', color: 'cyan' },
      { label: 'Formations', color: 'cyan' },
      { label: 'Itineraires', color: 'cyan' },
    ],
    order: 0
  },
  {
    id: 'team_4',
    name: 'Nour Bayoudh',
    role: 'Responsable Administration',
    roleColor: 'green',
    hierarchy: 3,
    hierarchy2: 1, // Membre du Bureau
    joinDate: '2026',
    memberType: 'Membre',
    catchphrase: 'Une bonne organisation est la clé de nos succès',
    image: 'https://via.placeholder.com/150?text=NB',
    email: 'n.bayoudh@retrobus-essonne.fr',
    phone: '+33 6 XX XX XX XX',
    expertise: [
      { label: 'Admin', color: 'teal' },
      { label: 'Organisation', color: 'teal' },
      { label: 'Gestion', color: 'teal' },
    ],
    order: 0
  },
  {
    id: 'team_5',
    name: 'Jarina Amolotpavanathan',
    role: 'Service Juridique',
    roleColor: 'purple',
    hierarchy: 3,
    hierarchy2: 2, // Adhérent simple
    joinDate: '2026',
    memberType: 'Membre',
    catchphrase: "Encadrer juridiquement nos actions pour protéger l'association",
    image: 'https://via.placeholder.com/150?text=JA',
    email: 'j.amolotpavanathan@retrobus-essonne.fr',
    phone: '+33 6 XX XX XX XX',
    expertise: [
      { label: 'Droit', color: 'pink' },
      { label: 'Conformité', color: 'pink' },
      { label: 'Contrats', color: 'pink' },
    ],
    order: 1
  },
];

async function seedTeam() {
  console.log('🌱 Seed: Initialisation de l\'équipe...');

  try {
    // Vérifier si des membres existent déjà
    const existingCount = await prisma.teamMember.count();

    if (existingCount > 0) {
      console.log(`✅ ${existingCount} membres déjà présents. Seed ignoré.`);
      return;
    }

    // Créer les membres
    for (const member of DEFAULT_TEAM_MEMBERS) {
      await prisma.teamMember.create({
        data: member
      });
      console.log(`✅ Créé: ${member.name}`);
    }

    console.log(`🎉 Seed terminé ! ${DEFAULT_TEAM_MEMBERS.length} membres créés.`);
  } catch (error) {
    console.error('❌ Erreur lors du seed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedTeam();
