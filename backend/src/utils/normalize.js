// ============================================================
// FFDB - Flora and Fauna Database of Bangladesh
// Shared Normalization Utilities
//
// Common string and URL normalization helpers used across
// controllers. Extracted to avoid code duplication.
// ============================================================

/**
 * Normalize an optional string value: trim, enforce max length, return null if empty.
 * @param {*} value - Input value
 * @param {number} maxLen - Maximum allowed length
 * @returns {string|null}
 */
function normalizeOptionalString(value, maxLen) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  return maxLen ? normalized.slice(0, maxLen) : normalized;
}

/**
 * Normalize external image URLs to HTTPS for mobile compatibility.
 * Converts http:// URLs to https:// to avoid mixed-content blocking on mobile.
 * Safe external domains (GBIF, Wikipedia, known biodiversity databases) are whitelisted.
 * @param {string} url - Image URL to normalize
 * @returns {string}
 */
function normalizeImageUrl(url) {
  if (!url || typeof url !== 'string') return url;

  // Known safe domains that support HTTPS
  const safeDomainsHttpToHttps = [
    'plantsp-eflora.bnh.gov.bd',
    'www.gbif.org',
    'gbif.org',
    'upload.wikimedia.org',
    'commons.wikimedia.org',
  ];

  if (url.startsWith('http://')) {
    try {
      const domain = new URL(url).hostname;
      if (safeDomainsHttpToHttps.some(d => domain.includes(d))) {
        return url.replace(/^http:\/\//, 'https://');
      }
    } catch {
      // If URL parsing fails, return as-is
    }
  }

  return url;
}

module.exports = { normalizeOptionalString, normalizeImageUrl };
