import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Générer un mot de passe sécurisé
function generatePassword() {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

async function main() {
  console.log('👤 Création des 3 nouveaux utilisateurs...\n');

  const users = [
    {
      username: 'jsalim.camaroudine',
      firstName: 'Jaffer-Salim',
      lastName: 'CAMAROUDINE',
      email: 'jsalim.camaroudine@retrobus-essonne.fr',
      role: 'Référent parc et maintenance véhicules'
    },
    {
      username: 'm.ravichandran',
      firstName: 'Méthusan',
      lastName: 'RAVICHANDRAN',
      email: 'm.ravichandran@retrobus-essonne.fr',
      role: 'Référent parc et maintenance véhicules'
    },
    {
      username: 'j.amolot',
      firstName: 'Jarina',
      lastName: 'AMOLOTPAVANATHAN',
      email: 'j.amolot@retrobus-essonne.fr',
      role: 'Référent parc et maintenance véhicules'
    }
  ];

  const createdUsers = [];

  for (const user of users) {
    const password = generatePassword();
    const userId = crypto.randomUUID();
    
    try {
      console.log(`➕ Création utilisateur: ${user.username}`);
      
      const siteUser = await prisma.site_users.create({
        data: {
          id: userId,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          password: password,
          role: user.role,
          hasInternalAccess: true,
          hasExternalAccess: false,
          isActive: true,
          mustChangePassword: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      createdUsers.push({
        username: user.username,
        email: user.email,
        password: password,
        role: user.role
      });

      console.log(`   ✅ ID: ${siteUser.id}`);
      console.log(`   📧 Email: ${user.email}`);
      console.log(`   🔐 Mot de passe: ${password}`);
      console.log(`   👥 Rôle: ${user.role}`);
      console.log(`   🔓 Accès interne: OUI\n`);

    } catch (e) {
      console.error(`   ❌ Erreur: ${e.message}\n`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📋 RÉCAPITULATIF DES NOUVEAUX UTILISATEURS');
  console.log('='.repeat(80) + '\n');

  createdUsers.forEach(user => {
    console.log(`👤 ${user.username}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Mot de passe: ${user.password}`);
    console.log(`   Rôle: ${user.role}`);
    console.log('');
  });

  console.log('💾 À noter dans un endroit sûr!');
  console.log('✅ Les utilisateurs peuvent se connecter sur retrobus-interne.fr\n');
}

main()
  .catch(e => {
    console.error('❌ Erreur:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
