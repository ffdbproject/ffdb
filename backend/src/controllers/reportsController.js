// ============================================================
// Reports Controller — user problem reporting system
// Endpoints for creating reports and admin management
// ============================================================

const { pool } = require('../config/db');

const VALID_STATUSES = ['open', 'in_progress', 'resolved'];

function isAdminAuthorized(req) {
  const apiKey = process.env.ADMIN_API_KEY;

  // 1) If Authorization: Bearer <API_KEY> header is present and matches, allow
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (apiKey && token === apiKey) return true;
  }

  // 2) If an HttpOnly admin cookie is present, verify the JWT
  try {
    const jwt = require('jsonwebtoken');
    const token = req.cookies?.admin_token;
    if (token) {
      const secret = process.env.JWT_SECRET || process.env.ADMIN_API_KEY || 'fallback_secret_for_dev';
      const decoded = jwt.verify(token, secret);
      if (decoded && decoded.role === 'admin') return true;
    }
  } catch (e) {
    // ignore verification errors and fall through
  }

  // 3) Development mode fallback when no ADMIN_API_KEY configured
  if (!apiKey && process.env.NODE_ENV !== 'production') return true;

  return false;
}

function normalizeOptionalString(value, maxLen) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLen);
}

/**
 * POST /api/reports
 * Create a new problem report (public endpoint)
 * Body: { title, description, species_id (optional), email (optional) }
 */
async function createReport(req, res, next) {
  try {
    const { title, description, species_id, email } = req.body;

    // Validate required fields
    const cleanTitle = normalizeOptionalString(title, 255);
    if (!cleanTitle) {
      return res.status(400).json({
        success: false,
        message: 'Title is required and cannot be empty',
      });
    }

    const cleanDescription = normalizeOptionalString(description, 5000);
    if (!cleanDescription) {
      return res.status(400).json({
        success: false,
        message: 'Description is required and cannot be empty',
      });
    }

    // Optional species_id (must be valid if provided)
    let cleanSpeciesId = null;
    if (species_id) {
      const parsed = parseInt(species_id, 10);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        return res.status(400).json({
          success: false,
          message: 'If provided, species_id must be a positive integer',
        });
      }
      // Check if species exists
      const speciesExists = await pool.query('SELECT id FROM species WHERE id = $1', [parsed]);
      if (speciesExists.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: `Species with ID ${parsed} does not exist`,
        });
      }
      cleanSpeciesId = parsed;
    }

    // Optional email (basic validation)
    let cleanEmail = null;
    if (email) {
      cleanEmail = normalizeOptionalString(email, 255);
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (cleanEmail && !emailRegex.test(cleanEmail)) {
        return res.status(400).json({
          success: false,
          message: 'If provided, email must be a valid email address',
        });
      }
    }

    // Insert report
    const result = await pool.query(
      `INSERT INTO reports (title, description, species_id, email, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, title, description, species_id, email, status, created_at`,
      [cleanTitle, cleanDescription, cleanSpeciesId, cleanEmail, 'open']
    );

    const report = result.rows[0];

    console.log(`[Reports] New report created: ID ${report.id}, title: "${report.title}"`);

    res.status(201).json({
      success: true,
      message: 'Thank you for reporting the problem. We will review it shortly.',
      data: report,
    });
  } catch (err) {
    console.error('[Reports] Create report error:', err.message);
    next(err);
  }
}

/**
 * GET /api/admin/reports
 * List all reports with optional filtering and pagination
 * Query params: ?page=1&limit=20&status=open
 * Protected: admin only
 */
async function listReports(req, res, next) {
  try {
    if (!isAdminAuthorized(req)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: admin access required',
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const { status } = req.query;

    // Build WHERE clause
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (status && VALID_STATUSES.includes(status)) {
      conditions.push(`r.status = $${paramIndex++}`);
      values.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total matching records
    const countQuery = `SELECT COUNT(*) FROM reports r ${whereClause}`;
    const countResult = await pool.query(countQuery, values);
    const totalRecords = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalRecords / limit);

    // Fetch paginated reports with species info
    const dataQuery = `
      SELECT 
        r.id,
        r.title,
        r.description,
        r.species_id,
        s.scientific_name,
        s.english_name,
        r.email,
        r.status,
        r.created_at,
        r.updated_at
      FROM reports r
      LEFT JOIN species s ON r.species_id = s.id
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    values.push(limit, offset);
    const dataResult = await pool.query(dataQuery, values);

    res.json({
      success: true,
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (err) {
    console.error('[Reports] List reports error:', err.message);
    next(err);
  }
}

/**
 * PATCH /api/admin/reports/:id
 * Update report status (admin only)
 * Body: { status } where status is 'open', 'in_progress', or 'resolved'
 */
async function updateReportStatus(req, res, next) {
  try {
    if (!isAdminAuthorized(req)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: admin access required',
      });
    }

    const { id } = req.params;
    const { status } = req.body;

    // Validate report ID
    if (!/^[0-9]+$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid report ID',
      });
    }

    // Validate status
    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }

    // Check if report exists
    const existing = await pool.query('SELECT id FROM reports WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Report with ID ${id} not found`,
      });
    }

    // Update status
    const result = await pool.query(
      `UPDATE reports 
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, title, status, updated_at`,
      [status, id]
    );

    const report = result.rows[0];
    console.log(`[Reports] Report ${report.id} status updated to: ${status}`);

    res.json({
      success: true,
      message: 'Report status updated successfully',
      data: report,
    });
  } catch (err) {
    console.error('[Reports] Update report status error:', err.message);
    next(err);
  }
}

/**
 * GET /api/admin/reports/stats
 * Get summary statistics about reports (admin only)
 */
async function getReportStats(req, res, next) {
  try {
    if (!isAdminAuthorized(req)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: admin access required',
      });
    }

    const result = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'open' THEN 1 END) as open_count,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_count,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_count
      FROM reports
    `);

    const stats = result.rows[0];

    res.json({
      success: true,
      data: stats,
    });
  } catch (err) {
    console.error('[Reports] Get stats error:', err.message);
    next(err);
  }
}

module.exports = {
  createReport,
  listReports,
  updateReportStatus,
  getReportStats,
};
