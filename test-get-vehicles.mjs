const response = await fetch('http://localhost:3001/api/vehicles', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer stub.dGVzdEBlbWFpbC5jb20='
  }
});

const data = await response.json();
console.log('Status:', response.status);
console.log('Vehicles:', JSON.stringify(data, null, 2));
