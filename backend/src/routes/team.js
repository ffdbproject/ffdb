const express = require('express');
const router = express.Router();

const { getPublicTeam } = require('../controllers/teamController');

// GET /api/team
router.get('/', getPublicTeam);

module.exports = router;
