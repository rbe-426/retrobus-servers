import axios from 'axios';

const API = 'http://localhost:8080';
const token = `stub.${Buffer.from('test@retrobus.fr').toString('base64')}`;

async function createAndVerify() {
  try {
    console.log('📝 Creating test news for persistence verification...\n');
    
    const response = await axios.post(`${API}/api/retro-news`, {
      title: `Test Persistence - ${new Date().toISOString()}`,
      body: 'This news should persist in the database when server restarts',
      status: 'published',
      isFeatured: true
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const newsId = response.data.id;
    console.log(`✅ Created news: ${newsId}`);
    console.log(`   Title: ${response.data.title}`);
    console.log(`   Published: ${response.data.published}`);
    console.log(`   Featured: ${response.data.featured}\n`);
    
    // Verify it's in the list
    const listResponse = await axios.get(`${API}/api/retro-news`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const found = listResponse.data.find(n => n.id === newsId);
    if (found) {
      console.log(`✅ News found in database list!`);
      console.log(`   Total news items: ${listResponse.data.length}`);
    } else {
      console.log(`❌ News NOT found in list!`);
    }
    
  } catch (e) {
    console.error('❌ Error:', e.message);
    if (e.response?.data) {
      console.error('Response:', e.response.data);
    }
  }
}

createAndVerify();
