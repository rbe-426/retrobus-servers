import pkg from 'pg';
const { Client } = pkg;

const c = new Client({
  host: 'yamanote.proxy.rlwy.net',
  port: 18663,
  user: 'postgres',
  password: 'kufBlJfvgFQSHCnQyUgVqwGLthMXtyot',
  database: 'railway'
});

await c.connect();

try {
  // Create the VehicleCessionCertificate table
  await c.query(`
    CREATE TABLE IF NOT EXISTS "VehicleCessionCertificate" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "parc" TEXT NOT NULL UNIQUE,
      "certificateUrl" TEXT,
      "certificatePath" TEXT,
      "issuedDate" TIMESTAMP(3),
      "issuedBy" TEXT,
      "notes" TEXT,
      "dateImport" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "imported" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "VehicleCessionCertificate_parc_fkey" FOREIGN KEY ("parc") REFERENCES "Vehicle"("parc") ON DELETE RESTRICT ON UPDATE CASCADE
    );
  `);

  // Create indexes
  await c.query(`CREATE INDEX IF NOT EXISTS "VehicleCessionCertificate_parc_idx" ON "VehicleCessionCertificate"("parc");`);

  console.log('✅ VehicleCessionCertificate table created');
} catch (e) {
  if (e.code === '42P07') {
    console.log('✅ Table already exists');
  } else {
    console.error('❌ Error:', e.message);
  }
} finally {
  await c.end();
}
