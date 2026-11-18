// ============================================================
// FFDB - Flora and Fauna Database of Bangladesh
// Admin Authentication Controller
// ============================================================

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../utils/auth');

const COOKIE_NAME = 'admin_token';
const TOKEN_EXPIRY = process.env.ADMIN_TOKEN_EXPIRES || '8h';

function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function parseCookieMaxAge(expiryStr) {
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

/**
 * Parse CONTRIBUTOR_API_KEYS env var into a map of { key: label }.
 * Format: "alice:key-abc123,bob:key-xyz789"
 */
function parseContributorKeys() {
  const raw = process.env.CONTRIBUTOR_API_KEYS || '';
  if (!raw.trim()) return {};

  const map = {};
  for (const entry of raw.split(',')) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx > 0) {
      const label = trimmed.slice(0, colonIdx).trim();
      const key = trimmed.slice(colonIdx + 1).trim();
      if (label && key) {
        map[key] = label;
      }
    }
  }
  return map;
}

/**
 * POST /api/admin/login
 * Supports two modes:
 *   1. Admin API key login (existing)
 *   2. Contributor API key login (new)
 */
async function login(req, res, next) {
  try {
    const { apiKey } = req.body;
    const expectedApiKey = process.env.ADMIN_API_KEY;

    // 1. Check admin API key
    if (expectedApiKey && safeCompare(apiKey, expectedApiKey)) {
      const token = jwt.sign({ role: 'admin' }, jwtSecret, { expiresIn: TOKEN_EXPIRY });
      const maxAge = parseCookieMaxAge(TOKEN_EXPIRY) || (8 * 60 * 60 * 1000);

      res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge,
      });

      const acceptsHtml = String(req.headers.accept || '').includes('text/html');
      if (acceptsHtml) return res.redirect('/admin');

      return res.json({ success: true, message: 'Logged in successfully.' });
    }

    // 2. Check contributor API keys
    const contributorKeys = parseContributorKeys();
    if (apiKey) {
      let matchedLabel = null;
      for (const [key, label] of Object.entries(contributorKeys)) {
        if (safeCompare(apiKey, key)) {
          matchedLabel = label;
          break;
        }
      }

      if (matchedLabel) {
        const token = jwt.sign({ role: 'contributor', label: matchedLabel }, jwtSecret, { expiresIn: TOKEN_EXPIRY });
        const maxAge = parseCookieMaxAge(TOKEN_EXPIRY) || (8 * 60 * 60 * 1000);

        res.cookie(COOKIE_NAME, token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          path: '/',
          maxAge,
        });

        const acceptsHtml = String(req.headers.accept || '').includes('text/html');
        if (acceptsHtml) return res.redirect('/admin');

        return res.json({ success: true, message: 'Logged in successfully.' });
      }
    }

    // 3. Dev mode fallback
    if (!expectedApiKey && process.env.NODE_ENV !== 'production') {
      if (apiKey === 'dev') {
        const token = jwt.sign({ role: 'admin' }, jwtSecret, { expiresIn: TOKEN_EXPIRY });
        const maxAge = parseCookieMaxAge(TOKEN_EXPIRY) || (8 * 60 * 60 * 1000);
        res.cookie(COOKIE_NAME, token, {
          httpOnly: true,
          secure: false,
          sameSite: 'strict',
          path: '/',
          maxAge,
        });
        return res.json({ success: true, message: 'Logged in successfully.' });
      }
    }

    // 4. No match
    return res.status(401).json({ success: false, message: 'Invalid API key.' });
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
      path: '/',
    });
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/me
 * Check if the user is currently authenticated and return their role.
 */
async function getMe(req, res, next) {
  try {
    // req.user is set by adminAuth middleware (contains decoded JWT payload)
    const role = req.user?.role || 'admin';
    const label = req.user?.label || null;
    res.json({ success: true, user: { role, label } });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, logout, getMe };
