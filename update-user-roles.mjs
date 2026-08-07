import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Mise à jour des rôles et badges...\n');

  try {
    // 1. Mettre à jour Méthusan en Vice Président
    console.log('📝 Mise à jour: Méthusan RAVICHANDRAN → Vice Président');
    const methusan = await prisma.site_users.update({
      where: { username: 'm.ravichandran' },
      data: { role: 'Vice Président' }
    });
    console.log(`   ✅ Role mis à jour: ${methusan.role}\n`);

    // 2. Ajouter le badge "membre du bureau" pour Jaffer et Méthusan
    console.log('🎖️  Ajout du badge "Membre du Bureau"');
    
    const jaffer = await prisma.site_users.update({
      where: { username: 'jsalim.camaroudine' },
      data: { customPermissions: 'membre-du-bureau' }
    });
    console.log(`   ✅ ${jaffer.firstName} ${jaffer.lastName} - Badge ajouté`);

    const methusan2 = await prisma.site_users.update({
      where: { username: 'm.ravichandran' },
      data: { customPermissions: 'membre-du-bureau' }
    });
    console.log(`   ✅ ${methusan2.firstName} ${methusan2.lastName} - Badge ajouté\n`);

    // 3. Afficher le résumé
    console.log('='.repeat(80));
    console.log('📋 CONFIGURATION MISE À JOUR');
    console.log('='.repeat(80) + '\n');

    const users = await prisma.site_users.findMany({
      where: {
        username: {
          in: ['jsalim.camaroudine', 'm.ravichandran']
        }
      }
    });

    users.forEach(user => {
      console.log(`👤 ${user.firstName} ${user.lastName}`);
      console.log(`   ID: ${user.username}`);
      console.log(`   Rôle: ${user.role}`);
      console.log(`   Badge: ${user.customPermissions ? '🎖️  ' + user.customPermissions : '❌ Aucun'}\n`);
    });

    console.log('✅ Mise à jour complète!');

  } catch (e) {
    console.error('❌ Erreur:', e.message);
    process.exit(1);
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
