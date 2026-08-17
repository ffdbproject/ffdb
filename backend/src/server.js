// ============================================================
// FFDB - Flora and Fauna Database of Bangladesh
// Express Server Entry Point
// ============================================================

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// 🔒 SECURITY: Validate required environment variables in production
if (process.env.NODE_ENV === 'production') {
  const requiredEnvVars = ['ADMIN_API_KEY', 'JWT_SECRET', 'DB_PASSWORD', 'DB_USER', 'DB_HOST', 'DB_NAME'];
  const missingVars = requiredEnvVars.filter(v => !process.env[v]);

  if (missingVars.length > 0) {
    console.error('\n❌ [CRITICAL] Missing required environment variables in production:');
    missingVars.forEach(v => console.error(`   - ${v}`));
    console.error('\nSet these variables in cPanel and restart the app.');
    console.error('The app will continue running so public pages stay available, but admin features may fail until the variables are set.\n');
  } else {
    console.log('✓ All required environment variables are configured');
  }
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');

// Internal modules
const { testConnection } = require('./config/db');
const { apiLimiter, publicApiLimiter } = require('./middleware/rateLimiter');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { sanitizeBody } = require('./middleware/inputSanitizer');
const { adminAuth } = require('./middleware/adminAuth');
const prerender = require('./middleware/prerenderMiddleware');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 5000;

// Trust the reverse proxy (required for cPanel Passenger to get real IPs for rate-limiting)
app.set('trust proxy', 1);
app.disable('x-powered-by');

// ============================================================
// BOT DETECTION HELPER
// ============================================================
// Identifies search engine & social media bots to exclude from rate limiting
function isBotUserAgent(userAgent) {
  const botPattern = /bot|crawler|spider|crawling|facebookexternalhit|facebot|twitterbot|slackbot|linkedinbot|discordbot|applebot|whatsapp|telegrambot|googlebot|bingbot|yandexbot/i;
  return botPattern.test((userAgent || '').toLowerCase());
}

// Attach bot detection to request object for use in rate limiters
app.use((req, _res, next) => {
  req.isBot = isBotUserAgent(req.get('user-agent'));
  
  // Log bot requests for debugging
  if (req.isBot) {
    const userAgent = req.get('user-agent') || 'unknown';
    console.log(`[BOT] ${req.method} ${req.path} | UA: ${userAgent.substring(0, 80)}`);
  }
  
  next();
});

// Response logging for bot requests using clean event listener (no monkey-patching)
app.use((req, res, next) => {
  if (req.isBot) {
    res.on('finish', () => {
      console.log(`[BOT-RESPONSE] ${res.statusCode} | ${req.method} ${req.path}`);
    });
  }
  next();
});

// Early bot-prerender bypass: serve prerendered HTML for known bots
// This runs before body sanitization, rate limits, or other middleware
app.use(async (req, res, next) => {
  try {
    if (req.method === 'GET' && req.isBot) {
      const speciesMatch = req.path.match(/^\/species\/(\d+)$/);
      if (speciesMatch) {
        const speciesId = speciesMatch[1];
        const html = await prerender.generateSpeciesHtml(speciesId, req);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        console.log(`[BOT-EARLY] Serving prerender for ${req.path} (UA: ${req.get('user-agent') || ''})`);
        return res.send(html);
      }

      if (req.path === '/' || req.path === '/index.html' || req.path === '') {
        const html = await prerender.generateHomeHtml(req);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        console.log(`[BOT-EARLY] Serving prerender home for ${req.path} (UA: ${req.get('user-agent') || ''})`);
        return res.send(html);
      }
    }
  } catch (err) {
    console.error('[BOT-EARLY] prerender error:', err && err.message ? err.message : err);
    // fall through to normal middleware chain
  }

  next();
});

// ============================================================
// SECURITY MIDDLEWARE
// ============================================================

// Helmet — sets secure HTTP headers (CSP, HSTS, X-Frame, etc.)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      // Allow both http: and https: for external images (mobile compatibility)
      // HTTP URLs are normalized to HTTPS at storage time via normalizeImageUrl()
      imgSrc: ["'self'", "data:", "https:", "http:", "blob:"],
      connectSrc: ["'self'", "https://api.gbif.org", "https://*.tile.openstreetmap.org"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow loading external images (GBIF, OSM)
  // Enhanced HSTS with preload for browser preload list
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  // Prevent browsers from MIME-sniffing responses
  noSniff: true,
  // Referrer policy for privacy
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },
  // Permissions policy (formerly Feature-Policy)
  permissionsPolicy: {
    geolocation: [],
    microphone: [],
    camera: [],
    payment: [],
    usb: [],
  },
}));

// HPP — prevent HTTP parameter pollution
app.use(hpp());

// CORS — Smart origin handling:
// - Public read-only API endpoints (GET/HEAD) are open to any origin so
//   external developers can use the API from their own apps/websites.
// - Write endpoints (POST/PUT/DELETE) are restricted to the configured
//   site origin(s) only, protecting admin operations.
function normalizeOrigin(origin) {
  return origin.replace(/\/$/, '');
}

const siteOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => normalizeOrigin(o.trim())).filter(Boolean)
  : (process.env.NODE_ENV === 'production' ? [] : ['http://localhost:5173']);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (curl, server-to-server, mobile apps)
    if (!origin) return callback(null, true);

    // Always allow the site's own origin(s)
    if (siteOrigins.includes(normalizeOrigin(origin))) {
      return callback(null, true);
    }

    // Allow any origin for public read-only access (the API is public!)
    // Write endpoints are still protected by adminAuth middleware
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true, // Allow cookies (only works with specific origins, not *)
  maxAge: 86400, // Cache preflight for 24 hours
}));

// Parse cookies
app.use(cookieParser());

// Parse JSON request bodies (1MB limit — no large file uploads via JSON)
app.use(express.json({ limit: '1mb' }));

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Sanitize all incoming request bodies (strip HTML tags, trim strings)
app.use(sanitizeBody);

// Image proxy — mounted BEFORE rate limiters so Facebook/WhatsApp/Twitter
// scrapers can always fetch OG images without being rate-limited.
const imageProxyRoutes = require('./routes/imageProxy');
app.use('/api', imageProxyRoutes);

// Apply rate limiting to all /api routes (image proxy is already handled above)
app.use('/api', apiLimiter);

// Serve uploaded images as static files (with cache headers)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), {
  maxAge: '7d',
  immutable: false,
}));

// ============================================================
// ROUTES
// ============================================================

// Health check endpoint (public)
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    message: 'FFDB API is running',
    project: 'Flora and Fauna Database of Bangladesh',
    timestamp: new Date().toISOString(),
  });
});

// Species routes (public reads, admin-protected writes)
// publicApiLimiter: external API consumers get 100 requests/hour
const speciesRoutes = require('./routes/species');
app.use('/api/species', publicApiLimiter, speciesRoutes);

// Search routes — Omni-Search (public)
const searchRoutes = require('./routes/search');
app.use('/api/search', publicApiLimiter, searchRoutes);

// Admin routes — GBIF data sourcing and auth (protected via cookie)
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

// Team routes (public)
const teamRoutes = require('./routes/team');
app.use('/api/team', teamRoutes);

// (Image proxy is mounted earlier, before rate limiters — see above)

// Reports routes — problem reporting (public post, admin get/update)
const reportsRoutes = require('./routes/reports');
app.use('/api/reports', reportsRoutes);

// SEO routes — sitemap.xml, robots.txt (public)
const seoRoutes = require('./routes/seoRoutes');
app.use(seoRoutes);

// API docs — OpenAPI-style JSON for consumers
const apiDocsRoutes = require('./routes/apiDocs');
app.use('/api', apiDocsRoutes);

// ============================================================
// PRODUCTION: Serve React Frontend
// ============================================================
// In production, Express serves the built React app from ../frontend/dist.
// This allows running a single Node.js app on cPanel shared hosting.
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '..', '..', 'frontend', 'dist');
  const prerenderMiddleware = require('./middleware/prerenderMiddleware');

  // Prerender middleware first so homepage source includes SEO/schema before static index.html can respond.
  app.use(prerenderMiddleware);

  // Cache strategy:
  // - index.html: no-cache (so clients pick up new deploys quickly)
  // - hashed static assets: long cache + immutable
  const longCacheAssetRegex = /\.(?:js|css|png|jpe?g|gif|webp|svg|ico|woff2?)$/i;
  app.use(express.static(frontendPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        return;
      }

      if (longCacheAssetRegex.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }));

  // SPA fallback — any non-API route serves index.html so React Router works
  // Using Regex /.*/ instead of '*' to prevent Express 5 / path-to-regexp v8 errors
  app.get(/.*/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// ============================================================
// ERROR HANDLING
// ============================================================

app.use(notFoundHandler);
app.use(errorHandler);

// ============================================================
// START SERVER
// ============================================================

// On cPanel/Phusion Passenger, the server MUST bind to the port 
// immediately. Do not block this with await DB connections, otherwise
// Passenger will throw a "Request Timeout" error.

app.listen(PORT, () => {
  console.log('');
  console.log('==========================================');
  console.log('Flora and Fauna Database of Bangladesh');
  console.log('FFDB API Server');
  console.log('==========================================');
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API base:        http://localhost:${PORT}/api`);
  console.log(`Health check:    http://localhost:${PORT}/api/health`);
  console.log(`Environment:     ${process.env.NODE_ENV || 'development'}`);
  console.log(`Rate limit:      ${process.env.RATE_LIMIT_MAX_REQUESTS || 100} req / ${Math.round((parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000) / 60000)} min`);
  console.log(`Admin auth:      ${process.env.ADMIN_API_KEY ? 'ENABLED' : 'DISABLED (set ADMIN_API_KEY in .env)'}`);
  console.log('==========================================');
  console.log('');
});

// Test database connection in the background
testConnection().catch(err => console.error('[DB] Startup test failed:', err.message));

module.exports = app;
