// ============================================================
// FFDB - Flora and Fauna Database of Bangladesh
// Database Connection Pool (node-postgres)
// Hardened for shared hosting where the server silently kills
// idle connections after ~15-20 seconds.
// ============================================================

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'ffdb',

  // ---- Shared hosting lifesavers ----
  max: 10,                      // Max concurrent connections (don't exceed host limit)
  idleTimeoutMillis: 10000,     // Close idle clients after 10s (before host kills them at ~15-20s)
  connectionTimeoutMillis: 5000, // Fail if new connection takes > 5s
  allowExitOnIdle: true,        // Let Node.js exit gracefully when pool is idle

  // TCP keepalive: detect silently killed connections at the OS level
  // instead of hanging until the next query times out
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000, // Start keepalive pings after 10s idle
});

// Catch silent connection drops globally.
// When a client sits idle in the pool and the shared host kills it,
// this prevents the entire Node process from crashing.
// The pool automatically removes the dead client and creates a new one on next request.
pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client:', err.message);
});

// ---- Auto-retry wrapper ----
// Shared hosting frequently kills idle connections. When a stale connection
// is picked from the pool, the first query fails with ECONNRESET or similar.
// This wrapper detects those errors and retries once with a fresh connection.
const RETRYABLE_MESSAGES = [
  'ECONNRESET',
  'ECONNREFUSED',
  'EPIPE',
  'connection terminated unexpectedly',
  'Connection terminated',
  'terminating connection due to administrator command',
  'server closed the connection unexpectedly',
  'Client has encountered a connection error',
];

function isRetryableError(err) {
  if (!err) return false;
  const msg = (err.message || '') + (err.code || '');
  return RETRYABLE_MESSAGES.some(e => msg.includes(e));
}

// Wrap pool.query so all existing `pool.query(...)` calls automatically get retry logic
const originalQuery = pool.query.bind(pool);
pool.query = async function resilientQuery(text, params) {
  try {
    return await originalQuery(text, params);
  } catch (err) {
    if (isRetryableError(err)) {
      console.warn('[DB] Stale connection, retrying query:', err.message);
      await new Promise(r => setTimeout(r, 200));
      return await originalQuery(text, params);
    }
    throw err;
  }
};

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
  }
}

module.exports = { pool, testConnection };
