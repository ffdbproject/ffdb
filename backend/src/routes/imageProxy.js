// ============================================================
// FFDB - Flora and Fauna Database of Bangladesh
// Image Proxy Route
// Serves external species images through same-origin URLs so
// Facebook in-app browser and hotlink-protected hosts can load them.
// ============================================================

const express = require('express');
const { Readable } = require('stream');
const net = require('net');

const router = express.Router();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPrivateIp(hostname) {
  if (!hostname) return true;

  const normalized = hostname.toLowerCase();
  if (normalized === 'localhost' || normalized === '::1' || normalized === '0.0.0.0') {
    return true;
  }

  const ipv4Match = normalized.match(/^(\d{1,3})(?:\.(\d{1,3})){3}$/);
  if (!ipv4Match) {
    return false;
  }

  const parts = normalized.split('.').map(Number);
  const [a, b] = parts;

  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;

  return false;
}

function validateTargetUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return null;
  }

  let targetUrl;
  try {
    targetUrl = new URL(rawUrl);
  } catch {
    return null;
  }

  if (!['http:', 'https:'].includes(targetUrl.protocol)) {
    return null;
  }

  if (isPrivateIp(targetUrl.hostname)) {
    return null;
  }

  return targetUrl;
}

async function fetchImageWithRetry(targetUrl, attempts = 3) {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

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

      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status}`);
        if (response.status >= 500 || response.status === 429) {
          if (attempt < attempts) {
            await sleep(250 * attempt);
            continue;
          }
        }
        return response;
      }

      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;
      if (attempt < attempts) {
        await sleep(250 * attempt);
        continue;
      }
    }
  }

  throw lastError || new Error('Failed to fetch image');
}

router.get('/image-proxy', async (req, res) => {
  const targetUrl = validateTargetUrl(req.query.url);

  if (!targetUrl) {
    return res.status(400).json({
      success: false,
      message: 'Invalid image URL',
    });
  }

  try {
    const response = await fetchImageWithRetry(targetUrl, 3);

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: `Upstream image request failed with HTTP ${response.status}`,
      });
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      return res.status(415).json({
        success: false,
        message: 'Upstream content is not an image',
      });
    }

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > 10 * 1024 * 1024) {
      return res.status(413).json({
        success: false,
        message: 'Image is too large to proxy',
      });
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=2592000, stale-while-revalidate=604800');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const upstreamBody = response.body;
    if (!upstreamBody) {
      return res.status(502).json({
        success: false,
        message: 'Upstream image response was empty',
      });
    }

    if (contentLength > 0) {
      res.setHeader('Content-Length', String(contentLength));
    }

    Readable.fromWeb(upstreamBody).pipe(res);
  } catch (err) {
    console.error('[ImageProxy] Failed to fetch image:', err.message);
    return res.status(502).json({
      success: false,
      message: 'Failed to fetch image',
    });
  }
});

module.exports = router;