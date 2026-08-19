/**
 * Script pour vérifier quelles images sont retournées par l'API
 */

const API_BASE = 'https://attractive-kindness-rbe-serveurs.up.railway.app';

async function checkTeamImages() {
  console.log('🔍 Vérification des images de l\'équipe (mode public)...\n');
  
  try {
    const response = await fetch(`${API_BASE}/api/team?public=true`);
    
    if (!response.ok) {
      console.error('❌ Erreur:', response.status);
      return;
    }
    
    const members = await response.json();
    
    console.log(`✅ ${members.length} membres récupérés\n`);
    
    for (const member of members) {
      console.log(`👤 ${member.name}`);
      console.log(`   Image: ${member.image || '(pas d\'image)'}`);
      
      if (member.image) {
        // Tester si l'image est accessible
        try {
          const imgResponse = await fetch(member.image, { method: 'HEAD' });
          if (imgResponse.ok) {
            console.log(`   ✅ Image accessible (${imgResponse.status})`);
          } else {
            console.log(`   ❌ Image inaccessible (${imgResponse.status})`);
          }
        } catch (err) {
          console.log(`   ❌ Erreur d'accès: ${err.message}`);
        }
      }
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

checkTeamImages();
