// ============================================================
// FFDB - Flora and Fauna Database of Bangladesh
// Bot/Scraper Prerender Middleware
//
// For species detail routes, inject SEO metadata directly into
// the built SPA HTML shell so both bots and metadata validators
// can read OG/Twitter/JSON-LD without executing JavaScript.
// ============================================================

const fs = require('fs/promises');
const path = require('path');
const { pool } = require('../config/db');

// Lightweight regex to detect common bots
const BOT_USER_AGENTS = /bot|crawler|spider|crawling|facebookexternalhit|facebot|twitterbot|slackbot|linkedinbot|discordbot|applebot|whatsapp|telegrambot/i;

const INDEX_HTML_PATH = path.join(__dirname, '..', '..', '..', 'frontend', 'dist', 'index.html');
let cachedIndexTemplate = null;

function getPublicOrigin(req) {
  const configuredOrigin = process.env.PUBLIC_SITE_URL || process.env.SITE_URL || '';
  if (configuredOrigin) {
    return configuredOrigin.replace(/\/$/, '');
  }

  const forwardedHost = (req.get('x-forwarded-host') || '').split(',')[0].trim();
  const host = forwardedHost || req.get('host') || req.hostname;
  if (!host) {
    return process.env.NODE_ENV === 'production' ? 'https://localhost' : 'http://localhost:5173';
  }

  if (process.env.NODE_ENV === 'production') {
    const forwardedProto = (req.get('x-forwarded-proto') || 'https').split(',')[0].trim();
    const protocol = forwardedProto === 'http' ? 'http' : 'https';
    return `${protocol}://${host}`;
  }

  return `${req.protocol}://${host}`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeJsonLdString(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function resolvePublicImageUrl(imageUrl, domain) {
  if (!imageUrl) {
    return '';
  }

  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return `${domain}/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
  }

  return imageUrl.startsWith('/') ? `${domain}${imageUrl}` : `${domain}/${imageUrl}`;
}

async function getIndexTemplate() {
  if (cachedIndexTemplate) return cachedIndexTemplate;
  cachedIndexTemplate = await fs.readFile(INDEX_HTML_PATH, 'utf8');
  return cachedIndexTemplate;
}

function injectSpeciesMetaIntoHtml(templateHtml, meta) {
  const {
    pageTitle,
    socialTitle,
    description,
    canonicalUrl,
    imageUrl,
    fallbackImageUrl,
    displayName,
    jsonLd,
    breadcrumbJsonLd,
  } = meta;

  const safePageTitle = escapeHtml(pageTitle);
  const safeSocialTitle = escapeHtml(socialTitle || pageTitle);
  const safeDescription = escapeHtml(description);
  const safeCanonicalUrl = escapeHtml(canonicalUrl);
  const safeDisplayName = escapeHtml(displayName);
  const safeImageUrl = escapeHtml(imageUrl || fallbackImageUrl || '');

  const injectedHead = `
    <title>${safePageTitle}</title>
    <meta name="description" content="${safeDescription}">
    <meta property="og:title" content="${safeSocialTitle}">
    <meta property="og:description" content="${safeDescription}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="${safeCanonicalUrl}">
    <meta property="og:site_name" content="FFDB">
    <meta property="og:image" content="${safeImageUrl}">
    <meta property="og:image:alt" content="${safeDisplayName}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${safeSocialTitle}">
    <meta name="twitter:description" content="${safeDescription}">
    <meta name="twitter:image" content="${safeImageUrl}">
    <meta name="twitter:image:alt" content="${safeDisplayName}">
    <meta name="twitter:image:width" content="1024">
    <meta name="twitter:image:height" content="512">
    <link rel="canonical" href="${safeCanonicalUrl}">
    <script type="application/ld+json">${safeJsonLdString(jsonLd)}</script>
    <script type="application/ld+json">${safeJsonLdString(breadcrumbJsonLd)}</script>
  `.trim();

  // Remove fallback SEO tags from the SPA shell to avoid duplicate OG/Twitter values.
  const sanitized = templateHtml
    .replace(/<meta[^>]+property=["']og:[^"']+["'][^>]*>\s*/gi, '')
    .replace(/<meta[^>]+name=["']twitter:[^"']+["'][^>]*>\s*/gi, '')
    .replace(/<meta[^>]+name=["']description["'][^>]*>\s*/gi, '')
    .replace(/<link[^>]+rel=["']canonical["'][^>]*>\s*/gi, '')
    .replace(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>\s*/gi, '');

  // Replace default title and inject fresh species metadata before closing head.
  const withTitle = sanitized.replace(/<title[^>]*>[\s\S]*?<\/title>/i, `<title>${safePageTitle}</title>`);
  return withTitle.replace('</head>', `${injectedHead}\n</head>`);
}

async function prerenderMiddleware(req, res, next) {
  if (req.method !== 'GET' || process.env.NODE_ENV !== 'production') {
    return next();
  }

  const speciesMatch = req.path.match(/^\/species\/(\d+)$/);

  // Always inject species metadata for /species/:id so OG/Twitter/Schema
  // validators work even when they do not execute JS or identify as bots.
  if (speciesMatch) {
    const speciesId = speciesMatch[1];
    try {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.send(await generateSpeciesHtml(speciesId, req));
      return;
    } catch (err) {
      console.error(`[Prerender] Failed to inject species meta ${speciesId}:`, err.message);
      return next();
    }
  }

  // Keep homepage lightweight prerender for major bots only.
  const userAgent = req.headers['user-agent'] || '';
  const isBot = BOT_USER_AGENTS.test(userAgent);

  if (isBot && (req.path === '/' || req.path === '/index.html' || req.path === '')) {
    res.send(generateHomeHtml(req));
    return;
  }

  next();
}

async function generateSpeciesHtml(id, req) {
  const result = await pool.query(
    `SELECT
      s.scientific_name,
      s.english_name,
      s.bengali_name,
      s.description,
      s.habitat,
      s.conservation_status,
      t.kingdom, t.phylum, t.class, t."order", t.family, t.genus,
      i.image_url
    FROM species s
    LEFT JOIN taxonomy t ON t.species_id = s.id
    LEFT JOIN images i ON i.species_id = s.id AND i.is_primary = TRUE
    WHERE s.id = $1 AND s.status = 'published'`,
    [id]
  );

  if (result.rows.length === 0) {
    throw new Error('Species not found or not published');
  }

  const s = result.rows[0];
  const displayName = s.english_name || s.bengali_name || s.scientific_name;
  const domain = getPublicOrigin(req);
  const imageUrl = resolvePublicImageUrl(s.image_url, domain);
  const fallbackImageUrl = `${domain}/og-fallback.png`;
  const socialImageUrl = imageUrl || fallbackImageUrl;
  const descriptionSnippet = s.description
    ? s.description.substring(0, 160)
    : `Detailed information about ${displayName} (${s.scientific_name}) in Bangladesh.`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Taxon',
    name: s.scientific_name,
    alternateName: [s.english_name, s.bengali_name].filter(Boolean),
    description: s.description,
    image: socialImageUrl,
    url: `${domain}/species/${id}`,
    identifier: String(id),
    taxonRank: 'Species',
  };
  
  // Add genus as parent taxon if available
  if (s.genus) {
    jsonLd.parentTaxon = {
      '@type': 'Taxon',
      name: s.genus,
      taxonRank: 'Genus',
    };
  }
  
  // Add IUCN conservation status
  if (s.conservation_status) {
    jsonLd.additionalProperty = {
      '@type': 'PropertyValue',
      name: 'IUCN Status',
      value: s.conservation_status,
    };
  }

  // BreadcrumbList schema for Google Rich Results
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: `${domain}/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Species',
        item: `${domain}/species`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: displayName,
        item: `${domain}/species/${id}`,
      },
    ],
  };

  const title = `${displayName} | FFDB`;
  const socialTitle = displayName;
  const canonicalUrl = `${domain}/species/${id}`;

  const template = await getIndexTemplate();
  return injectSpeciesMetaIntoHtml(template, {
    pageTitle: title,
    socialTitle,
    description: descriptionSnippet,
    canonicalUrl,
    imageUrl: socialImageUrl,
    fallbackImageUrl,
    displayName,
    jsonLd,
    breadcrumbJsonLd,
  });
}

function generateHomeHtml(req) {
  const domain = getPublicOrigin(req);
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>Flora and Fauna Database of Bangladesh</title>
      <meta name="description" content="Explore the rich biodiversity of Bangladesh. A centralized, authoritative database for researchers, students, and conservationists.">
      <meta property="og:title" content="Flora and Fauna Database of Bangladesh">
      <meta property="og:description" content="Explore the rich biodiversity of Bangladesh. A centralized, authoritative database for researchers, students, and conservationists.">
      <meta property="og:type" content="website">
      <meta property="og:url" content="${domain}/">
      <meta property="og:image" content="${domain}/og-fallback.png">
      <meta property="og:image:alt" content="Flora and Fauna Database of Bangladesh">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="Flora and Fauna Database of Bangladesh">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:image" content="${domain}/og-fallback.png">
    <meta name="twitter:image:alt" content="Flora and Fauna Database of Bangladesh">
    <meta name="twitter:image:width" content="1024">
    <meta name="twitter:image:height" content="512">
      <meta name="twitter:title" content="Flora and Fauna Database of Bangladesh">
      <meta name="twitter:description" content="Explore the rich biodiversity of Bangladesh. A centralized, authoritative database for researchers, students, and conservationists.">
      <meta name="twitter:image" content="${domain}/og-fallback.png">
      <meta name="twitter:image:alt" content="Flora and Fauna Database of Bangladesh">
      <link rel="canonical" href="${domain}/">
    </head>
    <body>
      <h1>Flora and Fauna Database of Bangladesh (FFDB)</h1>
      <p>Explore the rich biodiversity of Bangladesh. A centralized, authoritative database for researchers, students, and conservationists.</p>
    </body>
    </html>
  `;
}

module.exports = prerenderMiddleware;
module.exports.generateSpeciesHtml = generateSpeciesHtml;
module.exports.generateHomeHtml = generateHomeHtml;
