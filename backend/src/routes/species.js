// ============================================================
// FFDB - Flora and Fauna Database of Bangladesh
// Species Routes
// ============================================================

const express = require('express');
const router = express.Router();

const {
  getAllSpecies,
  getSpeciesById,
  createContribution,
  createSpecies,
  updateSpecies,
  deleteSpecies,
  getStats,
  uploadImage,
} = require('../controllers/speciesController');
const { adminAuth } = require('../middleware/adminAuth');
const { csrfProtection } = require('../middleware/csrfProtection');
const { contributeLimiter } = require('../middleware/rateLimiter');

// --- Public Routes ---

// GET /api/species           — List species (paginated, filtered)
router.get('/', getAllSpecies);

// GET /api/species/stats/overview — Dashboard statistics
// NOTE: This MUST be before /:id to avoid "stats" being parsed as an ID
router.get('/stats/overview', getStats);

// POST /api/species/contribute — Public contribution endpoint (always saved as draft)
router.post('/contribute', contributeLimiter, createContribution);

// GET /api/species/:id       — Get single species with full details
router.get('/:id', getSpeciesById);

const multer = require('multer');
const path = require('path');

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images are allowed'));
  }
});

// --- Admin Protected Routes ---

// POST /api/species          — Create a new species
router.post('/', csrfProtection, adminAuth, createSpecies);

// POST /api/species/:id/upload — Upload an image for a species
router.post('/:id/upload', csrfProtection, adminAuth, upload.single('image'), uploadImage);

// PUT /api/species/:id       — Update a species
router.put('/:id', csrfProtection, adminAuth, updateSpecies);

// DELETE /api/species/:id    — Delete a species
router.delete('/:id', csrfProtection, adminAuth, deleteSpecies);

// POST /api/species/:id/delete — Delete fallback for hosts that block DELETE requests
router.post('/:id/delete', csrfProtection, adminAuth, deleteSpecies);

module.exports = router;
