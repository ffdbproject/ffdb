// ============================================================
// FFDB - Flora and Fauna Database of Bangladesh
// Search Routes
// ============================================================

const express = require('express');
const router = express.Router();

const { omniSearch, searchSuggest } = require('../controllers/searchController');

// GET /api/search?q=tiger&page=1&limit=20&category=fauna
router.get('/', omniSearch);

// GET /api/search/suggest?q=pan  (autocomplete, max 8 results)
router.get('/suggest', searchSuggest);

module.exports = router;
