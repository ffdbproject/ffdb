// ============================================================
// FFDB - Flora and Fauna Database of Bangladesh
// Input Sanitizer Middleware
//
// Strips HTML tags and trims all string values in req.body
// to prevent stored XSS and excessively long inputs.
// Applied globally to all incoming requests.
// ============================================================

const sanitizeHtml = require('sanitize-html');

/**
 * Recursively sanitize all string values in an object.
 * - Strips all HTML tags securely using sanitize-html
 * - Trims whitespace
 * - Enforces max string length (default 10,000 chars)
 */
function sanitizeValue(value, maxLength = 10000) {
  if (typeof value === 'string') {
    const trimmed = value.trim().substring(0, maxLength);

    // Only pay the HTML sanitization cost when the input actually looks like HTML.
    if (!trimmed.includes('<')) {
      return trimmed;
    }

    const cleanHTML = sanitizeHtml(trimmed, {
      allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
      allowedAttributes: {
        'a': ['href', 'target', 'rel']
      },
    });

    return cleanHTML.trim();
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, maxLength));
  }
  if (value && typeof value === 'object') {
    return sanitizeObject(value, maxLength);
  }
  return value;
}

function sanitizeObject(obj, maxLength = 10000) {
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = sanitizeValue(value, maxLength);
  }
  return sanitized;
}

/**
 * Express middleware: sanitize req.body on POST/PUT/PATCH requests.
 */
function sanitizeBody(req, _res, next) {
  if (req.body && typeof req.body === 'object' && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
    req.body = sanitizeObject(req.body);
  }
  next();
}

module.exports = { sanitizeBody, sanitizeValue, sanitizeObject };
