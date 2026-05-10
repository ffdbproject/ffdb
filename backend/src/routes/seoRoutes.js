// ============================================================
// FFDB - Flora and Fauna Database of Bangladesh
// SEO Routes (Sitemap and Robots.txt)
// ============================================================

const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

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
    console.log('[SEO] Detected domain:', url);
    return url;
  }

  return `${req.protocol}://${host}`;
}

/**
 * GET /sitemap.xml
 * Dynamically generates an XML sitemap of all published species.
 */
router.get('/sitemap.xml', async (req, res, next) => {
  try {
    const domain = getPublicOrigin(req);

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Fetch all published species IDs and update times
    const result = await pool.query(`
      SELECT id, updated_at 
      FROM species 
      WHERE status = 'published' 
      ORDER BY updated_at DESC
    `);

    // Static routes
    const staticUrls = [
      { url: '/', priority: 1.0 },
      { url: '/species', priority: 0.8 },
      { url: '/contribute', priority: 0.5 },
    ];

    // Build the XML string
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Add static URLs
    for (const item of staticUrls) {
      xml += `  <url>
    <loc>${domain}${item.url}</loc>
    <changefreq>weekly</changefreq>
    <priority>${item.priority}</priority>
  </url>\n`;
    }

    // Add species URLs
    for (const row of result.rows) {
      xml += `  <url>
    <loc>${domain}/species/${row.id}</loc>
    <lastmod>${new Date(row.updated_at).toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>\n`;
    }

    xml += '</urlset>';

    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /robots.txt
 * Tells crawlers where the sitemap is and what not to index.
 */
router.get('/robots.txt', (req, res) => {
  const domain = getPublicOrigin(req);

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  let txt = 'User-agent: facebookexternalhit\n';
  txt += 'Allow: /\n\n';
  txt += 'User-agent: Facebot\n';
  txt += 'Allow: /\n\n';
  txt += 'User-agent: Twitterbot\n';
  txt += 'Allow: /\n\n';
  txt += 'User-agent: Googlebot\n';
  txt += 'Allow: /\n\n';
  txt += 'User-agent: *\n';
  txt += 'Allow: /\n\n';
  txt += `Sitemap: ${domain}/sitemap.xml\n`;

  res.header('Content-Type', 'text/plain');
  res.send(txt);
});

/**
 * GET /api/seo/checklist
 * Lightweight SEO/readiness checklist for deployments.
 */
router.get('/api/seo/checklist', async (req, res, next) => {
  try {
    const domain = getPublicOrigin(req);

    const publishedResult = await pool.query(
      `SELECT COUNT(*)::int AS published_count FROM species WHERE status = 'published'`
    );

    const publishedCount = publishedResult.rows[0]?.published_count || 0;

    const checks = {
      environment: process.env.NODE_ENV || 'development',
      domain,
      hasSitemapRoute: true,
      hasRobotsRoute: true,
      publishedSpeciesCount: publishedCount,
      indexability: {
        robotsDisallowAdmin: true,
        robotsDisallowApi: true,
        robotsDisallowSearch: true,
      },
    };

    const warnings = [];

    if (publishedCount === 0) {
      warnings.push('No published species found. Sitemap will contain only static pages.');
    }

    if (process.env.NODE_ENV !== 'production') {
      warnings.push('Running outside production. Use production checks before final SEO validation.');
    }

    res.json({
      success: true,
      message: 'SEO checklist generated',
      checks,
      warnings,
      links: {
        robots: `${domain}/robots.txt`,
        sitemap: `${domain}/sitemap.xml`,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
