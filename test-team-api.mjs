/**
 * Test des URLs d'images retournées par l'API
 */

const API_BASE = 'http://localhost:8080';

async function testTeamAPI() {
  console.log('🔍 Test API /team?public=true\n');
  
  try {
    const response = await fetch(`${API_BASE}/api/team?public=true`);
    
    if (!response.ok) {
      console.error(`❌ Erreur: ${response.status}`);
      return;
    }
    
    const members = await response.json();
    
    console.log(`✅ ${members.length} membres récupérés\n`);
    
    members.forEach(member => {
      console.log(`👤 ${member.name}`);
      console.log(`   Image: ${member.image || '(pas d\'image)'}`);
      console.log(`   Email: ${member.email || '(masqué)'}`);
      console.log(`   Phone: ${member.phone || '(masqué)'}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

testTeamAPI();
