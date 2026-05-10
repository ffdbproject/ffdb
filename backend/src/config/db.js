// ============================================================
// FFDB - Flora and Fauna Database of Bangladesh
// Database Connection Pool (node-postgres)
// ============================================================

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'ffdb',

  // Connection pool settings (tuned for cPanel shared hosting)
  max: 10,                 // Max concurrent connections
  idleTimeoutMillis: 30000, // Close idle clients after 30s
  connectionTimeoutMillis: 5000, // Fail if connection takes > 5s
});

// Log when the pool connects successfully
pool.on('connect', () => {
  console.log('[DB] New client connected to PostgreSQL');
});

// Log pool errors (prevents unhandled rejections)
pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

/**
 * Test database connectivity.
 * Call this on server startup to fail fast if DB is unreachable.
 */
async function testConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() AS server_time');
    console.log(`[DB] Connected to PostgreSQL - Server time: ${result.rows[0].server_time}`);
    client.release();
  } catch (err) {
    console.error('[DB] Failed to connect to PostgreSQL:', err.message);
    console.error('   Make sure PostgreSQL is running and .env credentials are correct.');
    // Removed process.exit(1) to prevent cPanel Request Timeout loops
  }
}

module.exports = { pool, testConnection };
