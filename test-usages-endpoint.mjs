import axios from 'axios';

const API = 'https://attractive-kindness-rbe-serveurs.up.railway.app';

async function test() {
  try {
    // Get token first
    const loginRes = await axios.post(`${API}/api/auth/member-login`, {
      id: 'w.belaidi',
      password: 'Waiyl9134#'
    });
    
    const token = loginRes.data.token;
    console.log('✅ Login successful, token:', token.substring(0, 20) + '...');
    
    // Test usages endpoint
    const usagesRes = await axios.get(`${API}/api/vehicles/920/usages`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✅ Usages endpoint response status:', usagesRes.status);
    console.log('   Data:', usagesRes.data);
  } catch (e) {
    console.error('❌ Error:', e.response?.status, e.response?.data || e.message);
  }
}

test();
