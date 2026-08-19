import 'dotenv/config';
import { bankSyncService } from './src/services/bankSync.service.js';

console.log('🏦 Test de la connexion GoCardless\n');

async function testGoCardless() {
  try {
    // Test 1: Générer un token
    console.log('1️⃣ Génération du token...');
    const token = await bankSyncService.getToken();
    console.log('✅ Token généré:', token.access ? 'OK' : 'ERREUR');
    
    // Test 2: Lister les banques françaises
    console.log('\n2️⃣ Récupération des banques françaises...');
    const banks = await bankSyncService.listBanks('FR');
    console.log(`✅ ${banks.length} banques trouvées`);
    
    // Afficher les 5 premières banques
    console.log('\n📋 Top 5 banques:');
    banks.slice(0, 5).forEach(bank => {
      console.log(`   - ${bank.name} (${bank.id})`);
    });
    
    // Test 3: Sandbox bank
    console.log('\n3️⃣ Recherche de la banque sandbox...');
    const sandboxBank = banks.find(b => b.id.includes('SANDBOX'));
    if (sandboxBank) {
      console.log(`✅ Banque sandbox trouvée: ${sandboxBank.name}`);
    } else {
      console.log('⚠️  Aucune banque sandbox trouvée');
    }
    
    console.log('\n✅ Tous les tests sont passés!');
    console.log('💡 Tu peux maintenant utiliser l\'API /api/finance/bank-sync/banks');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

testGoCardless();
