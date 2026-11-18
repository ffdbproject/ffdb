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
    articleJsonLd,
    bodyHtml,
  } = meta;

  const safePageTitle = escapeHtml(pageTitle);
  const safeSocialTitle = escapeHtml(socialTitle || pageTitle);
  const safeDescription = escapeHtml(description);
  const safeCanonicalUrl = escapeHtml(canonicalUrl);
  const safeDisplayName = escapeHtml(displayName);
  const safeImageUrl = escapeHtml(imageUrl || fallbackImageUrl || '');

  const injectedHead = `
    <title data-server-rendered="true">${safePageTitle}</title>
    <meta data-server-rendered="true" name="description" content="${safeDescription}">
    <meta data-server-rendered="true" property="og:title" content="${safeSocialTitle}">
    <meta data-server-rendered="true" property="og:description" content="${safeDescription}">
    <meta data-server-rendered="true" property="og:type" content="article">
    <meta data-server-rendered="true" property="og:url" content="${safeCanonicalUrl}">
    <meta data-server-rendered="true" property="og:site_name" content="FFDB">
    <meta data-server-rendered="true" property="og:image" content="${safeImageUrl}">
    <meta data-server-rendered="true" property="og:image:alt" content="${safeDisplayName}">
    <meta data-server-rendered="true" property="og:image:width" content="1200">
    <meta data-server-rendered="true" property="og:image:height" content="630">
    <meta data-server-rendered="true" name="twitter:card" content="summary_large_image">
    <meta data-server-rendered="true" name="twitter:title" content="${safeSocialTitle}">
    <meta data-server-rendered="true" name="twitter:description" content="${safeDescription}">
    <meta data-server-rendered="true" name="twitter:image" content="${safeImageUrl}">
    <meta data-server-rendered="true" name="twitter:image:alt" content="${safeDisplayName}">
    <meta data-server-rendered="true" name="twitter:image:width" content="1024">
    <meta data-server-rendered="true" name="twitter:image:height" content="512">
    <link data-server-rendered="true" rel="canonical" href="${safeCanonicalUrl}">
    <script data-server-rendered="true" type="application/ld+json">${safeJsonLdString(pageJsonLd)}</script>
    <script data-server-rendered="true" type="application/ld+json">${safeJsonLdString(organizationJsonLd)}</script>
    <script data-server-rendered="true" type="application/ld+json">${safeJsonLdString(jsonLd)}</script>
    <script data-server-rendered="true" type="application/ld+json">${safeJsonLdString(breadcrumbJsonLd)}</script>
    <script data-server-rendered="true" type="application/ld+json">${safeJsonLdString(articleJsonLd)}</script>
  `.trim();

  // Remove fallback SEO tags from the SPA shell to avoid duplicate OG/Twitter values.
  let sanitized = templateHtml
    .replace(/<title[^>]*>[\s\S]*?<\/title>\s*/gi, '')
    .replace(/<meta[^>]+property=["']og:[^"']+["'][^>]*>\s*/gi, '')
    .replace(/<meta[^>]+name=["']twitter:[^"']+["'][^>]*>\s*/gi, '')
    .replace(/<meta[^>]+name=["']description["'][^>]*>\s*/gi, '')
    .replace(/<link[^>]+rel=["']canonical["'][^>]*>\s*/gi, '')
    .replace(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>\s*/gi, '');

  if (bodyHtml) {
    sanitized = sanitized.replace(/<div\s+id=["']root["']\s*>\s*<\/div>/i, `<div id="root">\n${bodyHtml}\n</div>`);
  }

  // Replace default title and inject fresh species metadata before closing head.
  return sanitized.replace('</head>', `${injectedHead}\n</head>`);
}

function injectStaticPageMetaIntoHtml(templateHtml, meta) {
  const {
    pageTitle,
    description,
    canonicalUrl,
    pageJsonLd,
    organizationJsonLd,
    noindex,
  } = meta;

  const safePageTitle = escapeHtml(pageTitle);
  const safeDescription = escapeHtml(description);
  const safeCanonicalUrl = escapeHtml(canonicalUrl);

  const injectedHead = `
    <title data-server-rendered="true">${safePageTitle}</title>
    <meta data-server-rendered="true" name="description" content="${safeDescription}">
    <meta data-server-rendered="true" property="og:title" content="${safePageTitle}">
    <meta data-server-rendered="true" property="og:site_name" content="FFDB">
    <meta data-server-rendered="true" property="og:description" content="${safeDescription}">
    <meta data-server-rendered="true" property="og:type" content="website">
    <meta data-server-rendered="true" property="og:url" content="${safeCanonicalUrl}">
    <meta data-server-rendered="true" name="twitter:card" content="summary_large_image">
    <meta data-server-rendered="true" name="twitter:title" content="${safePageTitle}">
    <meta data-server-rendered="true" name="twitter:description" content="${safeDescription}">
    <link data-server-rendered="true" rel="canonical" href="${safeCanonicalUrl}">
    ${noindex ? '<meta data-server-rendered="true" name="robots" content="noindex, follow">' : ''}
    <script data-server-rendered="true" type="application/ld+json">${safeJsonLdString(pageJsonLd)}</script>
    <script data-server-rendered="true" type="application/ld+json">${safeJsonLdString(organizationJsonLd)}</script>
  `.trim();

  const sanitized = templateHtml
    .replace(/<title[^>]*>[\s\S]*?<\/title>/i, '')
    .replace(/<meta[^>]+property=["']og:[^"']+["'][^>]*>\s*/gi, '')
    .replace(/<meta[^>]+name=["']twitter:[^"']+["'][^>]*>\s*/gi, '')
    .replace(/<meta[^>]+name=["']description["'][^>]*>\s*/gi, '')
    .replace(/<link[^>]+rel=["']canonical["'][^>]*>\s*/gi, '')
    .replace(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>\s*/gi, '');

  return sanitized.replace('</head>', `${injectedHead}\n</head>`);
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
  // Always use req.path (never req.originalUrl) so query strings like
  // ?category=flora&page=2 are excluded from the canonical URL.
  const canonicalUrl = `${domain}${req.path}`;

  if (req.path === '/species') {
    // Filtered/paginated variants should not be indexed as separate pages.
    const q = req.query || {};
    const hasFilters = !!(
      (q.page && parseInt(q.page, 10) > 1) ||
      q.category || q.origin || q.residency_status || q.conservation_status ||
      q.kingdom || q.phylum || q.class || q.order || q.family || q.genus
    );
    return {
      pageTitle: 'Browse Species - FFDB',
      description: 'Browse the complete catalog of flora and fauna species in Bangladesh. Filter by category and conservation status.',
      canonicalUrl: `${domain}/species`,
      noindex: hasFilters,
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
      s.category,
      s.created_at,
      s.updated_at,
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
  let displayName = '';
  if (s.english_name && s.bengali_name) {
    displayName = `${s.english_name} (${s.bengali_name})`;
  } else if (s.english_name) {
    displayName = s.english_name;
  } else if (s.bengali_name) {
    displayName = s.bengali_name;
  } else {
    displayName = s.scientific_name || `Species ${id}`;
  }
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

  // Article schema for Google Rich Results
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `${displayName} - FFDB`,
    name: schemaName,
    description: descriptionSnippet,
    url: `${domain}/species/${id}`,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${domain}/species/${id}`,
    },
    image: socialImageUrl ? [socialImageUrl] : undefined,
    author: {
      '@type': 'Organization',
      name: 'FFDB',
      url: `${domain}/`,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Flora and Fauna Database of Bangladesh',
      logo: {
        '@type': 'ImageObject',
        url: `${domain}/logo.png`,
      },
    },
    datePublished: s.created_at ? new Date(s.created_at).toISOString() : undefined,
    dateModified: s.updated_at ? new Date(s.updated_at).toISOString() : (s.created_at ? new Date(s.created_at).toISOString() : undefined),
    articleSection: s.category === 'flora' ? 'Flora' : (s.category === 'fauna' ? 'Fauna' : 'Species'),
    keywords: [s.english_name, s.bengali_name, s.scientific_name, 'Bangladesh', 'biodiversity'].filter(Boolean).join(', '),
    about: {
      '@type': 'Taxon',
      name: s.scientific_name,
    },
  };

  const title = `${displayName} - FFDB`;
  const socialTitle = displayName;
  const canonicalUrl = `${domain}/species/${id}`;
  const safeDisplayName = escapeHtml(displayName);

  const bodyHtml = `
    <div class="app">
      <main>
        <div class="page-enter container species-detail" id="species-detail-page">
          <div class="species-breadcrumb">
            <a href="/">Home</a> / <a href="/species">Species</a> / <span>${safeDisplayName}</span>
          </div>
          <div class="species-detail-header">
            ${socialImageUrl ? `<div class="species-detail-image-wrap"><img alt="Photo of ${safeDisplayName}" src="${socialImageUrl}" style="width: 100%; height: auto; display: block;" /></div>` : ''}
            <div class="species-detail-info">
              <h1>${safeDisplayName}</h1>
              ${s.bengali_name ? `<p class="species-detail-bengali">${escapeHtml(s.bengali_name)}</p>` : ''}
              <p class="species-detail-scientific">${escapeHtml(s.scientific_name)}</p>
              <div class="species-detail-badges">
                <span class="species-card-category ${escapeHtml(s.category || '')}">${escapeHtml(s.category || 'Species')}</span>
                ${s.conservation_status ? `<span class="conservation-badge ${escapeHtml(s.conservation_status.toLowerCase())}">${escapeHtml(s.conservation_status)}</span>` : ''}
              </div>
              ${plainDescription ? `<div class="species-detail-description">${escapeHtml(plainDescription)}</div>` : ''}
              ${s.conservation_status ? `<div style="margin-bottom: 16px;"><strong style="font-size: 12px; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px;">Conservation Status</strong><p style="color: var(--text-secondary); font-size: 14px; margin-top: 4px;">${escapeHtml(s.conservation_status)}</p></div>` : ''}
              ${s.habitat ? `<div style="margin-bottom: 20px;"><strong style="font-size: 12px; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px;">Habitat</strong><p style="color: var(--text-secondary); font-size: 14px; margin-top: 4px;">${escapeHtml(s.habitat)}</p></div>` : ''}
            </div>
          </div>
          ${s.kingdom || s.phylum || s.class || s.order || s.family || s.genus ? `
          <div class="section-header"><h2>Taxonomy</h2></div>
          <table class="taxonomy-table" id="taxonomy-table">
            <tbody>
              ${s.kingdom ? `<tr><td>Kingdom</td><td>${escapeHtml(s.kingdom)}</td></tr>` : ''}
              ${s.phylum ? `<tr><td>Phylum</td><td>${escapeHtml(s.phylum)}</td></tr>` : ''}
              ${s.class ? `<tr><td>Class</td><td>${escapeHtml(s.class)}</td></tr>` : ''}
              ${s.order ? `<tr><td>Order</td><td>${escapeHtml(s.order)}</td></tr>` : ''}
              ${s.family ? `<tr><td>Family</td><td>${escapeHtml(s.family)}</td></tr>` : ''}
              ${s.genus ? `<tr><td>Genus</td><td style="font-style: italic;">${escapeHtml(s.genus)}</td></tr>` : ''}
              <tr><td>Species</td><td style="font-style: italic;">${escapeHtml(s.scientific_name)}</td></tr>
            </tbody>
          </table>` : ''}
        </div>
      </main>
    </div>
  `.trim();

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
    articleJsonLd,
    bodyHtml,
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

  const homeBodyHtml = `
    <div class="app">
      <main>
        <div class="page-enter" id="home-page">
          <section class="hero">
            <div class="hero-content">
              <h1>
                Flora and Fauna Database of <span class="highlight">Bangladesh</span> (FFDB)
              </h1>
              <p>
                Explore the rich biodiversity of Bangladesh, from iconic wildlife to native and exotic plants found across forests, rivers, and wetlands. A centralized, authoritative database for researchers, students, and conservationists.
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  `.trim();

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
      bodyHtml: homeBodyHtml,
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
    bodyHtml,
  } = meta;

  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeCanonicalUrl = escapeHtml(canonicalUrl);
  const safeSocialTitle = escapeHtml(socialTitle || title);
  const safeSocialDescription = escapeHtml(socialDescription || description);
  const safeImageUrl = escapeHtml(imageUrl || '');
  const safeDisplayName = escapeHtml(displayName || title);

  const injectedHead = `
    <title data-server-rendered="true">${safeTitle}</title>
    <meta data-server-rendered="true" name="description" content="${safeDescription}">
    <meta data-server-rendered="true" property="og:title" content="${safeSocialTitle}">
    <meta data-server-rendered="true" property="og:site_name" content="FFDB">
    <meta data-server-rendered="true" property="og:description" content="${safeSocialDescription}">
    <meta data-server-rendered="true" property="og:type" content="website">
    <meta data-server-rendered="true" property="og:url" content="${safeCanonicalUrl}">
    <meta data-server-rendered="true" property="og:image" content="${safeImageUrl}">
    <meta data-server-rendered="true" property="og:image:alt" content="${safeDisplayName}">
    <meta data-server-rendered="true" property="og:image:width" content="1200">
    <meta data-server-rendered="true" property="og:image:height" content="630">
    <meta data-server-rendered="true" name="twitter:card" content="summary_large_image">
    <meta data-server-rendered="true" name="twitter:title" content="${safeSocialTitle}">
    <meta data-server-rendered="true" name="twitter:description" content="${safeSocialDescription}">
    <meta data-server-rendered="true" name="twitter:image" content="${safeImageUrl}">
    <meta data-server-rendered="true" name="twitter:image:alt" content="${safeDisplayName}">
    <meta data-server-rendered="true" name="twitter:image:width" content="1024">
    <meta data-server-rendered="true" name="twitter:image:height" content="512">
    <link data-server-rendered="true" rel="canonical" href="${safeCanonicalUrl}">
    <script data-server-rendered="true" type="application/ld+json">${safeJsonLdString(websiteJsonLd)}</script>
    <script data-server-rendered="true" type="application/ld+json">${safeJsonLdString(organizationJsonLd)}</script>
  `.trim();

  let sanitized = templateHtml
    .replace(/<title[^>]*>[\s\S]*?<\/title>\s*/gi, '')
    .replace(/<meta[^>]+property=["']og:[^"']+["'][^>]*>\s*/gi, '')
    .replace(/<meta[^>]+name=["']twitter:[^"']+["'][^>]*>\s*/gi, '')
    .replace(/<meta[^>]+name=["']description["'][^>]*>\s*/gi, '')
    .replace(/<link[^>]+rel=["']canonical["'][^>]*>\s*/gi, '')
    .replace(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>\s*/gi, '');

  if (bodyHtml) {
    sanitized = sanitized.replace(/<div\s+id=["']root["']\s*>\s*<\/div>/i, `<div id="root">\n${bodyHtml}\n</div>`);
  }

  return sanitized.replace('</head>', `${injectedHead}\n</head>`);
}

module.exports = prerenderMiddleware;
module.exports.generateSpeciesHtml = generateSpeciesHtml;
module.exports.generateHomeHtml = generateHomeHtml;
