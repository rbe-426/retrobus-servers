#!/usr/bin/env node

const API_BASE = 'http://localhost:3001';
const DUMMY_TOKEN = 'stub.test';

async function main() {
  try {
    console.log('🔍 Étape 1: Chercher Walid BELAIDI pour le supprimer...\n');
    
    // Search for Walid
    const searchRes = await fetch(`${API_BASE}/api/admin/members/search/Walid`, {
      headers: { 'Authorization': `Bearer ${DUMMY_TOKEN}` }
    });
    
    let walídId = null;
    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.found) {
        walídId = data.user.id;
        console.log(`✅ Found Walid BELAIDI:`);
        console.log(`   ID: ${data.user.id}`);
        console.log(`   Email: ${data.user.email}`);
        console.log(`   Role: ${data.user.role}\n`);
      }
    }
    
    if (walídId) {
      console.log('🗑️  Suppression de Walid BELAIDI...\n');
      const deleteRes = await fetch(`${API_BASE}/api/admin/users/${walídId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${DUMMY_TOKEN}` }
      });
      
      if (deleteRes.ok) {
        console.log(`✅ Walid BELAIDI supprimé avec succès\n`);
      } else {
        console.log(`⚠️  Suppression failed (status ${deleteRes.status}), continuant...\n`);
      }
    }
    
    console.log('🔍 Étape 2: Chercher Waiyl BELAIDI (belaidiw91@gmail.com)...\n');
    
    // Search for Waiyl
    const searchWaiylRes = await fetch(`${API_BASE}/api/admin/members/search/belaidiw91`, {
      headers: { 'Authorization': `Bearer ${DUMMY_TOKEN}` }
    });
    
    if (searchWaiylRes.ok) {
      const data = await searchWaiylRes.json();
      if (data.found) {
        const user = data.user;
        console.log(`✅ Found Waiyl BELAIDI:`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Current role: ${user.role}\n`);
        
        if (user.role !== 'TRESORIER') {
          console.log(`🔄 Setting role to TRESORIER...\n`);
          
          const roleRes = await fetch(`${API_BASE}/api/admin/users/${user.id}/role`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${DUMMY_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ role: 'TRESORIER' })
          });
          
          if (roleRes.ok) {
            const roleData = await roleRes.json();
            console.log(`✅ Role updated!`);
            console.log(`   User: ${roleData.user.email}`);
            console.log(`   New role: ${roleData.user.role}\n`);
          } else {
            console.error(`❌ Role change failed: ${roleRes.status}`);
          }
        } else {
          console.log(`✅ Waiyl BELAIDI already has TRESORIER role!\n`);
        }
      } else {
        console.log(`⚠️  Waiyl BELAIDI not found with email search\n`);
      }
    }
    
    console.log('🎉 Done! Waiyl BELAIDI should now see the "Gestion des notes de frais" tab.');
    
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
}

main();
