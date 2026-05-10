// ============================================================
// FFDB - Flora and Fauna Database of Bangladesh
// Species Controller — CRUD + Pagination
// ============================================================

const { pool } = require('../config/db');

const VALID_CATEGORIES = ['flora', 'fauna'];
const VALID_STATUSES = ['draft', 'pending_review', 'published'];
const VALID_ORIGINS = ['native', 'exotic'];
const VALID_CONSERVATION_STATUSES = ['LC', 'NT', 'VU', 'EN', 'CR', 'EW', 'EX'];
const CONSERVATION_STATUS_ALIASES = {
  LEAST_CONCERN: 'LC',
  NEAR_THREATENED: 'NT',
  VULNERABLE: 'VU',
  ENDANGERED: 'EN',
  CRITICALLY_ENDANGERED: 'CR',
  EXTINCT_IN_THE_WILD: 'EW',
  EXTINCT: 'EX',
};

const FIELD_LIMITS = {
  scientific_name: 255,
  english_name: 255,
  bengali_name: 255,
  description: 10000,
  habitat: 10000,
  image_url: 500,
  taxonomy: 100,
};

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

function normalizeCoordinates(locationCoordinates) {
  if (!Array.isArray(locationCoordinates)) {
    return [];
  }

  const sanitized = locationCoordinates
    .map((point) => {
      if (!point || typeof point !== 'object') return null;

      const lat = Number(point.lat);
      const lng = Number(point.lng);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
      }

      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return null;
      }

      return {
        lat,
        lng,
        label: typeof point.label === 'string' ? point.label : undefined,
      };
    })
    .filter(Boolean);

  return sanitized;
}

function normalizeConservationStatus(value) {
  if (!value || typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const upper = trimmed.toUpperCase();
  if (VALID_CONSERVATION_STATUSES.includes(upper)) {
    return upper;
  }

  const aliasKey = upper.replace(/[^A-Z]+/g, '_').replace(/^_+|_+$/g, '');
  return CONSERVATION_STATUS_ALIASES[aliasKey] || null;
}

function normalizeOptionalString(value, maxLen) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLen);
}

function normalizeRequiredString(value, maxLen) {
  const normalized = normalizeOptionalString(value, maxLen);
  return normalized || '';
}

function normalizeTaxonomy(taxonomyInput) {
  if (!taxonomyInput || typeof taxonomyInput !== 'object') {
    return null;
  }

  return {
    kingdom: normalizeOptionalString(taxonomyInput.kingdom, FIELD_LIMITS.taxonomy),
    phylum: normalizeOptionalString(taxonomyInput.phylum, FIELD_LIMITS.taxonomy),
    class: normalizeOptionalString(taxonomyInput.class, FIELD_LIMITS.taxonomy),
    order: normalizeOptionalString(taxonomyInput.order, FIELD_LIMITS.taxonomy),
    family: normalizeOptionalString(taxonomyInput.family, FIELD_LIMITS.taxonomy),
    genus: normalizeOptionalString(taxonomyInput.genus, FIELD_LIMITS.taxonomy),
  };
}

function mapPgError(err) {
  if (!err || !err.code) return null;

  if (err.code === '22001') {
    return {
      statusCode: 400,
      message: 'One or more fields are too long. Please shorten long text or image URLs.',
    };
  }

  if (err.code === '23514') {
    return {
      statusCode: 400,
      message: 'One or more values are invalid. Check category, status, and conservation status.',
    };
  }

  if (err.code === '22P02') {
    return {
      statusCode: 400,
      message: 'One or more fields have an invalid format. Check JSON coordinates, numeric values, and related data.',
    };
  }

  if (err.code === '23502') {
    return {
      statusCode: 400,
      message: 'A required database field is missing. Please make sure scientific name and category are filled in.',
    };
  }

  if (err.code === '23503') {
    return {
      statusCode: 400,
      message: 'A related record could not be found. Please refresh and try again.',
    };
  }

  return null;
}

/**
 * Normalize external image URLs to HTTPS for mobile compatibility.
 * Converts http:// URLs to https:// to avoid mixed-content blocking on mobile.
 * Safe external domains (GBIF, Wikipedia, known biodiversity databases) are whitelisted.
 */
function normalizeImageUrl(url) {
  if (!url || typeof url !== 'string') return url;
  
  // Known safe domains that support HTTPS
  const safeDomainsHttpToHttps = [
    'plantsp-eflora.bnh.gov.bd',
    'www.gbif.org',
    'gbif.org',
    'upload.wikimedia.org',
    'commons.wikimedia.org',
  ];
  
  if (url.startsWith('http://')) {
    const domain = new URL(url).hostname;
    if (safeDomainsHttpToHttps.some(d => domain.includes(d))) {
      return url.replace(/^http:\/\//, 'https://');
    }
  }
  
  return url;
}

function normalizeImages(imagesInput) {
  if (!Array.isArray(imagesInput) || imagesInput.length === 0) {
    return [];
  }

  const parsed = imagesInput
    .map((img) => {
      if (!img || typeof img !== 'object') return null;
      const imageUrl = normalizeOptionalString(img.image_url, FIELD_LIMITS.image_url) || '';
      if (!imageUrl) return null;
      return {
        image_url: normalizeImageUrl(imageUrl),
        image_credit: normalizeOptionalString(img.image_credit, 500),
        is_primary: Boolean(img.is_primary),
      };
    })
    .filter(Boolean);

  if (parsed.length === 0) {
    return [];
  }

  const firstPrimaryIndex = parsed.findIndex((img) => img.is_primary);
  const primaryIndex = firstPrimaryIndex >= 0 ? firstPrimaryIndex : 0;

  return parsed.map((img, idx) => ({
    ...img,
    is_primary: idx === primaryIndex,
  }));
}

/**
 * GET /api/species
 * List all published species with pagination.
 * Query params: ?page=1&limit=20&category=flora&status=published
 */
async function getAllSpecies(req, res, next) {
  try {
    const isAdmin = isAdminAuthorized(req);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    // Optional filters
    const { category, status, conservation_status, origin, kingdom, phylum, class: className, order, family, genus } = req.query;

    // Build dynamic WHERE clause
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    // Public requests can only view published records.
    // Admin requests can view all statuses by default, or filter by a specific valid status.
    if (isAdmin) {
      if (status && VALID_STATUSES.includes(status)) {
        conditions.push(`s.status = $${paramIndex++}`);
        values.push(status);
      }
    } else {
      conditions.push(`s.status = $${paramIndex++}`);
      values.push('published');
    }

    if (category) {
      conditions.push(`s.category = $${paramIndex++}`);
      values.push(category);
    }

    if (origin && VALID_ORIGINS.includes(origin)) {
      conditions.push(`s.origin = $${paramIndex++}`);
      values.push(origin);
    }

    if (conservation_status) {
      conditions.push(`s.conservation_status = $${paramIndex++}`);
      values.push(conservation_status);
    }

    if (kingdom) {
      conditions.push(`LOWER(t.kingdom) = LOWER($${paramIndex++})`);
      values.push(kingdom);
    }

    if (phylum) {
      conditions.push(`LOWER(t.phylum) = LOWER($${paramIndex++})`);
      values.push(phylum);
    }

    if (className) {
      conditions.push(`LOWER(t.class) = LOWER($${paramIndex++})`);
      values.push(className);
    }

    if (order) {
      conditions.push(`LOWER(t."order") = LOWER($${paramIndex++})`);
      values.push(order);
    }

    if (family) {
      conditions.push(`LOWER(t.family) = LOWER($${paramIndex++})`);
      values.push(family);
    }

    if (genus) {
      conditions.push(`LOWER(t.genus) = LOWER($${paramIndex++})`);
      values.push(genus);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    // Count total matching records
    const countQuery = `SELECT COUNT(*) FROM species s LEFT JOIN taxonomy t ON t.species_id = s.id ${whereClause}`;
    const countResult = await pool.query(countQuery, values);
    const totalRecords = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalRecords / limit);

    // Fetch paginated data with primary image and taxonomy
    const dataQuery = `
      SELECT 
        s.id,
        s.scientific_name,
        s.english_name,
        s.bengali_name,
        s.category,
        s.origin,
        s.conservation_status,
        s.status,
        s.created_at,
        s.updated_at,
        t.family,
        t.genus,
        i.image_url AS primary_image
      FROM species s
      LEFT JOIN taxonomy t ON t.species_id = s.id
      LEFT JOIN images i ON i.species_id = s.id AND i.is_primary = TRUE
      ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    values.push(limit, offset);
    const dataResult = await pool.query(dataQuery, values);

    // Normalize image URLs for mobile compatibility
    const normalizedRows = dataResult.rows.map((row) => ({
      ...row,
      primary_image: row.primary_image ? normalizeImageUrl(row.primary_image) : null,
    }));

    res.json({
      success: true,
      data: normalizedRows,
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
 * GET /api/species/:id
 * Get a single species by ID with full taxonomy, images, and coordinates.
 */
async function getSpeciesById(req, res, next) {
  try {
    const isAdmin = isAdminAuthorized(req);
    const { id } = req.params;

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid species ID format',
      });
    }

    // Fetch species with taxonomy
    const speciesQuery = `
      SELECT 
        s.*,
        t.kingdom,
        t.phylum,
        t.class,
        t."order",
        t.family,
        t.genus
      FROM species s
      LEFT JOIN taxonomy t ON t.species_id = s.id
      WHERE s.id = $1
      ${isAdmin ? '' : `AND s.status = 'published'`}
    `;
    const speciesResult = await pool.query(speciesQuery, [id]);

    if (speciesResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Species with ID ${id} not found`,
      });
    }

    // Fetch all images for this species
    const imagesResult = await pool.query(
      'SELECT id, image_url, image_credit, is_primary, created_at FROM images WHERE species_id = $1 ORDER BY is_primary DESC, created_at ASC',
      [id]
    );

    const species = speciesResult.rows[0];

    // Normalize image URLs for mobile compatibility
    const normalizedImages = imagesResult.rows.map((img) => ({
      ...img,
      image_url: normalizeImageUrl(img.image_url),
    }));

    // Structure taxonomy as a nested object
    const response = {
      id: species.id,
      scientific_name: species.scientific_name,
      english_name: species.english_name,
      bengali_name: species.bengali_name,
      category: species.category,
      origin: species.origin,
      description: species.description,
      habitat: species.habitat,
      conservation_status: species.conservation_status,
      location_coordinates: species.location_coordinates,
      status: species.status,
      created_at: species.created_at,
      updated_at: species.updated_at,
      taxonomy: {
        kingdom: species.kingdom,
        phylum: species.phylum,
        class: species.class,
        order: species.order,
        family: species.family,
        genus: species.genus,
      },
      images: normalizedImages,
    };

    res.json({ success: true, data: response });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/species
 * Create a new species record with optional taxonomy and images.
 * Body: { scientific_name, english_name, bengali_name, category, description,
 *          habitat, conservation_status, location_coordinates, status,
 *          taxonomy: { kingdom, phylum, class, order, family, genus },
 *          images: [{ image_url, is_primary }] }
 */
async function createSpecies(req, res, next) {
  const client = await pool.connect();

  try {
    const {
      category,
      origin,
      conservation_status,
      location_coordinates,
      status,
      images,
    } = req.body;

    const scientific_name = normalizeRequiredString(req.body.scientific_name, FIELD_LIMITS.scientific_name);
    const english_name = normalizeOptionalString(req.body.english_name, FIELD_LIMITS.english_name);
    const bengali_name = normalizeOptionalString(req.body.bengali_name, FIELD_LIMITS.bengali_name);
    const description = normalizeOptionalString(req.body.description, FIELD_LIMITS.description);
    const habitat = normalizeOptionalString(req.body.habitat, FIELD_LIMITS.habitat);
    const taxonomy = normalizeTaxonomy(req.body.taxonomy);

    // Validate required fields
    if (!scientific_name || !category) {
      return res.status(400).json({
        success: false,
        message: 'scientific_name and category are required',
      });
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'category must be "flora" or "fauna"',
      });
    }

    if (origin && !VALID_ORIGINS.includes(origin)) {
      return res.status(400).json({
        success: false,
        message: 'origin must be "native" or "exotic"',
      });
    }

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value',
      });
    }

    const normalizedConservationStatus = normalizeConservationStatus(conservation_status);
    const normalizedImages = normalizeImages(images);

    const normalizedCoordinates = normalizeCoordinates(location_coordinates);
    const serializedCoordinates = JSON.stringify(normalizedCoordinates);

    // Use a transaction to ensure all inserts succeed or none do
    await client.query('BEGIN');

    // 1. Insert species
    const speciesResult = await client.query(
      `INSERT INTO species 
        (scientific_name, english_name, bengali_name, category, origin, description, 
         habitat, conservation_status, location_coordinates, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        scientific_name,
        english_name,
        bengali_name,
        category,
        origin || 'native',
        description,
        habitat,
        normalizedConservationStatus,
        serializedCoordinates,
        status || 'draft',
      ]
    );

    const newSpecies = speciesResult.rows[0];

    // 2. Insert taxonomy (if provided)
    if (taxonomy) {
      await client.query(
        `INSERT INTO taxonomy (species_id, kingdom, phylum, class, "order", family, genus)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          newSpecies.id,
          taxonomy.kingdom,
          taxonomy.phylum,
          taxonomy.class,
          taxonomy.order,
          taxonomy.family,
          taxonomy.genus,
        ]
      );
    }

    // 3. Insert images (if provided)
    if (normalizedImages.length > 0) {
      for (const img of normalizedImages) {
        await client.query(
          `INSERT INTO images (species_id, image_url, image_credit, is_primary)
           VALUES ($1, $2, $3, $4)`,
          [newSpecies.id, img.image_url, img.image_credit, img.is_primary || false]
        );
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Species created successfully',
      data: newSpecies,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505' && err.constraint === 'species_scientific_name_key') {
      return res.status(409).json({
        success: false,
        message: `A species with the scientific name "${req.body.scientific_name}" already exists.`,
      });
    }
    const mappedError = mapPgError(err);
    if (mappedError) {
      return res.status(mappedError.statusCode).json({
        success: false,
        message: mappedError.message,
      });
    }
    next(err);
  } finally {
    client.release();
  }
}

/**
 * PUT /api/species/:id
 * Update an existing species record (species + taxonomy).
 */
async function updateSpecies(req, res, next) {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const {
      category,
      origin,
      conservation_status,
      location_coordinates,
      status,
    } = req.body;

    const scientific_name = req.body.scientific_name === undefined
      ? undefined
      : normalizeOptionalString(req.body.scientific_name, FIELD_LIMITS.scientific_name);
    const english_name = req.body.english_name === undefined
      ? undefined
      : normalizeOptionalString(req.body.english_name, FIELD_LIMITS.english_name);
    const bengali_name = req.body.bengali_name === undefined
      ? undefined
      : normalizeOptionalString(req.body.bengali_name, FIELD_LIMITS.bengali_name);
    const description = req.body.description === undefined
      ? undefined
      : (normalizeOptionalString(req.body.description, FIELD_LIMITS.description) || null);
    const habitat = req.body.habitat === undefined
      ? undefined
      : (normalizeOptionalString(req.body.habitat, FIELD_LIMITS.habitat) || null);
    const taxonomy = normalizeTaxonomy(req.body.taxonomy);

    if (category && !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'category must be "flora" or "fauna"',
      });
    }

    if (origin && !VALID_ORIGINS.includes(origin)) {
      return res.status(400).json({
        success: false,
        message: 'origin must be "native" or "exotic"',
      });
    }

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value',
      });
    }

    const normalizedConservationStatus = conservation_status === undefined 
      ? undefined 
      : normalizeConservationStatus(conservation_status);
    const normalizedImages = normalizeImages(req.body.images);

    const normalizedCoordinates = Array.isArray(location_coordinates)
      ? normalizeCoordinates(location_coordinates)
      : null;
    const serializedCoordinates = normalizedCoordinates === null
      ? null
      : JSON.stringify(normalizedCoordinates);

    // Check if species exists
    const existing = await client.query('SELECT id FROM species WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Species with ID ${id} not found`,
      });
    }

    await client.query('BEGIN');

    // 1. Update species - build dynamic query to only update provided fields
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (scientific_name !== undefined) {
      updates.push(`scientific_name = $${paramIndex++}`);
      params.push(scientific_name);
    }
    if (english_name !== undefined) {
      updates.push(`english_name = $${paramIndex++}`);
      params.push(english_name);
    }
    if (bengali_name !== undefined) {
      updates.push(`bengali_name = $${paramIndex++}`);
      params.push(bengali_name);
    }
    if (category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      params.push(category || null);
    }
    if (origin !== undefined) {
      updates.push(`origin = $${paramIndex++}`);
      params.push(origin || null);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(description);
    }
    if (habitat !== undefined) {
      updates.push(`habitat = $${paramIndex++}`);
      params.push(habitat);
    }
    if (normalizedConservationStatus !== undefined) {
      updates.push(`conservation_status = $${paramIndex++}`);
      params.push(normalizedConservationStatus);
    }
    if (serializedCoordinates !== undefined) {
      updates.push(`location_coordinates = $${paramIndex++}`);
      params.push(serializedCoordinates);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(status || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update',
      });
    }

    const updateQuery = `UPDATE species SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    params.push(id);

    const updateResult = await client.query(updateQuery, params);

    // 2. Upsert taxonomy (INSERT or UPDATE)
    if (taxonomy) {
      await client.query(
        `INSERT INTO taxonomy (species_id, kingdom, phylum, class, "order", family, genus)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (species_id) DO UPDATE SET
           kingdom = COALESCE(EXCLUDED.kingdom, taxonomy.kingdom),
           phylum  = COALESCE(EXCLUDED.phylum, taxonomy.phylum),
           class   = COALESCE(EXCLUDED.class, taxonomy.class),
           "order" = COALESCE(EXCLUDED."order", taxonomy."order"),
           family  = COALESCE(EXCLUDED.family, taxonomy.family),
           genus   = COALESCE(EXCLUDED.genus, taxonomy.genus)`,
        [
          id,
          taxonomy.kingdom,
          taxonomy.phylum,
          taxonomy.class,
          taxonomy.order,
          taxonomy.family,
          taxonomy.genus,
        ]
      );
    }

    // 3. Replace images if provided in payload
    if (Array.isArray(req.body.images)) {
      await client.query('DELETE FROM images WHERE species_id = $1', [id]);

      for (const img of normalizedImages) {
        await client.query(
          `INSERT INTO images (species_id, image_url, image_credit, is_primary)
           VALUES ($1, $2, $3, $4)`,
          [id, img.image_url, img.image_credit, img.is_primary]
        );
      }
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Species updated successfully',
      data: updateResult.rows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505' && err.constraint === 'species_scientific_name_key') {
      return res.status(409).json({
        success: false,
        message: `A species with the scientific name "${req.body.scientific_name}" already exists.`,
      });
    }
    const mappedError = mapPgError(err);
    if (mappedError) {
      return res.status(mappedError.statusCode).json({
        success: false,
        message: mappedError.message,
      });
    }
    next(err);
  } finally {
    client.release();
  }
}

/**
 * DELETE /api/species/:id
 * Delete a species and all related data (CASCADE handles taxonomy + images).
 */
async function deleteSpecies(req, res, next) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM species WHERE id = $1 RETURNING id, scientific_name',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Species with ID ${id} not found`,
      });
    }

    res.json({
      success: true,
      message: `Species "${result.rows[0].scientific_name}" deleted successfully`,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/species/stats/overview
 * Get dashboard statistics (total species, flora/fauna counts, status counts).
 */
async function getStats(req, res, next) {
  try {
    const isAdmin = isAdminAuthorized(req);

    const result = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE category = 'flora') AS flora_count,
        COUNT(*) FILTER (WHERE category = 'fauna') AS fauna_count,
        COUNT(*) FILTER (WHERE status = 'published') AS published_count
        ${isAdmin ? `,
        COUNT(*) FILTER (WHERE status = 'draft') AS draft_count,
        COUNT(*) FILTER (WHERE status = 'pending_review') AS pending_count` : ''}
      FROM species
      ${isAdmin ? '' : `WHERE status = 'published'`}
    `);

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/species/contribute
 * Public endpoint that stores user-submitted species as draft only.
 */
async function createContribution(req, res, next) {
  const client = await pool.connect();

  try {
    const {
      category,
      conservation_status,
    } = req.body;

    const scientific_name = normalizeRequiredString(req.body.scientific_name, FIELD_LIMITS.scientific_name);
    const english_name = normalizeOptionalString(req.body.english_name, FIELD_LIMITS.english_name);
    const bengali_name = normalizeOptionalString(req.body.bengali_name, FIELD_LIMITS.bengali_name);
    const description = normalizeOptionalString(req.body.description, FIELD_LIMITS.description);
    const habitat = normalizeOptionalString(req.body.habitat, FIELD_LIMITS.habitat);
    const taxonomy = normalizeTaxonomy(req.body.taxonomy);

    if (!scientific_name || !category) {
      return res.status(400).json({
        success: false,
        message: 'scientific_name and category are required',
      });
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'category must be "flora" or "fauna"',
      });
    }

    const normalizedConservationStatus = normalizeConservationStatus(conservation_status);

    await client.query('BEGIN');

    const speciesResult = await client.query(
      `INSERT INTO species
        (scientific_name, english_name, bengali_name, category, description,
         habitat, conservation_status, location_coordinates, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft')
       RETURNING id, scientific_name, status, created_at`,
      [
        scientific_name,
        english_name,
        bengali_name,
        category,
        description,
        habitat,
        normalizedConservationStatus,
        [],
      ]
    );

    if (taxonomy) {
      await client.query(
        `INSERT INTO taxonomy (species_id, kingdom, phylum, class, "order", family, genus)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          speciesResult.rows[0].id,
          taxonomy.kingdom,
          taxonomy.phylum,
          taxonomy.class,
          taxonomy.order,
          taxonomy.family,
          taxonomy.genus,
        ]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Contribution submitted successfully and saved as draft',
      data: speciesResult.rows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    const mappedError = mapPgError(err);
    if (mappedError) {
      return res.status(mappedError.statusCode).json({
        success: false,
        message: mappedError.message,
      });
    }
    next(err);
  } finally {
    client.release();
  }
}

/**
 * POST /api/species/:id/upload
 * Upload a single image for a species.
 */
async function uploadImage(req, res, next) {
  try {
    const { id } = req.params;
    const is_primary = req.body.is_primary === 'true';
    const image_credit = req.body.image_credit ? (req.body.image_credit.trim() || null) : null;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file uploaded.' });
    }

    const image_url = `/uploads/${req.file.filename}`;

    if (is_primary) {
      await pool.query('UPDATE images SET is_primary = FALSE WHERE species_id = $1', [id]);
    }

    const result = await pool.query(
      `INSERT INTO images (species_id, image_url, image_credit, is_primary)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, image_url, image_credit, is_primary]
    );

    res.status(201).json({
      success: true,
      message: 'Image uploaded successfully',
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllSpecies,
  getSpeciesById,
  createContribution,
  createSpecies,
  updateSpecies,
  deleteSpecies,
  getStats,
  uploadImage,
};
