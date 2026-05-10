// ============================================================
// FFDB - Flora and Fauna Database of Bangladesh
// Rate Limiting Middleware (express-rate-limit)
// Protects the API on cPanel shared hosting from abuse.
// ============================================================

const rateLimit = require('express-rate-limit');

/**
 * Skip rate limiting for bots (SEO crawlers, social media bots, etc.)
 * Checks BOTH user-agent AND the req.isBot flag for maximum compatibility
 */
function skipBots(req, _res) {
  // Priority 1: Use req.isBot flag (set by global middleware)
  if (req.isBot === true) {
    return true;
  }
  
  // Priority 2: Fallback to direct user-agent check
  const userAgent = (req.get('user-agent') || '').toLowerCase();
  const botPattern = /bot|crawler|spider|crawling|facebookexternalhit|facebot|twitterbot|slackbot|linkedinbot|discordbot|applebot|whatsapp|telegrambot|googlebot|bingbot|yandexbot/i;
  return botPattern.test(userAgent);
}

/**
 * General API rate limiter for all routes.
 * Defaults: 500 requests per 15-minute window for better public read access.
 * Configurable via .env: RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS
 * EXCLUDES: Search engine bots, social media crawlers (facebookexternalhit, etc.)
 */
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 500, // Relaxed from 100
  skip: skipBots, // Skip rate limiting for bots
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
});

/**
 * Strict rate limiter for the public contribute endpoint to prevent spam.
 * Allows 5 requests per hour.
 */
const contributeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many contributions submitted. Please try again later.',
  },
});

module.exports = { apiLimiter, contributeLimiter };
