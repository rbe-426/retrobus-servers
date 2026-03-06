import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('👥 Création des profils adhérents...\n');

  const users = [
    {
      firstName: 'Jaffer-Salim',
      lastName: 'CAMAROUDINE',
      email: 'jsalim.camaroudine@retrobus-essonne.fr',
      username: 'jsalim.camaroudine',
      matricule: 'CAMAROUDINE-JS'
    },
    {
      firstName: 'Méthusan',
      lastName: 'RAVICHANDRAN',
      email: 'm.ravichandran@retrobus-essonne.fr',
      username: 'm.ravichandran',
      matricule: 'RAVICHANDRAN-M'
    },
    {
      firstName: 'Jarina',
      lastName: 'AMOLOTPAVANATHAN',
      email: 'j.amolot@retrobus-essonne.fr',
      username: 'j.amolot',
      matricule: 'AMOLOT-J'
    }
  ];

  for (const user of users) {
    try {
      console.log(`➕ Création adhérent: ${user.firstName} ${user.lastName}`);

      // 1. Créer le profil member
      const member = await prisma.members.create({
        data: {
          id: crypto.randomUUID(),
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          matricule: user.matricule,
          membershipType: 'STANDARD',
          membershipStatus: 'ACTIVE',
          membershipStartDate: new Date(),
          hasLinkedAccess: true,
          newsletter: true,
          role: 'MEMBER',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      console.log(`   ✅ Profil member créé: ${member.id}`);

      // 2. Trouver et mettre à jour le site_user associé
      const siteUser = await prisma.site_users.findUnique({
        where: { username: user.username }
      });

      if (siteUser) {
        const updated = await prisma.site_users.update({
          where: { id: siteUser.id },
          data: { linkedMemberId: member.id }
        });
        console.log(`   ✅ Site user lié au member`);
        console.log(`   📧 Email: ${member.email}`);
        console.log(`   🔢 Matricule: ${member.matricule}`);
        console.log(`   👤 Membership: ${member.membershipStatus}\n`);
      } else {
        console.log(`   ⚠️  Site user ${user.username} non trouvé\n`);
      }

    } catch (e) {
      console.error(`   ❌ Erreur: ${e.message}\n`);
    }
  }

  // Afficher le résumé
  console.log('='.repeat(80));
  console.log('📋 RÉCAPITULATIF DES PROFILS CRÉÉS');
  console.log('='.repeat(80) + '\n');

  const members = await prisma.members.findMany({
    where: {
      email: {
        in: [
          'jsalim.camaroudine@retrobus-essonne.fr',
          'm.ravichandran@retrobus-essonne.fr',
          'j.amolot@retrobus-essonne.fr'
        ]
      }
    }
  });

  members.forEach(member => {
    console.log(`👤 ${member.firstName} ${member.lastName}`);
    console.log(`   Email: ${member.email}`);
    console.log(`   Matricule: ${member.matricule}`);
    console.log(`   Statut: ${member.membershipStatus}`);
    console.log(`   Date d'inscription: ${member.membershipStartDate?.toLocaleDateString('fr-FR')}`);
    console.log(`   Newsletter: ${member.newsletter ? '✅ Abonné' : '❌ Non abonné'}`);
    console.log(`   Accès lié: ${member.hasLinkedAccess ? '✅ Oui' : '❌ Non'}\n`);
  });

  console.log('✅ Profils adhérents créés et liés aux comptes utilisateurs!\n');
}

main()
  .catch(e => {
    console.error('❌ Erreur:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
