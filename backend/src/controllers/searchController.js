// ============================================================
// FFDB - Flora and Fauna Database of Bangladesh
// Search Controller — Omni-Search across species names
// ============================================================

const { pool } = require('../config/db');

/**
 * GET /api/search?q=tiger&page=1&limit=20&category=fauna
 *
 * Omni-Search: queries scientific_name, english_name, and bengali_name
 * simultaneously using ILIKE (case-insensitive pattern matching).
 *
 * Supports:
 *   - Partial matching (e.g., "tig" matches "Tiger")
 *   - Bengali search (e.g., "বাঘ" matches "বাংলা বাঘ")
 *   - Optional category filter (?category=flora or ?category=fauna)
 *   - Pagination (?page=1&limit=20)
 *
 * Prepared for Full-Text Search upgrade later (pg_trgm + GIN indexes).
 */
async function omniSearch(req, res, next) {
  try {
    const { q, category } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    // Require a search query
    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Search query "q" is required. Example: /api/search?q=tiger',
      });
    }

    const searchTerm = `%${q.trim()}%`;

    // Build WHERE clause
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    // Core search: match across all three name fields
    conditions.push(`(
      s.scientific_name ILIKE $${paramIndex}
      OR s.english_name ILIKE $${paramIndex}
      OR s.bengali_name ILIKE $${paramIndex}
    )`);
    values.push(searchTerm);
    paramIndex++;

    // Only show published species in public search
    conditions.push(`s.status = 'published'`);

    // Optional category filter
    if (category && ['flora', 'fauna'].includes(category)) {
      conditions.push(`s.category = $${paramIndex++}`);
      values.push(category);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Count total matches
    const countQuery = `SELECT COUNT(*) FROM species s ${whereClause}`;
    const countResult = await pool.query(countQuery, values);
    const totalRecords = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalRecords / limit);

    // Fetch matching species with taxonomy and primary image
    const dataQuery = `
      SELECT
        s.id,
        s.scientific_name,
        s.english_name,
        s.bengali_name,
        s.category,
        s.conservation_status,
        s.habitat,
        s.status,
        s.created_at,
        t.family,
        t.genus,
        i.image_url AS primary_image
      FROM species s
      LEFT JOIN taxonomy t ON t.species_id = s.id
      LEFT JOIN images i ON i.species_id = s.id AND i.is_primary = TRUE
      ${whereClause}
      ORDER BY
        -- Prioritize exact matches on scientific_name, then english, then bengali
        CASE
          WHEN s.scientific_name ILIKE $1 THEN 1
          WHEN s.english_name ILIKE $1 THEN 2
          WHEN s.bengali_name ILIKE $1 THEN 3
          ELSE 4
        END,
        s.scientific_name ASC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    values.push(limit, offset);
    const dataResult = await pool.query(dataQuery, values);

    res.json({
      success: true,
      query: q.trim(),
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
    next(err);
  }
}

/**
 * GET /api/search/suggest?q=pan
 *
 * Quick autocomplete suggestions (returns up to 8 lightweight results).
 * Used for the search bar dropdown as the user types.
 */
async function searchSuggest(req, res, next) {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.json({ success: true, data: [] });
    }

    const searchTerm = `%${q.trim()}%`;

    const result = await pool.query(
      `SELECT
        s.id,
        s.scientific_name,
        s.english_name,
        s.bengali_name,
        s.category,
        i.image_url AS primary_image
      FROM species s
      LEFT JOIN images i ON i.species_id = s.id AND i.is_primary = TRUE
      WHERE s.status = 'published'
        AND (
          s.scientific_name ILIKE $1
          OR s.english_name ILIKE $1
          OR s.bengali_name ILIKE $1
        )
      ORDER BY s.scientific_name ASC
      LIMIT 8`,
      [searchTerm]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

module.exports = { omniSearch, searchSuggest };
