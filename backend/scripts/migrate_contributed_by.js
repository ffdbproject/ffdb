// ============================================================
// FFDB - Migration: Add contributed_by column to species table
// Run: node scripts/migrate_contributed_by.js
// ============================================================

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Adding contributed_by column to species table...');
    await client.query('ALTER TABLE species ADD COLUMN IF NOT EXISTS contributed_by TEXT');
    console.log('Migration complete. Column contributed_by added (or already exists).');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
