import axios from 'axios';

const API = 'http://localhost:3001';

async function test() {
  try {
    // Test login first
    console.log('🔑 Testing login...');
    const loginRes = await axios.post(`${API}/api/auth/member-login`, {
      identifier: 'w.belaidi',
      password: 'Waiyl9134#'
    });
    
    const token = loginRes.data.token;
    console.log('✅ Login successful');
    console.log('   Token:', token.substring(0, 30) + '...');
    console.log('   User:', loginRes.data.user);
    
    // Test usages endpoint
    console.log('\n📋 Testing /api/vehicles/920/usages...');
    const usagesRes = await axios.get(`${API}/api/vehicles/920/usages`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✅ Usages endpoint status:', usagesRes.status);
    console.log('   Data:', usagesRes.data);
    
    // Test reports endpoint
    console.log('\n📄 Testing /api/vehicles/920/reports...');
    const reportsRes = await axios.get(`${API}/api/vehicles/920/reports`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✅ Reports endpoint status:', reportsRes.status);
    console.log('   Data:', reportsRes.data);
  } catch (e) {
    console.error('❌ Error:');
    console.error('   Status:', e.response?.status);
    console.error('   Data:', e.response?.data);
    console.error('   Message:', e.message);
  }
}

test();
