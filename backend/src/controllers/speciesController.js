// ============================================================
// FFDB - Flora and Fauna Database of Bangladesh
// Species Controller — CRUD + Pagination
// ============================================================

const { pool } = require('../config/db');
const { isAdminAuthorized } = require('../utils/auth');
const { normalizeOptionalString, normalizeImageUrl } = require('../utils/normalize');
const path = require('path');
const fs = require('fs/promises');
let sharp = null;
try {
  sharp = require('sharp');
} catch (err) {
  console.warn('[ImageUpload] Sharp is unavailable. Upload optimization will be skipped.');
}

const VALID_CATEGORIES = ['flora', 'fauna'];
const VALID_STATUSES = ['draft', 'pending_review', 'published'];
const VALID_ORIGINS = ['native', 'exotic'];
const VALID_CONSERVATION_STATUSES = ['NE', 'DD', 'LC', 'NT', 'VU', 'EN', 'CR', 'RE', 'EW', 'EX'];
const CONSERVATION_STATUS_ALIASES = {
  NOT_EVALUATED: 'NE',
  DATA_DEFICIENT: 'DD',
  LEAST_CONCERN: 'LC',
  NEAR_THREATENED: 'NT',
  VULNERABLE: 'VU',
  ENDANGERED: 'EN',
  CRITICALLY_ENDANGERED: 'CR',
  REGIONALLY_EXTINCT: 'RE',
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

// isAdminAuthorized imported from ../utils/auth

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

async function optimizeUploadedImage(filePath, originalExt) {
  if (!sharp) {
    return true;
  }

  const ext = String(originalExt || '').toLowerCase();

  // Animated GIFs are left untouched to avoid flattening animation frames.
  if (ext === '.gif') {
    return true;
  }

  const tempPath = `${filePath}.optimized`;

  try {
    let pipeline = sharp(filePath, { failOnError: false })
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: 'inside',
        withoutEnlargement: true,
      });

    if (ext === '.png') {
      pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true });
    } else if (ext === '.webp') {
      pipeline = pipeline.webp({ quality: 82, effort: 4 });
    } else {
      pipeline = pipeline.jpeg({ quality: 82, mozjpeg: true });
    }

    await pipeline.toFile(tempPath);

    // Replace the original file atomically enough for local/shared hosting storage.
    await fs.unlink(filePath);
    await fs.rename(tempPath, filePath);

    // Also create a small display-size variant for thumbnails (skip for GIF)
    if (ext !== '.gif') {
      try {
        const smallPath = filePath.replace(/(\.[^.]+)$/, '-sm$1');
        let thumb = sharp(filePath, { failOnError: false }).rotate().resize({ width: 400, fit: 'inside', withoutEnlargement: true });
        if (ext === '.png') thumb = thumb.png({ compressionLevel: 9 });
        else if (ext === '.webp') thumb = thumb.webp({ quality: 80 });
        else thumb = thumb.jpeg({ quality: 80 });
        await thumb.toFile(smallPath);
      } catch (e) {
        // Non-fatal: if thumbnail generation fails, continue with main image
      }
    }

    return true;
  } catch (error) {
    await fs.unlink(tempPath).catch(() => {});
    return false;
  }
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

// normalizeOptionalString imported from ../utils/normalize

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
// normalizeImageUrl imported from ../utils/normalize

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
 * Supports both OFFSET-based (?page=N) and cursor-based (?cursor=X) pagination.
 * Cursor pagination is faster for deep pages and used for next/prev navigation.
 * Query params: ?page=1&limit=20&category=flora&cursor=<encoded>
 */

// Cached total count to avoid repeated full-table scans
let totalCountCache = { key: '', count: 0, timestamp: 0 };
const TOTAL_COUNT_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

async function getAllSpecies(req, res, next) {
  try {
    const isAdmin = isAdminAuthorized(req);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const cursorParam = req.query.cursor || null;

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

    // --- Cursor-based keyset pagination ---
    // Cursor encodes the last seen (created_at, id) so PostgreSQL can
    // seek directly to the next row via index instead of scanning OFFSET rows.
    let useCursor = false;
    if (cursorParam) {
      try {
        const decoded = JSON.parse(Buffer.from(cursorParam, 'base64url').toString());
        if (decoded.d && decoded.i) {
          conditions.push(`(s.created_at, s.id) < ($${paramIndex++}, $${paramIndex++})`);
          values.push(decoded.d, decoded.i);
          useCursor = true;
        }
      } catch { /* invalid cursor, fall back to offset */ }
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    // Build the filter signature for count caching
    const filterKey = `${isAdmin}:${whereClause}:${values.slice(0, values.length - (useCursor ? 2 : 0)).join(',')}`;

    // Get total count (cached to avoid repeated full-table scans)
    let totalRecords = 0;
    if (totalCountCache.key === filterKey && (Date.now() - totalCountCache.timestamp < TOTAL_COUNT_CACHE_TTL)) {
      totalRecords = totalCountCache.count;
    } else {
      // Build WHERE without the cursor condition for accurate total count
      const countConditions = conditions.slice(0, conditions.length - (useCursor ? 1 : 0));
      const countValues = values.slice(0, values.length - (useCursor ? 2 : 0));
      const countWhere = countConditions.length > 0 ? `WHERE ${countConditions.join(' AND ')}` : '';
      const countResult = await pool.query(
        `SELECT COUNT(*) FROM species s LEFT JOIN taxonomy t ON t.species_id = s.id ${countWhere}`,
        countValues
      );
      totalRecords = parseInt(countResult.rows[0].count, 10);
      totalCountCache = { key: filterKey, count: totalRecords, timestamp: Date.now() };
    }

    const totalPages = Math.ceil(totalRecords / limit);

    // Data query — uses keyset when cursor provided, OFFSET otherwise
    const dataQuery = `
      SELECT 
        s.id AS internal_id,
        s.public_id,
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
      ORDER BY s.created_at DESC, s.id DESC
      LIMIT $${paramIndex++}
      ${useCursor ? '' : `OFFSET $${paramIndex++}`}
    `;

    if (useCursor) {
      values.push(limit);
    } else {
      const offset = (page - 1) * limit;
      values.push(limit, offset);
    }

    const dataResult = await pool.query(dataQuery, values);

    // Normalize image URLs for mobile compatibility and expose thumbnail URLs when available
    const normalizedRows = await Promise.all(dataResult.rows.map(async (row) => {
      const base = {
        ...row,
        primary_image: row.primary_image ? normalizeImageUrl(row.primary_image) : null,
        primary_image_thumbnail: null,
      };

      // If the primary image is a local upload, check for a small variant
      if (base.primary_image && base.primary_image.startsWith('/uploads/')) {
        try {
          const origName = path.basename(row.primary_image);
          const smallName = origName.replace(/(\.[^.]+)$/, '-sm$1');
          const smallFs = path.resolve(process.cwd(), 'uploads', smallName);
          await fs.access(smallFs);
          base.primary_image_thumbnail = `/uploads/${smallName}`;
        } catch (e) {
          // no thumbnail available, leave null
        }
      }

      // For public (non-admin) requests, use `public_id` as the URL identifier.
      if (!isAdmin) {
        base.id = base.public_id || base.internal_id;
      } else {
        base.id = base.internal_id;
      }
      // Remove internal helper fields to keep payload tidy
      delete base.public_id;
      delete base.internal_id;
      return base;
    }));

    // Build next cursor from the last row
    let nextCursor = null;
    if (normalizedRows.length === limit) {
      const lastRow = dataResult.rows[dataResult.rows.length - 1];
      nextCursor = Buffer.from(JSON.stringify({
        d: lastRow.created_at,
        i: lastRow.internal_id || lastRow.id,
      })).toString('base64url');
    }

    res.json({
      success: true,
      data: normalizedRows,
      pagination: {
        page: useCursor ? null : page,
        limit,
        totalRecords,
        totalPages,
        hasNextPage: useCursor ? normalizedRows.length === limit : page < totalPages,
        hasPreviousPage: useCursor ? true : page > 1,
        nextCursor,
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
    // Public requests should resolve by `public_id` and only return published records.
    // Admin requests continue to resolve by internal `id`.
    const speciesQuery = isAdmin
      ? `
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
      `
      : `
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
        WHERE s.public_id = $1 AND s.status = 'published'
      `;

    const speciesResult = await pool.query(speciesQuery, [id]);

    if (speciesResult.rows.length === 0) {
      // If admin requested and no result by internal id, try resolving by public_id so admins
      // can view public URLs as well.
      if (isAdmin) {
        const altQuery = `
          SELECT s.*, t.kingdom, t.phylum, t.class, t."order", t.family, t.genus
          FROM species s
          LEFT JOIN taxonomy t ON t.species_id = s.id
          WHERE s.public_id = $1
        `;
        const altResult = await pool.query(altQuery, [id]);
        if (altResult.rows.length > 0) {
          speciesResult.rows = altResult.rows;
        }
      }

      if (speciesResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Species with ID ${id} not found`,
        });
      }
    }

    // Fetch all images for this species (use internal species.id)
    const imagesResult = await pool.query(
      'SELECT id, image_url, image_credit, is_primary, created_at FROM images WHERE species_id = $1 ORDER BY is_primary DESC, created_at ASC',
      [speciesResult.rows[0].id]
    );

    const species = speciesResult.rows[0];

    // Normalize image URLs for mobile compatibility and provide thumbnail_url when available
    const normalizedImages = await Promise.all(imagesResult.rows.map(async (img) => {
      const image_url = normalizeImageUrl(img.image_url);
      let thumbnail_url = null;
      if (img.image_url && img.image_url.startsWith('/uploads/')) {
        try {
          const origName = path.basename(img.image_url);
          const smallName = origName.replace(/(\.[^.]+)$/, '-sm$1');
          const smallFs = path.resolve(process.cwd(), 'uploads', smallName);
          await fs.access(smallFs);
          thumbnail_url = `/uploads/${smallName}`;
        } catch (e) {
          // no thumbnail
        }
      }
      return {
        ...img,
        image_url,
        thumbnail_url,
      };
    }));

    // Fetch Next and Previous species
    const npQuery = `
      (
        SELECT id, public_id, scientific_name, english_name, 'previous' as rel
        FROM species
        WHERE status = 'published' AND id < $1
        ORDER BY id DESC LIMIT 1
      )
      UNION ALL
      (
        SELECT id, public_id, scientific_name, english_name, 'next' as rel
        FROM species
        WHERE status = 'published' AND id > $1
        ORDER BY id ASC LIMIT 1
      )
    `;
    const npResult = await pool.query(npQuery, [species.id]);
    let previous_species = npResult.rows.find(r => r.rel === 'previous') || null;
    let next_species = npResult.rows.find(r => r.rel === 'next') || null;
    if (previous_species) {
       if (!isAdmin) previous_species.id = previous_species.public_id || previous_species.id;
       delete previous_species.public_id; delete previous_species.rel;
    }
    if (next_species) {
       if (!isAdmin) next_species.id = next_species.public_id || next_species.id;
       delete next_species.public_id; delete next_species.rel;
    }

    // Fetch related species (same family)
    let related_species = [];
    if (species.family) {
      const relatedQuery = `
        SELECT s.id, s.public_id, s.scientific_name, s.english_name, i.image_url as primary_image
        FROM species s
        JOIN taxonomy t ON t.species_id = s.id
        LEFT JOIN images i ON i.species_id = s.id AND i.is_primary = TRUE
        WHERE t.family = $1 AND s.id != $2 AND s.status = 'published'
        ORDER BY s.created_at DESC
        LIMIT 4
      `;
      const relatedResult = await pool.query(relatedQuery, [species.family, species.id]);
      related_species = relatedResult.rows.map(r => {
         const ret = {
           ...r,
           primary_image: r.primary_image ? normalizeImageUrl(r.primary_image) : null
         };
         if (!isAdmin) ret.id = ret.public_id || ret.id;
         delete ret.public_id;
         return ret;
      });
    }

    // Structure taxonomy as a nested object
    const response = {
      id: species.id,
      public_id: species.public_id,
      scientific_name: species.scientific_name,
      english_name: species.english_name,
      bengali_name: species.bengali_name,
      category: species.category,
      origin: species.origin,
      description: species.description,
      habitat: species.habitat,
      conservation_status: species.conservation_status,
      residency_status: species.residency_status,
      references: species.references,
      external_links: species.external_links,
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
      previous_species,
      next_species,
      related_species,
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
      residency_status,
      references,
      external_links,
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
         habitat, conservation_status, residency_status, "references", external_links, location_coordinates, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
        residency_status || 'resident',
        references || null,
        external_links ? JSON.stringify(external_links) : '{}',
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

    // 3. Insert images (if provided) — batch insert for performance
    if (normalizedImages.length > 0) {
      const imgValues = [];
      const imgPlaceholders = [];
      let imgIdx = 1;
      for (const img of normalizedImages) {
        imgPlaceholders.push(`($${imgIdx++}, $${imgIdx++}, $${imgIdx++}, $${imgIdx++})`);
        imgValues.push(newSpecies.id, img.image_url, img.image_credit, img.is_primary || false);
      }
      await client.query(
        `INSERT INTO images (species_id, image_url, image_credit, is_primary)
         VALUES ${imgPlaceholders.join(', ')}`,
        imgValues
      );
    }

    await client.query('COMMIT');
    invalidateStatsCache();

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
      residency_status,
      references,
      external_links,
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

    // Handle location_coordinates carefully: only update when the client provides the field.
    // If omitted (undefined), we leave it untouched; if provided, normalize into JSON (possibly empty array).
    let serializedCoordinates;
    if (location_coordinates === undefined) {
      serializedCoordinates = undefined;
    } else {
      const normalizedCoordinates = Array.isArray(location_coordinates)
        ? normalizeCoordinates(location_coordinates)
        : [];
      serializedCoordinates = JSON.stringify(normalizedCoordinates);
    }

    // Begin transaction BEFORE the FOR UPDATE lock so it's effective
    await client.query('BEGIN');

    // Check if species exists and lock the row for update to safely handle publish transitions
    const existing = await client.query('SELECT id, status, public_id FROM species WHERE id = $1 FOR UPDATE', [id]);
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: `Species with ID ${id} not found`,
      });
    }

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
    if (residency_status !== undefined) {
      updates.push(`residency_status = $${paramIndex++}`);
      params.push(residency_status);
    }
    if (references !== undefined) {
      updates.push(`"references" = $${paramIndex++}`);
      params.push(references);
    }
    if (external_links !== undefined) {
      updates.push(`external_links = $${paramIndex++}`);
      params.push(JSON.stringify(external_links));
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

    // If status transitioned to 'published' and public_id is not set, assign one now.
    try {
      const prevStatus = existing.rows[0].status;
      const prevPublicId = existing.rows[0].public_id;
      const newStatus = updateResult.rows[0].status;

      if (newStatus === 'published' && prevStatus !== 'published' && !prevPublicId) {
        // Reserve next public id from sequence and assign
        const seqRes = await client.query("SELECT nextval('species_public_id_seq') AS next_pub_id");
        const nextPubId = seqRes.rows[0].next_pub_id;
        await client.query('UPDATE species SET public_id = $1 WHERE id = $2', [nextPubId, id]);
        // Reflect in the updateResult row for response
        updateResult.rows[0].public_id = nextPubId;
      }
    } catch (errPub) {
      // If sequence/permission fails, rollback and surface error
      await client.query('ROLLBACK');
      return res.status(500).json({ success: false, message: 'Failed to assign public_id during publish. Check DB permissions.' });
    }

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
    invalidateStatsCache();

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

    // 1. Find locally uploaded images to clean up from disk
    const imgResult = await pool.query(
      'SELECT image_url FROM images WHERE species_id = $1',
      [id]
    );

    // 2. Delete species (CASCADE removes images + taxonomy rows from DB)
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

    // 3. Delete local image files from disk (ignore external URLs)
    const path = require('path');
    const fs = require('fs');
    // __dirname = backend/src/controllers/, go up 2 levels to backend/
    const backendDir = path.join(__dirname, '..', '..');

    for (const row of imgResult.rows) {
      const url = row.image_url;
      // Only delete files that are local uploads (start with /uploads/)
      if (url && url.startsWith('/uploads/')) {
        const filePath = path.join(backendDir, url);
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`[Delete] Removed file: ${filePath}`);
          }
        } catch (fileErr) {
          // Log but don't fail the request if file cleanup fails
          console.error(`[Delete] Failed to remove file ${filePath}:`, fileErr.message);
        }
      }
    }

    res.json({
      success: true,
      message: `Species "${result.rows[0].scientific_name}" deleted successfully`,
    });
    invalidateStatsCache();
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/species/stats/overview
 * Get dashboard statistics (total species, flora/fauna counts, status counts).
 * Results are cached in memory for 5 minutes to avoid repeated full-table scans.
 */
const statsCache = { public: null, admin: null };
const STATS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
function invalidateStatsCache() { statsCache.public = null; statsCache.admin = null; }

async function getStats(req, res, next) {
  try {
    const isAdmin = isAdminAuthorized(req);
    const cacheKey = isAdmin ? 'admin' : 'public';

    // Return cached stats if still fresh
    const cached = statsCache[cacheKey];
    if (cached && (Date.now() - cached.timestamp < STATS_CACHE_TTL)) {
      return res.json({ success: true, data: cached.data });
    }

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

    // Cache the result
    statsCache[cacheKey] = { data: result.rows[0], timestamp: Date.now() };

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

    const filePath = path.join(__dirname, '../../uploads', req.file.filename);
    const image_url = `/uploads/${req.file.filename}`;

    // Optimize the uploaded image
    const optimizationResult = await optimizeUploadedImage(filePath, path.extname(req.file.filename));
    if (!optimizationResult) {
      console.warn('[ImageUpload] Optimization skipped or failed, keeping original file:', req.file.filename);
    }

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
