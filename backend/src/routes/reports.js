// ============================================================
// Reports Routes — problem reporting endpoints
// ============================================================

const express = require('express');
const { createReport, listReports, updateReportStatus, getReportStats } = require('../controllers/reportsController');

const router = express.Router();

// Public endpoint — submit a report
router.post('/', createReport);

// Admin endpoints — manage reports
router.get('/admin/stats', getReportStats);
router.get('/admin', listReports);
router.patch('/admin/:id', updateReportStatus);

module.exports = router;
