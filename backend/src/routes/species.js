// ============================================================
// FFDB - Flora and Fauna Database of Bangladesh
// Species Routes
// ============================================================

const express = require('express');
const router = express.Router();

const {
  getAllSpecies,
  getSpeciesById,
  getSpeciesPreview,
  createContribution,
  createSpecies,
  updateSpecies,
  deleteSpecies,
  getStats,
  uploadImage,
  checkNameAvailability,
} = require('../controllers/speciesController');
const { adminAuth, requireContributor } = require('../middleware/adminAuth');
const { contributeLimiter } = require('../middleware/rateLimiter');

// --- Public Routes ---

// GET /api/species           -- List species (paginated, filtered)
router.get('/', getAllSpecies);

// GET /api/species/check-name -- Real-time check if scientific name exists
router.get('/check-name', requireContributor, checkNameAvailability);

// GET /api/species/stats/overview -- Dashboard statistics
// NOTE: This MUST be before /:id to avoid "stats" being parsed as an ID
router.get('/stats/overview', getStats);

// POST /api/species/contribute -- Public contribution endpoint (always saved as draft)
router.post('/contribute', contributeLimiter, createContribution);

// GET /api/species/preview/:id -- Preview unpublished draft/pending species (auth required)
// NOTE: This MUST be before /:id so "preview" is not treated as a species ID
router.get('/preview/:id', requireContributor, getSpeciesPreview);

// GET /api/species/:id       -- Get single species with full details
router.get('/:id', getSpeciesById);

const multer = require('multer');
const path = require('path');

// Explicit allowlist of safe image extensions (blocks SVG XSS, HTML uploads, etc.)
const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // Use only the safe, validated extension -- not the raw originalname extension
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, uniqueSuffix + ext);
  }
});
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    // Check MIME type
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only images are allowed'));
    }
    // Check file extension against explicit allowlist
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
      return cb(new Error(`File extension "${ext}" is not allowed. Use: ${ALLOWED_IMAGE_EXTENSIONS.join(', ')}`));
    }
    cb(null, true);
  }
});

// --- Protected Routes (admin + contributor) ---

// POST /api/species          -- Create a new species
router.post('/', requireContributor, createSpecies);

// POST /api/species/:id/upload -- Upload an image for a species
router.post('/:id/upload', requireContributor, upload.single('image'), uploadImage);

// PUT /api/species/:id       -- Update a species
router.put('/:id', requireContributor, updateSpecies);

// DELETE /api/species/:id    -- Delete a species
router.delete('/:id', requireContributor, deleteSpecies);

// POST /api/species/:id/delete -- Delete fallback for hosts that block DELETE requests
router.post('/:id/delete', requireContributor, deleteSpecies);

module.exports = router;
