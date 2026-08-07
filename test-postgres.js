#!/usr/bin/env node
// Test PostgreSQL connection from Railway

import pkg from 'pg';
const { Client } = pkg;

async function test() {
  // Use DATABASE_URL from env or fallback to Railway connection
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:kufBlJfvgFQSHCnQyUgVqwGLthMXtyot@yamanote.proxy.rlwy.net:18663/railway?sslmode=require';
  
  console.log('🔍 Testing PostgreSQL connection...');
  console.log(`📍 Connection string: ${connectionString.substring(0, 50)}...`);
  
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL!');
    
    // Test query
    const result = await client.query('SELECT NOW()');
    console.log('⏰ Database time:', result.rows[0]);
    
    // Check existing tables
    const tables = await client.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public'
    `);
    console.log(`📊 Existing tables: ${tables.rows.length}`);
    tables.rows.forEach(t => console.log(`   - ${t.tablename}`));
    
    await client.end();
    console.log('✅ Connection closed');
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
  }
}

test();
