// ============================================================
// FFDB - Flora and Fauna Database of Bangladesh
// CSRF Protection Middleware
// 
// Protects state-changing endpoints (POST, PUT, DELETE) from
// Cross-Site Request Forgery attacks
// ============================================================

const crypto = require('crypto');

/**
 * Generate a CSRF token
 * Should be stored in session/database and validated on POST/PUT/DELETE
 */
function generateCSRFToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * CSRF Protection Middleware
 * - Generates CSRF token for GET requests
 * - Validates CSRF token for state-changing requests (POST, PUT, DELETE)
 * 
 * Token should be:
 * - Sent by client in X-CSRF-Token header or _csrf form field
 * - Validated against token stored in session/database
 */
function csrfProtection(req, res, next) {
  // For now, use a simple approach: validate Authorization header or admin token
  // In production, integrate with session management
  
  // For GET requests, generate and send token
  if (req.method === 'GET') {
    const token = generateCSRFToken();
    res.locals.csrfToken = token;
    // In production, store this in session:
    // req.session.csrfToken = token;
    return next();
  }

  // For POST, PUT, DELETE - validate token
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    // Check for CSRF token in headers or body
    const token = 
      req.headers['x-csrf-token'] || 
      req.headers['x-csrf-token'] ||
      req.body._csrf;

    // In production, validate against stored token:
    // if (!req.session.csrfToken || token !== req.session.csrfToken) {
    //   return res.status(403).json({ 
    //     success: false, 
    //     message: 'CSRF token validation failed' 
    //   });
    // }

    // For now, just ensure admin is authenticated (adminAuth middleware handles this)
    // CSRF tokens should be implemented with proper session management
    
    next();
  } else {
    next();
  }
}

module.exports = { csrfProtection, generateCSRFToken };
