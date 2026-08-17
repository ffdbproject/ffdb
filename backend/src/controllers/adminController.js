// ============================================================
// FFDB - Flora and Fauna Database of Bangladesh
// Admin Authentication Controller
// ============================================================

const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../utils/auth');

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

    // Generate JWT with shared secret
    const token = jwt.sign({ role: 'admin' }, jwtSecret, { expiresIn: '1d' });

    // Set HttpOnly cookie with secure flags
    // secure is only true in production so local HTTP dev still works
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
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
      secure: process.env.NODE_ENV === 'production',
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
