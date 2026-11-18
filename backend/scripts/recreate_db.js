require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// 🔒 SECURITY: Validate database credentials on startup
if (!process.env.DB_PASSWORD || !process.env.DB_USER || !process.env.DB_HOST || !process.env.DB_NAME) {
  throw new Error([
    'CRITICAL: Database credentials incomplete.',
    'Required env vars: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME',
    'Set these in cPanel environment variables or .env file.',
    'DO NOT commit credentials to git.'
  ].join('\n'));
}

async function recreateDB() {
  const client = await pool.connect();
  try {
    console.log('Dropping existing tables...');
    await client.query('DROP TABLE IF EXISTS images, taxonomy, team_members, species CASCADE;');
    console.log('Tables dropped.');

    console.log('Reading schema.sql...');
    const schemaPath = path.join(__dirname, 'src', 'db', 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('Executing schema.sql...');
    await client.query(schemaSql);
    console.log('Database schema recreated successfully.');
  } catch (err) {
    console.error('Error recreating database:', err);
  } finally {
    client.release();
    pool.end();
  }
}

recreateDB();
