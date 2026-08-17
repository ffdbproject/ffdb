// ============================================================
// FFDB - Flora and Fauna Database of Bangladesh
// Admin Routes — GBIF data sourcing + admin-specific endpoints
// ============================================================

const express = require('express');
const router = express.Router();

const { searchGBIF, getGBIFSpecies } = require('../controllers/gbifController');
const { enrichSpeciesById } = require('../controllers/enrichmentController');
const {
	getAdminTeam,
	createTeamMember,
	updateTeamMember,
	deleteTeamMember,
} = require('../controllers/teamController');
const { login, logout, getMe } = require('../controllers/adminController');
const { exportDatabase, importDatabase } = require('../controllers/databaseController');
const { adminAuth } = require('../middleware/adminAuth');
const { loginLimiter } = require('../middleware/rateLimiter');

// --- Auth Routes ---
router.post('/login', loginLimiter, login);
router.post('/logout', logout);
router.get('/me', adminAuth, getMe);

// --- GBIF Data Sourcing ---

// GET /api/admin/gbif/search?q=panthera+tigris
router.get('/gbif/search', adminAuth, searchGBIF);

// GET /api/admin/gbif/species/:gbifKey
router.get('/gbif/species/:gbifKey', adminAuth, getGBIFSpecies);

// POST /api/admin/enrich/:id  — Enrich species data (Wikipedia → GBIF)
router.post('/enrich/:id', adminAuth, enrichSpeciesById);

// --- Database Import/Export ---
router.get('/database/export', adminAuth, exportDatabase);
router.post('/database/import', adminAuth, importDatabase);

// --- Team Management ---
router.get('/team', adminAuth, getAdminTeam);
router.post('/team', adminAuth, createTeamMember);
router.put('/team/:id', adminAuth, updateTeamMember);
router.delete('/team/:id', adminAuth, deleteTeamMember);
router.post('/team/:id/delete', adminAuth, deleteTeamMember);

module.exports = router;
