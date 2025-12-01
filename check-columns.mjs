import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  host: 'yamanote.proxy.rlwy.net',
  port: 18663,
  user: 'postgres',
  password: 'kufBlJfvgFQSHCnQyUgVqwGLthMXtyot',
  database: 'railway'
});

await client.connect();

console.log('=== Colonnes de Vehicle ===');
const vehicleRes = await client.query(
  "SELECT column_name FROM information_schema.columns WHERE table_name = 'Vehicle' ORDER BY ordinal_position"
);
console.log(vehicleRes.rows.map(r => r.column_name));

console.log('\n=== Colonnes de members ===');
const membersRes = await client.query(
  "SELECT column_name FROM information_schema.columns WHERE table_name = 'members' ORDER BY ordinal_position"
);
console.log(membersRes.rows.map(r => r.column_name));

console.log('\n=== Colonnes de Event ===');
const eventRes = await client.query(
  "SELECT column_name FROM information_schema.columns WHERE table_name = 'Event' ORDER BY ordinal_position"
);
console.log(eventRes.rows.map(r => r.column_name));

await client.end();
