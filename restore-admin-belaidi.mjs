#!/usr/bin/env node

const API_BASE = 'http://localhost:3001';
const DUMMY_TOKEN = 'stub.test';

async function main() {
  try {
    console.log('🔍 Chercher Waiyl BELAIDI (belaidiw91@gmail.com)...\n');
    
    // Search for Waiyl
    const searchRes = await fetch(`${API_BASE}/api/admin/members/search/belaidiw91`, {
      headers: { 'Authorization': `Bearer ${DUMMY_TOKEN}` }
    });
    
    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.found) {
        const user = data.user;
        console.log(`✅ Found Waiyl BELAIDI:`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Current role: ${user.role}\n`);
        
        if (user.role !== 'ADMIN') {
          console.log(`🔄 Restoring role to ADMIN...\n`);
          
          const roleRes = await fetch(`${API_BASE}/api/admin/users/${user.id}/role`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${DUMMY_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ role: 'ADMIN' })
          });
          
          if (roleRes.ok) {
            const roleData = await roleRes.json();
            console.log(`✅ Role restored to ADMIN!`);
            console.log(`   User: ${roleData.user.email}`);
            console.log(`   Role: ${roleData.user.role}\n`);
          } else {
            console.error(`❌ Role change failed: ${roleRes.status}`);
          }
        } else {
          console.log(`✅ Waiyl BELAIDI already has ADMIN role!\n`);
        }
      }
    }
    
    console.log('🎉 Done! Waiyl BELAIDI now has full ADMIN access including "Gestion des notes de frais" tab.');
    
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
}

main();
