import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testMailbackSystem() {
  try {
    console.log('🔍 Test du système mailback password...\n');
    
    // 1. Vérifier le template
    console.log('1️⃣ Vérification du template "mailback password"...');
    const template = await prisma.emailTemplate.findUnique({
      where: { name: 'mailback password' }
    });
    
    if (!template) {
      console.log('❌ Template "mailback password" introuvable !');
      return;
    }
    
    console.log(`✅ Template trouvé: "${template.name}"`);
    console.log(`   Sujet: ${template.subject}`);
    console.log(`   Actif: ${template.active ? '✅' : '❌'}`);
    console.log(`   Variables: ${template.variables}`);
    
    // 2. Vérifier un utilisateur de test
    console.log('\n2️⃣ Recherche d\'un utilisateur de test...');
    const testUser = await prisma.site_users.findFirst({
      where: {
        email: { contains: 'gaelle', mode: 'insensitive' }
      },
      include: {
        members: {
          select: {
            matricule: true
          }
        }
      }
    });
    
    if (!testUser) {
      console.log('❌ Aucun utilisateur de test trouvé');
      return;
    }
    
    console.log(`✅ Utilisateur: ${testUser.firstName} ${testUser.lastName}`);
    console.log(`   Email: ${testUser.email}`);
    console.log(`   Matricule: ${testUser.members?.matricule || 'N/A'}`);
    
    // 3. Tester les variables du template
    console.log('\n3️⃣ Simulation des variables du template...');
    const templateVars = {
      firstName: testUser.firstName,
      lastName: testUser.lastName,
      urbex_id: testUser.members?.matricule || testUser.email,
      temporar_mdp: 'TEST123456'
    };
    
    console.log('Variables qui seraient envoyées:');
    Object.entries(templateVars).forEach(([key, value]) => {
      console.log(`   {{${key}}}: "${value}"`);
    });
    
    // 4. Vérifier que toutes les variables existent dans le template
    console.log('\n4️⃣ Vérification des variables dans le template...');
    const requiredVars = ['firstName', 'lastName', 'urbex_id', 'temporar_mdp'];
    const templateBody = template.body;
    
    requiredVars.forEach(varName => {
      const found = templateBody.includes(`{{${varName}}}`);
      console.log(`   {{${varName}}}: ${found ? '✅ Trouvée' : '❌ Manquante'}`);
    });
    
    console.log('\n✅ Test de configuration terminé !');
    console.log('\n📧 Pour tester l\'envoi réel d\'email:');
    console.log('   1. Vérifiez que le compte noreply est connecté dans Site Management');
    console.log('   2. Essayez de réinitialiser le mot de passe d\'un utilisateur');
    console.log('   3. Vérifiez les logs du serveur pour voir les erreurs d\'envoi');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testMailbackSystem();
