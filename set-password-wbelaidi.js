import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

function hashPasswordForStorage(password) {
  const salt = crypto.randomBytes(16).toString('base64');
  const iterations = 10000;
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('base64');
  return `${salt}:${hash}:${iterations}`;
}

async function setPassword() {
  try {
    // Find w.belaidi
    const user = await prisma.members.findFirst({
      where: { email: 'w.belaidi@retrobus.fr' }
    });

    if (!user) {
      console.log('❌ User w.belaidi not found');
      return;
    }

    const newPassword = 'Waiyl9134#';
    const hashedPassword = hashPasswordForStorage(newPassword);

    await prisma.members.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        isPasswordTemporary: false,
        mustChangePassword: false
      }
    });

    console.log('✅ Mot de passe mis à jour pour w.belaidi:');
    console.log(`   Email: w.belaidi@retrobus.fr`);
    console.log(`   Nouveau mot de passe: ${newPassword}`);
    console.log(`   Vous pouvez maintenant vous connecter!`);
  } catch (e) {
    console.error('❌ Erreur:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

setPassword();
