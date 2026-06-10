// ============================================================
// FFDB - Flora and Fauna Database of Bangladesh
// SEO Routes (Sitemap and Robots.txt)
// ============================================================

const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { getPublicOrigin } = require('../utils/origin');

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
    res.header('Content-Type', 'application/xml');

    // Stream XML to avoid loading all species into a single string
    res.write('<?xml version="1.0" encoding="UTF-8"?>\n');
    res.write('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n');

    // Static routes with lastmod for better crawl scheduling
    const today = new Date().toISOString().split('T')[0];
    const staticUrls = [
      { url: '/', priority: 1.0, lastmod: today },
      { url: '/species', priority: 0.8, lastmod: today },
      { url: '/contribute', priority: 0.5 },
      { url: '/about', priority: 0.4 },
      { url: '/team', priority: 0.3 },
      { url: '/api-docs', priority: 0.3 },
    ];

    for (const item of staticUrls) {
      res.write(`  <url>
    <loc>${domain}${item.url}</loc>${item.lastmod ? `
    <lastmod>${item.lastmod}</lastmod>` : ''}
    <changefreq>weekly</changefreq>
    <priority>${item.priority}</priority>
  </url>\n`);
    }

    // Stream species URLs in batches to limit peak memory
    const BATCH_SIZE = 500;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const result = await pool.query(
        `SELECT id, updated_at FROM species WHERE status = 'published' ORDER BY updated_at DESC LIMIT $1 OFFSET $2`,
        [BATCH_SIZE, offset]
      );

      for (const row of result.rows) {
        res.write(`  <url>
    <loc>${domain}/species/${row.id}</loc>
    <lastmod>${new Date(row.updated_at).toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>\n`);
      }

      hasMore = result.rows.length === BATCH_SIZE;
      offset += BATCH_SIZE;
    }

    res.write('</urlset>');
    res.end();
  } catch (err) {
    if (!res.headersSent) {
      next(err);
    } else {
      res.end();
      console.error('[SEO] Sitemap streaming error:', err.message);
    }
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
  txt += 'Allow: /\n';
  txt += 'Disallow: /admin\n';
  txt += 'Disallow: /api/\n\n';
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

    // Only expose safe, non-sensitive information
    const checks = {
      hasSitemapRoute: true,
      hasRobotsRoute: true,
      publishedSpeciesCount: publishedCount,
    };

    const warnings = [];

    if (publishedCount === 0) {
      warnings.push('No published species found. Sitemap will contain only static pages.');
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
