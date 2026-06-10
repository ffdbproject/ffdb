// ============================================================
// Reports Routes — problem reporting endpoints
// ============================================================

const express = require('express');
const { createReport, listReports, updateReportStatus, getReportStats } = require('../controllers/reportsController');
const { adminAuth } = require('../middleware/adminAuth');

const router = express.Router();

// Public endpoint — submit a report
router.post('/', createReport);

// Admin endpoints — manage reports (protected by adminAuth middleware)
router.get('/admin/stats', adminAuth, getReportStats);
router.get('/admin', adminAuth, listReports);
router.patch('/admin/:id', adminAuth, updateReportStatus);

module.exports = router;
