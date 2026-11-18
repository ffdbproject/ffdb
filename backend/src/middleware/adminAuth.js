// ============================================================
// FFDB - Flora and Fauna Database of Bangladesh
// Authentication Middleware — Role-based access control
// ============================================================

const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../utils/auth');

// Token rotation settings
const TOKEN_ROTATE_WINDOW_MS = parseInt(process.env.ADMIN_TOKEN_ROTATE_WINDOW_MS || String(30 * 60 * 1000), 10); // 30 minutes
const TOKEN_EXPIRY = process.env.ADMIN_TOKEN_EXPIRES || '8h';
const COOKIE_NAME = 'admin_token';

/**
 * Core auth middleware. Verifies JWT and attaches decoded payload to req.user.
 * Accepts both admin and contributor roles.
 * Performs token rotation when the token is near expiry.
 */
function adminAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];

  const isApiRequest = req.path && req.path.startsWith('/api');
  const acceptsHtml = req.headers && String(req.headers.accept || '').includes('text/html');

  if (!token) {
    if (!isApiRequest && acceptsHtml) {
      return res.redirect('/admin/login');
    }
    return res.status(401).json({ success: false, message: 'Authentication required. Please log in.' });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);

    // Accept both admin and contributor roles
    if (decoded.role !== 'admin' && decoded.role !== 'contributor') {
      throw new Error('Invalid role');
    }

    // Attach user info to request
    req.user = decoded;
    // Backward compatibility: keep req.admin for existing code that references it
    req.admin = decoded;

    // Token rotation: if token expires within the rotate window, issue a new token
    try {
      if (decoded.exp && typeof decoded.exp === 'number') {
        const expiresAtMs = decoded.exp * 1000;
        const timeLeft = expiresAtMs - Date.now();
        if (timeLeft < TOKEN_ROTATE_WINDOW_MS) {
          const payload = { role: decoded.role };
          if (decoded.label) payload.label = decoded.label;
          const newToken = jwt.sign(payload, jwtSecret, { expiresIn: TOKEN_EXPIRY });
          res.cookie(COOKIE_NAME, newToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/',
            maxAge: parseCookieMaxAge(TOKEN_EXPIRY),
          });
        }
      }
    } catch (rotErr) {
      console.warn('[adminAuth] token rotation failed:', rotErr && rotErr.message);
    }

    return next();
  } catch (err) {
    if (!isApiRequest && acceptsHtml) {
      return res.redirect('/admin/login');
    }
    return res.status(403).json({ success: false, message: 'Invalid or expired session.' });
  }
}

/**
 * Middleware that requires admin role specifically.
 * Use for admin-only endpoints (database, team, reports, GBIF import).
 */
function requireAdmin(req, res, next) {
  // First run the base auth check
  adminAuth(req, res, (err) => {
    if (err) return next(err);

    // adminAuth already set req.user — check role
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required. Your current role does not have permission for this action.',
      });
    }
    next();
  });
}

/**
 * Middleware that allows both admin and contributor roles.
 * Use for endpoints contributors can access (species CRUD, enrich).
 */
function requireContributor(req, res, next) {
  // adminAuth already accepts both roles, so just delegate
  adminAuth(req, res, next);
}

function parseCookieMaxAge(expiryStr) {
  // Accept values like '8h', '1d' or numeric milliseconds
  if (!expiryStr) return 0;
  if (/^\d+$/.test(String(expiryStr))) return parseInt(expiryStr, 10);
  const m = String(expiryStr).match(/^(\d+)([smhd])$/i);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  switch (unit) {
    case 's': return n * 1000;
    case 'm': return n * 60 * 1000;
    case 'h': return n * 60 * 60 * 1000;
    case 'd': return n * 24 * 60 * 60 * 1000;
    default: return 0;
  }
}

module.exports = { adminAuth, requireAdmin, requireContributor };
