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
    const email = 'belaidiw91@gmail.com';
    const newPassword = 'Waiyl9134#';

    const user = await prisma.members.findFirst({
      where: { email }
    });

    if (!user) {
      console.log(`❌ User with email ${email} not found`);
      return;
    }

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
    console.log(`   Email: ${email}`);
    console.log(`   Nouveau mot de passe: ${newPassword}`);
    console.log(`   Prêt à utiliser immédiatement!`);
  } catch (e) {
    console.error('❌ Erreur:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

setPassword();
