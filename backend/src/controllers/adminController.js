// ============================================================
// FFDB - Flora and Fauna Database of Bangladesh
// Admin Authentication Controller
// ============================================================

const jwt = require('jsonwebtoken');

// 🔒 SECURITY: Prefer JWT_SECRET, but keep ADMIN_API_KEY as a fallback so the
// admin login path does not hard-fail if cPanel variables have not reloaded yet.
const secret = process.env.JWT_SECRET || process.env.ADMIN_API_KEY || 'dev-temporary-secret-change-before-deploying';
const COOKIE_NAME = 'admin_token';

/**
 * POST /api/admin/login
 */
async function login(req, res, next) {
  try {
    const { apiKey } = req.body;
    const expectedApiKey = process.env.ADMIN_API_KEY;

    if (!expectedApiKey) {
      if (process.env.NODE_ENV === 'production') {
        return res.status(500).json({
          success: false,
          message: 'Internal server misconfiguration preventing authentication.',
        });
      }
      // Dev mode fallback
      if (apiKey !== 'dev') {
        return res.status(401).json({ success: false, message: 'Invalid API key.' });
      }
    } else if (apiKey !== expectedApiKey) {
      return res.status(401).json({ success: false, message: 'Invalid API key.' });
    }

    // Generate JWT with secure secret
    const token = jwt.sign({ role: 'admin' }, secret, { expiresIn: '1d' });

    // Set HttpOnly cookie with secure flags
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: true, // Always HTTPS
      sameSite: 'strict', // Prevent CSRF
      path: '/api', // Restrict to API routes only
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    res.json({ success: true, message: 'Logged in successfully.' });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin/logout
 */
async function logout(req, res, next) {
  try {
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/api',
    });
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/me
 * Check if the user is currently authenticated.
 */
async function getMe(req, res, next) {
  try {
    // If we reach this, the adminAuth middleware has already passed
    res.json({ success: true, user: { role: 'admin' } });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, logout, getMe };
