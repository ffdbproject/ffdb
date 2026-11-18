const { createClient } = require('redis');

// Create a singleton Redis client. Use REDIS_URL if provided.
const REDIS_URL = process.env.REDIS_URL || undefined;
const client = createClient({ url: REDIS_URL });

client.on('error', (err) => {
  console.error('[Redis] Client error:', err && err.message ? err.message : err);
});

// Try to connect but don't crash the app if Redis is unavailable.
(async () => {
  try {
    await client.connect();
    console.log('[Redis] Connected');
  } catch (err) {
    console.warn('[Redis] Connection failed, continuing without Redis caching');
  }
})();

module.exports = client;
