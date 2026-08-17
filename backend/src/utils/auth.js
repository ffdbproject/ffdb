// ============================================================
// FFDB - Flora and Fauna Database of Bangladesh
// Shared Authentication Utilities
//
// Single source of truth for JWT secret resolution and
// admin authorization checks. Used by both middleware and
// controllers to ensure consistent security behaviour.
// ============================================================

const jwt = require('jsonwebtoken');

/**
 * Resolve JWT secret with consistent fallback chain.
 * In production, throws if JWT_SECRET is not set.
 * In development, uses a temporary secret with a warning.
 */
function getJWTSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[CRITICAL SECURITY ERROR]');
      console.error('JWT_SECRET is not set in production!');
      console.error('Set JWT_SECRET in cPanel environment variables (min 32 chars).');
      console.error('Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
      throw new Error('JWT_SECRET must be set in production');
    }
    console.warn('[Development] JWT_SECRET not set. Using temporary secret (CHANGE BEFORE DEPLOY).');
    return 'dev-temporary-secret-change-before-deploying';
  }
  return secret;
}

// Resolve once at module load time so all consumers share the same value.
const jwtSecret = getJWTSecret();

/**
 * Check whether the current request comes from an authenticated admin.
 *
 * Used by controllers that need to adjust response data based on admin
 * status (e.g. showing draft species in public GET endpoints).
 *
 * Authorization checks (in order):
 *  1. Bearer token in Authorization header matching ADMIN_API_KEY
 *  2. HttpOnly admin_token cookie containing a valid JWT
 *  3. Development-only fallback when ADMIN_API_KEY is not configured
 */
function isAdminAuthorized(req) {
  const apiKey = process.env.ADMIN_API_KEY;

  // 1) If Authorization: Bearer <API_KEY> header is present and matches, allow
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (apiKey && token === apiKey) return true;
  }

  // 2) If an HttpOnly admin cookie is present, verify the JWT
  try {
    const token = req.cookies?.admin_token;
    if (token) {
      const decoded = jwt.verify(token, jwtSecret);
      if (decoded && decoded.role === 'admin') return true;
    }
  } catch (e) {
    // ignore verification errors and fall through
  }

  // 3) Development mode fallback when no ADMIN_API_KEY configured
  if (!apiKey && process.env.NODE_ENV !== 'production') return true;

  return false;
}

module.exports = { getJWTSecret, jwtSecret, isAdminAuthorized };
