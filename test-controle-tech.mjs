const controle = {
  attestationPath: "/documents/R123_CT_2025.pdf",
  ctDate: "2025-11-15",
  ctStatus: "passed",
  nextCtDate: "2026-11-15",
  mileage: 45000,
  notes: "Tous les tests passés"
};

try {
  const response = await fetch('http://localhost:3001/vehicles/R123/ct', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer stub.dGVzdEBlbWFpbC5jb20=',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(controle)
  });

  const data = await response.json();
  console.log('Status:', response.status);
  
  if (response.ok) {
    console.log('\n✅ Contrôle technique sauvegardé!');
    console.log('ID:', data.id);
    console.log('Parc:', data.parc);
    console.log('Statut:', data.ctStatus);
  } else {
    console.log('❌ Erreur:', data.error);
  }
} catch (e) {
  console.error('Error:', e.message);
}
