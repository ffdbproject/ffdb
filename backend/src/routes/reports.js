// ============================================================
// Reports Routes — problem reporting endpoints
// ============================================================

const express = require('express');
const { createReport, listReports, updateReportStatus, getReportStats } = require('../controllers/reportsController');
const { requireAdmin } = require('../middleware/adminAuth');

const router = express.Router();

// Public endpoint — submit a report
router.post('/', createReport);

// Admin endpoints — manage reports (protected by requireAdmin middleware)
router.get('/admin/stats', requireAdmin, getReportStats);
router.get('/admin', requireAdmin, listReports);
router.patch('/admin/:id', requireAdmin, updateReportStatus);

module.exports = router;
