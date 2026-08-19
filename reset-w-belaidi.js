import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

function generateTemporaryPassword() {
  return crypto.randomBytes(8).toString('hex').toUpperCase().slice(0, 8);
}

function hashPasswordForStorage(password) {
  const salt = crypto.randomBytes(16).toString('base64');
  const iterations = 10000;
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('base64');
  return `${salt}:${hash}:${iterations}`;
}

async function resetPassword() {
  try {
    // Find w.belaidi in members
    const user = await prisma.members.findFirst({
      where: { 
        OR: [
          { email: { contains: 'belaidi', mode: 'insensitive' } },
          { matricule: 'w.belaidi' }
        ]
      }
    });

    if (!user) {
      console.log('❌ User w.belaidi not found in members');
      
      // Try site_users
      const siteUser = await prisma.site_users.findFirst({
        where: { 
          OR: [
            { email: { contains: 'belaidi', mode: 'insensitive' } },
            { username: 'w.belaidi' }
          ]
        }
      });
      
      if (!siteUser) {
        console.log('❌ User w.belaidi not found in site_users either');
        return;
      }

      const tempPassword = generateTemporaryPassword();
      const hashedPassword = hashPasswordForStorage(tempPassword);

      await prisma.site_users.update({
        where: { id: siteUser.id },
        data: {
          password: hashedPassword,
          mustChangePassword: true
        }
      });

      console.log('✅ Mot de passe temporaire généré pour w.belaidi (site_users):');
      console.log(`   Username: ${siteUser.username}`);
      console.log(`   Email: ${siteUser.email}`);
      console.log(`   Mot de passe temporaire: ${tempPassword}`);
      console.log(`   À partager avec sécurité!`);
      return;
    }

    const tempPassword = generateTemporaryPassword();
    const hashedPassword = hashPasswordForStorage(tempPassword);

    await prisma.members.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        isPasswordTemporary: true,
        mustChangePassword: true
      }
    });

    console.log('✅ Mot de passe temporaire généré pour w.belaidi (members):');
    console.log(`   Matricule: ${user.matricule}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Mot de passe temporaire: ${tempPassword}`);
    console.log(`   À partager avec sécurité!`);
  } catch (e) {
    console.error('❌ Erreur:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

resetPassword();
