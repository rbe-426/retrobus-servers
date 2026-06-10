import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { generateTemporaryPassword, hashPasswordForStorage } from './src/lib/passwordUtils.js';

const prisma = new PrismaClient();

async function main() {
  console.log('👤 Création du compte Gaëlle Champenois...\n');

  try {
    // Vérifier si l'adhérente existe déjà
    const existingMember = await prisma.members.findFirst({
      where: {
        OR: [
          { matricule: 'g.champenois' },
          { email: 'g.champenois@retrobus-essonne.fr' }
        ]
      }
    });

    if (existingMember) {
      console.log('⚠️  Un compte existe déjà pour g.champenois');
      console.log(`   ID: ${existingMember.id}`);
      console.log(`   Email: ${existingMember.email}`);
      console.log(`   Matricule: ${existingMember.matricule}`);
      
      // Générer un nouveau mot de passe temporaire
      const newTempPassword = generateTemporaryPassword();
      const hashedPassword = hashPasswordForStorage(newTempPassword);
      
      await prisma.members.update({
        where: { id: existingMember.id },
        data: {
          password: hashedPassword,
          mustChangePassword: true,
          isPasswordTemporary: true,
          updatedAt: new Date()
        }
      });
      
      console.log('\n✅ Mot de passe temporaire régénéré pour Gaëlle:');
      console.log(`   🔑 Mot de passe: ${newTempPassword}`);
      console.log('   ⚠️  Elle DOIT le changer à la première connexion\n');
      
      return;
    }

    // Générer un mot de passe temporaire fort
    const tempPassword = generateTemporaryPassword();
    const hashedPassword = hashPasswordForStorage(tempPassword);

    // Créer le profil adhérent avec accès
    const member = await prisma.members.create({
      data: {
        id: crypto.randomUUID(),
        firstName: 'Gaëlle',
        lastName: 'CHAMPENOIS',
        email: 'g.champenois@retrobus-essonne.fr',
        matricule: 'g.champenois',
        membershipType: 'STANDARD',
        membershipStatus: 'ACTIVE',
        membershipStartDate: new Date(),
        hasLinkedAccess: true,
        newsletter: true,
        role: 'MEMBER',
        password: hashedPassword,
        isPasswordTemporary: true,
        mustChangePassword: true,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log('✅ Profil adhérent créé:');
    console.log(`   • ID: ${member.id}`);
    console.log(`   • Matricule: ${member.matricule}`);
    console.log(`   • Email: ${member.email}`);
    console.log(`   • Nom: ${member.firstName} ${member.lastName}`);

    console.log('\n' + '='.repeat(80));
    console.log('📋 INFOS DE CONNEXION POUR GAËLLE');
    console.log('='.repeat(80));
    console.log(`\n🔗 Identifiant: g.champenois`);
    console.log(`📧 Email: g.champenois@retrobus-essonne.fr`);
    console.log(`🔑 Mot de passe temporaire: ${tempPassword}`);
    console.log('\n⚠️  Elle DOIT changer son mot de passe à la première connexion');
    console.log('⚠️  Ce mot de passe doit être communiqué de manière sécurisée\n');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
