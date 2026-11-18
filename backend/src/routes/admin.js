// ============================================================
// FFDB - Flora and Fauna Database of Bangladesh
// Admin Routes -- GBIF data sourcing + admin-specific endpoints
// ============================================================

const express = require('express');
const router = express.Router();

const { searchGBIF, getGBIFSpecies } = require('../controllers/gbifController');
const { enrichSpeciesById, previewSpeciesEnrichment } = require('../controllers/enrichmentController');
const {
	getAdminTeam,
	createTeamMember,
	updateTeamMember,
	deleteTeamMember,
} = require('../controllers/teamController');
const { login, logout, getMe } = require('../controllers/adminController');
const { getAdminNotice, updateNotice } = require('../controllers/noticeController');
const { exportDatabase, importDatabase } = require('../controllers/databaseController');
const { adminAuth, requireAdmin, requireContributor } = require('../middleware/adminAuth');
const { loginLimiter } = require('../middleware/rateLimiter');
const multer = require('multer');

// Use memory storage for small import files
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// --- Auth Routes ---
router.post('/login', loginLimiter, login);
router.post('/logout', logout);
router.get('/me', adminAuth, getMe);
router.get('/notice', requireAdmin, getAdminNotice);
router.put('/notice', requireAdmin, updateNotice);

// --- GBIF Data Sourcing (admin only) ---

// GET /api/admin/gbif/search?q=panthera+tigris
router.get('/gbif/search', requireAdmin, searchGBIF);

// GET /api/admin/gbif/species/:gbifKey
router.get('/gbif/species/:gbifKey', requireAdmin, getGBIFSpecies);

// POST /api/admin/enrich/:id  -- Enrich species data (Wikipedia + GBIF)
// Accessible by both admin and contributor
router.post('/enrich/:id', requireContributor, enrichSpeciesById);
router.get('/enrich-preview/:id', requireContributor, previewSpeciesEnrichment);

// --- Database Import/Export (admin only) ---
router.get('/database/export', requireAdmin, exportDatabase);
router.post('/database/import', requireAdmin, upload.single('file'), importDatabase);

// --- Team Management (admin only) ---
router.get('/team', requireAdmin, getAdminTeam);
router.post('/team', requireAdmin, createTeamMember);
router.put('/team/:id', requireAdmin, updateTeamMember);
router.delete('/team/:id', requireAdmin, deleteTeamMember);
router.post('/team/:id/delete', requireAdmin, deleteTeamMember);

module.exports = router;
