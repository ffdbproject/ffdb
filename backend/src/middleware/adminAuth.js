// ============================================================
// FFDB - Flora and Fauna Database of Bangladesh
// Admin Authentication Middleware
// ============================================================

const jwt = require('jsonwebtoken');

// 🔒 SECURITY: Prefer JWT_SECRET, but keep ADMIN_API_KEY as a fallback so
// auth continues to work while cPanel env vars are being refreshed.
const secret = process.env.JWT_SECRET || process.env.ADMIN_API_KEY || 'dev-temporary-secret-change-before-deploying';

/**
 * Admin auth guard middleware.
 * Checks for a valid JWT in the HttpOnly cookie.
 */
function adminAuth(req, res, next) {
  const apiKey = process.env.ADMIN_API_KEY;

  // 🔒 SECURITY: Fail-CLOSED approach - require authentication in all cases
  if (!apiKey) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[SECURITY CRITICAL] ADMIN_API_KEY not set in production!');
      console.error('Set ADMIN_API_KEY in cPanel environment variables and restart app.');
      // Continue but require token below (don't auto-open)
    } else {
      console.warn('[Development] ADMIN_API_KEY not set. Authentication still required.');
    }
  }

  // Extract token from cookies - ALWAYS REQUIRED
  const token = req.cookies?.admin_token;
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please log in.',
    });
  }

  try {
    const decoded = jwt.verify(token, secret);
    if (decoded.role !== 'admin') {
      throw new Error('Invalid role');
    }
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired session.',
    });
  }
}

module.exports = { adminAuth };
