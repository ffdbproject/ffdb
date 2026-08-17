// ============================================================
// FFDB - Flora and Fauna Database of Bangladesh
// Image Proxy Route
// Serves external species images through same-origin URLs so
// Facebook in-app browser and hotlink-protected hosts can load them.
// ============================================================

const express = require('express');
const path = require('path');

const router = express.Router();

// Maximum proxied image size: 10 MB
const MAX_PROXY_BYTES = 10 * 1024 * 1024;

// ---- In-memory image cache ----
const IMAGE_CACHE_MAX = 200;
const IMAGE_CACHE_MAX_BYTES = 5 * 1024 * 1024; // cache images up to 5 MB
const IMAGE_CACHE_TTL = 2 * 60 * 60 * 1000;    // 2 hours
const imageCache = new Map();

// Allowlist of domains that the proxy will serve images from.
const ALLOWED_DOMAINS = [
  'upload.wikimedia.org',
  'commons.wikimedia.org',
  'api.gbif.org',
  'www.gbif.org',
  'gbif.org',
  'inaturalist-open-data.s3.amazonaws.com',
  'static.inaturalist.org',
  'plantsp-eflora.bnh.gov.bd',
  'live.staticflickr.com',
  'farm66.staticflickr.com',
  'farm1.staticflickr.com',
  'farm2.staticflickr.com',
  'farm3.staticflickr.com',
  'farm4.staticflickr.com',
  'farm5.staticflickr.com',
  'farm6.staticflickr.com',
  'farm7.staticflickr.com',
  'farm8.staticflickr.com',
  'farm9.staticflickr.com',
  'cdn.download.ams.birds.cornell.edu',
  'download.ams.birds.cornell.edu',
  'media.prothomalo.com',

  // ADD NEW DOMAINS HERE
];

function isPrivateIp(hostname) {
  if (!hostname) return true;
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h === '::1' || h === '0.0.0.0') return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [, a, b] = m.map(Number);
  return a === 10 || a === 127 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function isAllowedDomain(hostname) {
  if (!hostname) return false;
  const h = hostname.toLowerCase();
  return ALLOWED_DOMAINS.some(d => h === d || h.endsWith('.' + d));
}

function validateTargetUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  let u;
  try { u = new URL(rawUrl); } catch { return null; }
  if (!['http:', 'https:'].includes(u.protocol)) return null;
  if (isPrivateIp(u.hostname)) return null;
  if (!isAllowedDomain(u.hostname)) return null;
  return u;
}

/**
 * Derive filename: <name>-ffdb.<ext>
 */
function deriveFilename(targetUrl, nameParam, contentType) {
  let ext = '';
  if (contentType) {
    if (contentType.includes('png')) ext = '.png';
    else if (contentType.includes('webp')) ext = '.webp';
    else if (contentType.includes('gif')) ext = '.gif';
    else if (contentType.includes('svg')) ext = '.svg';
    else if (contentType.includes('avif')) ext = '.avif';
    else ext = '.jpg';
  }
  if (!ext) {
    ext = path.extname(targetUrl.pathname || '').toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.avif'].includes(ext)) ext = '.jpg';
  }

  if (nameParam && nameParam.trim()) {
    let raw = String(nameParam).trim().replace(/\.[a-z0-9]{1,6}$/i, '');
    const safe = raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
    return safe.endsWith('-ffdb') ? `${safe}${ext}` : `${safe}-ffdb${ext}`;
  }

  const basename = path.basename(targetUrl.pathname || '', ext)
    .replace(/[^a-z0-9_-]/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return `${basename || 'image'}-ffdb${ext}`;
}

/**
 * Fetch with a single timeout. No retries — keep it simple and fast.
 * If upstream is slow, fail fast so the frontend fallback kicks in.
 */
async function fetchImage(targetUrl) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

  try {
    const response = await fetch(targetUrl.toString(), {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'FFDB-ImageProxy/1.0',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Fetch an image URL, buffer the full response, return { buffer, contentType }.
 */
async function fetchAndBuffer(targetUrl) {
  const response = await fetchImage(targetUrl);

  if (!response.ok) {
    const err = new Error(`HTTP ${response.status}`);
    err.statusCode = response.status;
    throw err;
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) {
    const err = new Error('NOT_IMAGE');
    err.statusCode = 415;
    throw err;
  }

  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_PROXY_BYTES) {
    const err = new Error('TOO_LARGE');
    err.statusCode = 413;
    throw err;
  }

  // Buffer the full response (no streaming — simple and reliable)
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length > MAX_PROXY_BYTES) {
    const err = new Error('TOO_LARGE');
    err.statusCode = 413;
    throw err;
  }

  return { buffer, contentType };
}

// ---- In-flight deduplication ----
// If 4 images on a page share the same URL, only 1 upstream fetch happens.
const inflightMap = new Map();

function sendImage(res, buffer, contentType, filename, cacheStatus) {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Length', String(buffer.length));
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('X-Cache', cacheStatus);
  return res.end(buffer);
}

function sendError(res, statusCode, message) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(statusCode).json({ success: false, message });
}

async function imageProxyHandler(req, res) {
  const targetUrl = validateTargetUrl(req.query.url);
  if (!targetUrl) return sendError(res, 400, 'Invalid or disallowed image URL');

  const cacheKey = targetUrl.toString();
  const requestedName = (req.params && req.params.filename) || req.query.name || null;

  // ---- Serve from memory cache ----
  const cached = imageCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < IMAGE_CACHE_TTL)) {
    const fn = deriveFilename(targetUrl, requestedName, cached.contentType);
    return sendImage(res, cached.buffer, cached.contentType, fn, 'HIT');
  }
  if (cached) imageCache.delete(cacheKey); // expired

  try {
    // ---- Deduplicate: if already fetching this URL, wait for it ----
    let promise = inflightMap.get(cacheKey);
    if (!promise) {
      promise = fetchAndBuffer(targetUrl).finally(() => inflightMap.delete(cacheKey));
      inflightMap.set(cacheKey, promise);
    }

    const result = await promise;

    // Store in memory cache
    if (result.buffer.length <= IMAGE_CACHE_MAX_BYTES) {
      if (imageCache.size >= IMAGE_CACHE_MAX) {
        const oldest = imageCache.keys().next().value;
        imageCache.delete(oldest);
      }
      imageCache.set(cacheKey, {
        buffer: result.buffer,
        contentType: result.contentType,
        timestamp: Date.now(),
      });
    }

    const fn = deriveFilename(targetUrl, requestedName, result.contentType);
    return sendImage(res, result.buffer, result.contentType, fn, 'MISS');
  } catch (err) {
    console.error('[ImageProxy]', err.message, cacheKey);
    return sendError(res, err.statusCode || 502, err.message || 'Failed to fetch image');
  }
}

router.get('/image-proxy', imageProxyHandler);
router.get('/image-proxy/:filename', imageProxyHandler);

module.exports = router;