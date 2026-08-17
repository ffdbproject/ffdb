// ============================================================
// FFDB - Flora and Fauna Database of Bangladesh
// Bot/Scraper Prerender Middleware
//
// For species detail routes, inject SEO metadata directly into
// the built SPA HTML shell so both bots and metadata validators
// can read OG/Twitter/JSON-LD without executing JavaScript.
// ============================================================

const fsp = require('fs/promises');
const path = require('path');
const { pool } = require('../config/db');
const { getPublicOrigin } = require('../utils/origin');

const INDEX_HTML_PATH = path.join(__dirname, '..', '..', '..', 'frontend', 'dist', 'index.html');
let cachedIndexTemplate = null;

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

  // For OG/Twitter meta tags, use the DIRECT image URL.
  // Facebook/WhatsApp/Twitter scrapers can fetch from Wikipedia directly —
  // the proxy is only needed for the in-app browser (referrer issues),
  // not for metadata scraping.
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }

  return imageUrl.startsWith('/') ? `${domain}${imageUrl}` : `${domain}/${imageUrl}`;
}

async function getIndexTemplate() {
  if (cachedIndexTemplate) return cachedIndexTemplate;
  cachedIndexTemplate = await fsp.readFile(INDEX_HTML_PATH, 'utf8');
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
    pageJsonLd,
    organizationJsonLd,
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
    <script type="application/ld+json">${safeJsonLdString(pageJsonLd)}</script>
    <script type="application/ld+json">${safeJsonLdString(organizationJsonLd)}</script>
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

function injectStaticPageMetaIntoHtml(templateHtml, meta) {
  const {
    pageTitle,
    description,
    canonicalUrl,
    pageJsonLd,
    organizationJsonLd,
  } = meta;

  const safePageTitle = escapeHtml(pageTitle);
  const safeDescription = escapeHtml(description);
  const safeCanonicalUrl = escapeHtml(canonicalUrl);

  const injectedHead = `
    <title>${safePageTitle}</title>
    <meta name="description" content="${safeDescription}">
    <meta property="og:title" content="${safePageTitle}">
    <meta property="og:site_name" content="FFDB">
    <meta property="og:description" content="${safeDescription}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${safeCanonicalUrl}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${safePageTitle}">
    <meta name="twitter:description" content="${safeDescription}">
    <link rel="canonical" href="${safeCanonicalUrl}">
    <script type="application/ld+json">${safeJsonLdString(pageJsonLd)}</script>
    <script type="application/ld+json">${safeJsonLdString(organizationJsonLd)}</script>
  `.trim();

  const sanitized = templateHtml
    .replace(/<meta[^>]+property=["']og:[^"']+["'][^>]*>\s*/gi, '')
    .replace(/<meta[^>]+name=["']twitter:[^"']+["'][^>]*>\s*/gi, '')
    .replace(/<meta[^>]+name=["']description["'][^>]*>\s*/gi, '')
    .replace(/<link[^>]+rel=["']canonical["'][^>]*>\s*/gi, '')
    .replace(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>\s*/gi, '');

  const withTitle = sanitized.replace(/<title[^>]*>[\s\S]*?<\/title>/i, `<title>${safePageTitle}</title>`);
  return withTitle.replace('</head>', `${injectedHead}\n</head>`);
}

async function prerenderMiddleware(req, res, next) {
  if (req.method !== 'GET' || process.env.NODE_ENV !== 'production') {
    return next();
  }

  // Allow numeric IDs and also alphanumeric `public_id` values (no slashes),
  // and accept an optional trailing slash.
  const speciesMatch = req.path.match(/^\/species\/([^\/]+)\/?$/);

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

  // Always prerender homepage so its source includes SEO metadata and JSON-LD.
  if (req.path === '/' || req.path === '/index.html' || req.path === '') {
    res.send(await generateHomeHtml(req));
    return;
  }

  const staticPageMeta = getStaticPageMeta(req);
  if (staticPageMeta) {
    try {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.send(await generateStaticPageHtml(req, staticPageMeta));
      return;
    } catch (err) {
      console.error(`[Prerender] Failed to inject static page meta for ${req.path}:`, err.message);
      return next();
    }
  }

  next();
}

function getStaticPageMeta(req) {
  const domain = getPublicOrigin(req);
  const canonicalUrl = `${domain}${req.originalUrl || req.path}`;

  if (req.path === '/species') {
    return {
      pageTitle: 'Browse Species - FFDB',
      description: 'Browse the complete catalog of flora and fauna species in Bangladesh.',
      canonicalUrl,
      pageJsonLd: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Browse Species - FFDB',
        url: canonicalUrl,
        description: 'Browse the complete catalog of flora and fauna species in Bangladesh.',
      },
      organizationJsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'FFDB',
        alternateName: 'Flora and Fauna Database of Bangladesh',
        url: `${domain}/`,
        logo: `${domain}/logo.png`,
      },
    };
  }

  if (req.path === '/search') {
    const query = (req.query && req.query.q ? String(req.query.q).trim() : '');
    return {
      pageTitle: query ? `Search: "${query}" - FFDB` : 'Search Species - FFDB',
      description: query
        ? `Search results for ${query} in the Flora and Fauna Database of Bangladesh.`
        : 'Search species in the Flora and Fauna Database of Bangladesh.',
      canonicalUrl,
      pageJsonLd: {
        '@context': 'https://schema.org',
        '@type': 'SearchResultsPage',
        name: query ? `Search: "${query}" - FFDB` : 'Search Species - FFDB',
        url: canonicalUrl,
        description: query
          ? `Search results for ${query} in the Flora and Fauna Database of Bangladesh.`
          : 'Search species in the Flora and Fauna Database of Bangladesh.',
      },
      organizationJsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'FFDB',
        alternateName: 'Flora and Fauna Database of Bangladesh',
        url: `${domain}/`,
        logo: `${domain}/logo.png`,
      },
    };
  }

  const pageMap = {
    '/about': {
      title: 'About - FFDB',
      description: 'Learn about Flora and Fauna Database of Bangladesh, our mission, vision, history, and conservation efforts.',
    },
    '/team': {
      title: 'Team - FFDB',
      description: 'Meet the FFDB team maintaining Bangladesh biodiversity data.',
    },
    '/contribute': {
      title: 'Contribute Data - FFDB',
      description: 'Contribute new species data to the Flora and Fauna Database of Bangladesh.',
    },
    '/report-problem': {
      title: 'Report a Problem - FFDB',
      description: 'Report any issues or problems you encounter on the Flora and Fauna Database of Bangladesh.',
    },
    '/api-docs': {
      title: 'API Docs - FFDB',
      description: 'Public API documentation for the Flora and Fauna Database of Bangladesh.',
    },
  };

  const page = pageMap[req.path];
  if (!page) return null;

  return {
    pageTitle: page.title,
    description: page.description,
    canonicalUrl,
    pageJsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: page.title,
      url: canonicalUrl,
      description: page.description,
    },
    organizationJsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'FFDB',
      alternateName: 'Flora and Fauna Database of Bangladesh',
      url: `${domain}/`,
      logo: `${domain}/logo.png`,
    },
  };
}

async function generateStaticPageHtml(req, meta) {
  const template = await getIndexTemplate();
  return injectStaticPageMetaIntoHtml(template, meta);
}

async function generateSpeciesHtml(id, req) {
  // IMPORTANT: Public URLs use `public_id`, not the internal auto-increment `id`.
  // This must match the speciesController logic which does:
  //   WHERE s.public_id = $1 AND s.status = 'published'
  const result = await pool.query(
    `SELECT
      s.public_id,
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
    WHERE s.public_id = $1 AND s.status = 'published'`,
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
  // Strip HTML tags from description (descriptions may contain <p>, <b>, etc.)
  const plainDescription = s.description
    ? s.description.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
    : '';
  const descriptionSnippet = plainDescription
    ? plainDescription.substring(0, 160)
    : `Detailed information about ${displayName} (${s.scientific_name}) in Bangladesh.`;

  const schemaName = (s.english_name && s.bengali_name)
    ? `${s.english_name} (${s.bengali_name})`
    : displayName;

  const pageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: schemaName,
    headline: schemaName,
    url: `${domain}/species/${id}`,
    description: descriptionSnippet,
  };

  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'FFDB',
    alternateName: 'Flora and Fauna Database of Bangladesh',
    url: `${domain}/`,
    logo: `${domain}/logo.png`,
  };

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Taxon',
    name: s.scientific_name,
    alternateName: [s.english_name, s.bengali_name].filter(Boolean),
    description: plainDescription || undefined,
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

  const title = `${displayName} - FFDB`;
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
    pageJsonLd,
    organizationJsonLd,
    jsonLd,
    breadcrumbJsonLd,
  });
}

async function generateHomeHtml(req) {
  const domain = getPublicOrigin(req);
  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'FFDB',
    alternateName: 'Flora and Fauna Database of Bangladesh',
    url: `${domain}/`,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${domain}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'FFDB',
    alternateName: 'Flora and Fauna Database of Bangladesh',
    url: `${domain}/`,
    logo: `${domain}/logo.png`,
  };

  const template = await getIndexTemplate();

  return injectHomeMetaIntoHtml(
    template,
    {
      title: 'Flora and Fauna Database of Bangladesh',
      description: 'Explore the rich biodiversity of Bangladesh. A centralized, authoritative database for researchers, students, and conservationists.',
      canonicalUrl: `${domain}/`,
      socialTitle: 'Flora and Fauna Database of Bangladesh',
      socialDescription: 'Explore the rich biodiversity of Bangladesh. A centralized, authoritative database for researchers, students, and conservationists.',
      imageUrl: `${domain}/og-fallback.png`,
      displayName: 'Flora and Fauna Database of Bangladesh',
      websiteJsonLd,
      organizationJsonLd,
    }
  );
}

function injectHomeMetaIntoHtml(templateHtml, meta) {
  const {
    title,
    description,
    canonicalUrl,
    socialTitle,
    socialDescription,
    imageUrl,
    displayName,
    websiteJsonLd,
    organizationJsonLd,
  } = meta;

  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeCanonicalUrl = escapeHtml(canonicalUrl);
  const safeSocialTitle = escapeHtml(socialTitle || title);
  const safeSocialDescription = escapeHtml(socialDescription || description);
  const safeImageUrl = escapeHtml(imageUrl || '');
  const safeDisplayName = escapeHtml(displayName || title);

  const injectedHead = `
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDescription}">
    <meta property="og:title" content="${safeSocialTitle}">
    <meta property="og:site_name" content="FFDB">
    <meta property="og:description" content="${safeSocialDescription}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${safeCanonicalUrl}">
    <meta property="og:image" content="${safeImageUrl}">
    <meta property="og:image:alt" content="${safeDisplayName}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${safeSocialTitle}">
    <meta name="twitter:description" content="${safeSocialDescription}">
    <meta name="twitter:image" content="${safeImageUrl}">
    <meta name="twitter:image:alt" content="${safeDisplayName}">
    <meta name="twitter:image:width" content="1024">
    <meta name="twitter:image:height" content="512">
    <link rel="canonical" href="${safeCanonicalUrl}">
    <script type="application/ld+json">${safeJsonLdString(websiteJsonLd)}</script>
    <script type="application/ld+json">${safeJsonLdString(organizationJsonLd)}</script>
  `.trim();

  const sanitized = templateHtml
    .replace(/<meta[^>]+property=["']og:[^"']+["'][^>]*>\s*/gi, '')
    .replace(/<meta[^>]+name=["']twitter:[^"']+["'][^>]*>\s*/gi, '')
    .replace(/<meta[^>]+name=["']description["'][^>]*>\s*/gi, '')
    .replace(/<link[^>]+rel=["']canonical["'][^>]*>\s*/gi, '')
    .replace(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>\s*/gi, '');

  const withTitle = sanitized.replace(/<title[^>]*>[\s\S]*?<\/title>/i, `<title>${safeTitle}</title>`);
  return withTitle.replace('</head>', `${injectedHead}\n</head>`);
}

module.exports = prerenderMiddleware;
module.exports.generateSpeciesHtml = generateSpeciesHtml;
module.exports.generateHomeHtml = generateHomeHtml;
