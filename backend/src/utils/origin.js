// ============================================================
// FFDB - Flora and Fauna Database of Bangladesh
// Shared Origin Resolver
//
// Determines the public-facing origin (protocol + host) for
// canonical URLs, OG tags, sitemaps, and JSON-LD.
// Extracted to avoid duplication between seoRoutes and
// prerenderMiddleware.
// ============================================================

/**
 * Determine the public origin for the current request.
 *
 * Priority:
 *  1. PUBLIC_SITE_URL / SITE_URL env var (most reliable in production)
 *  2. x-forwarded-host header (from reverse proxy)
 *  3. Host header / req.hostname
 *  4. Fallback
 *
 * @param {import('express').Request} req
 * @returns {string} Origin like "https://ffdb.org.bd"
 */
function getPublicOrigin(req) {
  // Priority 1: Explicit env var
  const configuredOrigin = process.env.PUBLIC_SITE_URL || process.env.SITE_URL || '';
  if (configuredOrigin) {
    return configuredOrigin.replace(/\/$/, '');
  }

  // Priority 2: x-forwarded-host header (from reverse proxy)
  const forwardedHost = (req.get('x-forwarded-host') || '').split(',')[0].trim();

  // Priority 3: Host header
  const host = forwardedHost || req.get('host') || req.hostname;
  if (!host) {
    const fallback = process.env.NODE_ENV === 'production' ? 'https://localhost' : 'http://localhost:5173';
    console.warn('[SEO] Unable to detect domain. Using fallback:', fallback);
    return fallback;
  }

  // Priority 4: Detect protocol
  if (process.env.NODE_ENV === 'production') {
    const forwardedProto = (req.get('x-forwarded-proto') || 'https').split(',')[0].trim();
    const protocol = forwardedProto === 'http' ? 'http' : 'https';
    const url = `${protocol}://${host}`;
    return url;
  }

  return `${req.protocol}://${host}`;
}

module.exports = { getPublicOrigin };
