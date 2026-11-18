const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { getPublicDataDump } = require('../controllers/publicDataController');

// Dedicated rate limiter for heavy data dumps (10 downloads per hour per IP)
const dumpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Data dump rate limit exceeded (10 downloads per hour allowed). Please try again later.'
  }
});

// GET /api/public/data-dump?format=json|csv
router.get('/data-dump', dumpLimiter, getPublicDataDump);

module.exports = router;
