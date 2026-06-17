import { PrismaClient } from '@prisma/client';
import { generateTemporaryPassword, hashPasswordForStorage, verifyPassword } from './src/lib/passwordUtils.js';

const prisma = new PrismaClient();

async function testPasswordFlow() {
  try {
    console.log('🧪 Test du flux complet de mot de passe\n');
    
    // 1. Générer un nouveau mot de passe temporaire
    const tempPassword = generateTemporaryPassword();
    console.log('1️⃣ Mot de passe temporaire généré:', tempPassword);
    console.log('   Contient des caractères spéciaux:', /[&!@#$%^*(),.?":{}|<>]/.test(tempPassword));
    
    // 2. Hasher le mot de passe
    const hashedPassword = hashPasswordForStorage(tempPassword);
    console.log('\n2️⃣ Hash généré:', hashedPassword.substring(0, 50) + '...');
    
    // 3. Vérifier que le mot de passe brut match le hash
    const isValid = verifyPassword(tempPassword, hashedPassword);
    console.log('\n3️⃣ Vérification directe:', isValid ? '✅ OK' : '❌ ÉCHEC');
    
    // 4. Vérifier qu'un mot de passe avec & encodé ne match PAS
    const sanitizedPassword = tempPassword.replace(/&/g, '&amp;');
    const isValidSanitized = verifyPassword(sanitizedPassword, hashedPassword);
    console.log('\n4️⃣ Vérification avec & encodé:', isValidSanitized ? '❌ PROBLÈME' : '✅ OK (ne devrait pas matcher)');
    
    // 5. Trouver l'utilisateur n.bayoudh dans la DB
    console.log('\n5️⃣ Recherche de l\'utilisateur n.bayoudh...');
    const user = await prisma.members.findFirst({
      where: {
        OR: [
          { matricule: 'n.bayoudh' },
          { email: { contains: 'bayoudh' } }
        ]
      }
    });
    
    if (!user) {
      console.log('   ❌ Utilisateur non trouvé');
      return;
    }
    
    console.log('   ✅ Utilisateur trouvé:', user.firstName, user.lastName);
    console.log('   ID:', user.id);
    console.log('   Email:', user.email);
    console.log('   Matricule:', user.matricule);
    console.log('   Password (hash):', user.password?.substring(0, 50) + '...');
    
    // 6. Générer un nouveau mot de passe pour cet utilisateur
    console.log('\n6️⃣ Génération d\'un nouveau mot de passe pour cet utilisateur...');
    const newTempPassword = generateTemporaryPassword();
    const newHashedPassword = hashPasswordForStorage(newTempPassword);
    
    await prisma.members.update({
      where: { id: user.id },
      data: {
        password: newHashedPassword,
        isPasswordTemporary: true,
        mustChangePassword: true,
        updatedAt: new Date()
      }
    });
    
    console.log('   ✅ Nouveau mot de passe défini:', newTempPassword);
    console.log('   ⚠️  IMPORTANT: Utilise ce mot de passe pour te connecter maintenant!');
    
    // 7. Vérifier que le nouveau mot de passe fonctionne
    const userUpdated = await prisma.members.findUnique({ where: { id: user.id } });
    const finalCheck = verifyPassword(newTempPassword, userUpdated.password);
    console.log('\n7️⃣ Vérification finale:', finalCheck ? '✅ OK' : '❌ ÉCHEC');
    
    console.log('\n' + '='.repeat(60));
    console.log('🎯 MOT DE PASSE À UTILISER MAINTENANT:');
    console.log('   Identifiant: n.bayoudh');
    console.log('   Mot de passe:', newTempPassword);
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPasswordFlow();
