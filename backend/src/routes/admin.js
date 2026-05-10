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
const { adminAuth } = require('../middleware/adminAuth');
const { csrfProtection } = require('../middleware/csrfProtection');

// --- Auth Routes ---
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', adminAuth, getMe);

// --- GBIF Data Sourcing ---

// GET /api/admin/gbif/search?q=panthera+tigris
router.get('/gbif/search', adminAuth, searchGBIF);

// GET /api/admin/gbif/species/:gbifKey
router.get('/gbif/species/:gbifKey', adminAuth, getGBIFSpecies);

// POST /api/admin/enrich/:id  — Enrich species data (Wikipedia → GBIF)
router.post('/enrich/:id', csrfProtection, adminAuth, enrichSpeciesById);

// --- Team Management ---
router.get('/team', adminAuth, getAdminTeam);
router.post('/team', csrfProtection, adminAuth, createTeamMember);
router.put('/team/:id', csrfProtection, adminAuth, updateTeamMember);
router.delete('/team/:id', csrfProtection, adminAuth, deleteTeamMember);
router.post('/team/:id/delete', csrfProtection, adminAuth, deleteTeamMember);

module.exports = router;
