// Test d'envoi d'événement de trafic

const API_BASE = 'http://localhost:8080';

const payload = {
  eventType: 'pageview',
  path: '/test',
  referrer: '',
  source: 'direct',
  searchQuery: null,
  timestamp: new Date().toISOString()
};

console.log('📤 Envoi d\'un événement de test...');
console.log('URL:', `${API_BASE}/api/public/traffic-event`);
console.log('Payload:', JSON.stringify(payload, null, 2));

try {
  const response = await fetch(`${API_BASE}/api/public/traffic-event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  console.log('\n📥 Réponse HTTP:', response.status, response.statusText);
  
  const text = await response.text();
  console.log('Body:', text);
  
  if (response.ok) {
    console.log('\n✅ Événement envoyé avec succès !');
    console.log('\nVérifiez maintenant avec: node check-traffic-data.mjs');
  } else {
    console.log('\n❌ Erreur lors de l\'envoi');
  }
} catch (error) {
  console.error('\n❌ Erreur réseau:', error.message);
  console.log('\n⚠️ Vérifiez que l\'API tourne sur localhost:8080');
  console.log('   Relancez : npm run dev --turbo (dans le dossier api)');
}
