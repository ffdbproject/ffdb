// ============================================================
// Enrichment Controller — admin endpoints to enrich species data
// Uses `enrichmentService` to fetch external data and persists
// useful fields into the local DB (description, habitat, taxonomy,
// images, coords).
// Protected by `adminAuth` route middleware.
// ============================================================

const { pool } = require('../config/db');
const { enrichByScientificName } = require('../services/enrichmentService');

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

async function enrichSpeciesById(req, res, next) {
  let client;
  try {
    client = await pool.connect();
    const { id } = req.params;
    console.log(`[Enrich] Starting enrichment for species ${id}`);

    if (!/^[0-9]+$/.test(id)) {
      return res.status(400).json({ success: false, message: 'Invalid species id' });
    }

    const spRes = await client.query(
      'SELECT id, scientific_name, description, habitat, location_coordinates FROM species WHERE id = $1',
      [id]
    );
    if (spRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: `Species ${id} not found` });
    }

    const species = spRes.rows[0];
    const name = species.scientific_name;
    console.log(`[Enrich] Species name: "${name}"`);

    if (!name) {
      return res.status(400).json({ success: false, message: 'Species missing scientific_name, cannot enrich' });
    }

    let enriched = { description: null, habitat: null, taxonomy: null, images: [], coords: [], sources: [] };
    try {
      enriched = await enrichByScientificName(name);
      console.log(`[Enrich] Got enrichment data:`, {
        hasDesc: !!enriched.description,
        hasHabitat: !!enriched.habitat,
        hasTaxonomy: !!enriched.taxonomy,
        imageCount: enriched.images.length,
        coordCount: enriched.coords.length,
      });
    } catch (fetchErr) {
      console.error(`[Enrich] Fetch failed but continuing gracefully:`, fetchErr.message);
    }

    await client.query('BEGIN');

    const updates = {};

    if (enriched.description && (!species.description || species.description.trim() === '')) {
      updates.description = enriched.description;
      await client.query('UPDATE species SET description = $1 WHERE id = $2', [enriched.description, id]);
      console.log('[Enrich] Added description');
    }

    if (enriched.habitat && (!species.habitat || species.habitat.trim() === '')) {
      updates.habitat = enriched.habitat;
      await client.query('UPDATE species SET habitat = $1 WHERE id = $2', [enriched.habitat, id]);
      console.log('[Enrich] Added habitat');
    }

    if (enriched.taxonomy && typeof enriched.taxonomy === 'object') {
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
          enriched.taxonomy.kingdom,
          enriched.taxonomy.phylum,
          enriched.taxonomy.class,
          enriched.taxonomy.order,
          enriched.taxonomy.family,
          enriched.taxonomy.genus,
        ]
      );
      updates.taxonomy_added = true;
      console.log('[Enrich] Upserted taxonomy');
    }

    const existingCoords = Array.isArray(species.location_coordinates) ? species.location_coordinates : [];
    if ((!existingCoords || existingCoords.length === 0) && Array.isArray(enriched.coords) && enriched.coords.length > 0) {
      const limited = enriched.coords.slice(0, 10);
      await client.query('UPDATE species SET location_coordinates = $1 WHERE id = $2', [JSON.stringify(limited), id]);
      updates.coords_added = limited.length;
      console.log(`[Enrich] Added ${limited.length} coordinates`);
    }

    let imagesAdded = 0;
    if (Array.isArray(enriched.images) && enriched.images.length > 0) {
      const images = enriched.images.slice(0, 8);
      for (const img of images) {
        if (!img || !img.url) continue;
        
        // Normalize HTTP URLs to HTTPS for mobile compatibility
        const normalizedUrl = normalizeImageUrl(img.url);
        if (normalizedUrl !== img.url) {
          console.log(`[Enrich] Normalized image URL from HTTP to HTTPS`);
        }
        
        if (String(normalizedUrl).length > 500) {
          console.log(`[Enrich] Skipping image URL (too long): ${String(normalizedUrl).substring(0, 100)}...`);
          continue;
        }

        try {
          const exists = await client.query('SELECT id FROM images WHERE species_id = $1 AND image_url = $2', [id, normalizedUrl]);
          if (exists.rows.length === 0) {
            await client.query(
              'INSERT INTO images (species_id, image_url, image_credit, is_primary) VALUES ($1, $2, $3, $4)',
              [id, normalizedUrl, img.image_credit || img.source || null, false]
            );
            imagesAdded += 1;
          }
        } catch (imgErr) {
          console.error('[Enrich] Failed to insert image:', imgErr.message);
        }
      }
      console.log(`[Enrich] Added ${imagesAdded} images`);
    }

    await client.query('COMMIT');
    console.log(`[Enrich] Committed transaction for species ${id}`);

    res.json({
      success: true,
      message: 'Enrichment completed',
      data: {
        species_id: id,
        description_added: Boolean(updates.description),
        habitat_added: Boolean(updates.habitat),
        taxonomy_added: Boolean(updates.taxonomy_added),
        coords_added: updates.coords_added || 0,
        images_added: imagesAdded,
        sources: enriched.sources || [],
      },
    });
  } catch (err) {
    console.error('[Enrich] CAUGHT ERROR:', err.message);
    console.error('[Enrich] Stack:', err.stack);
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }
    res.status(500).json({
      success: false,
      message: 'Enrichment failed',
      error: err.message,
      details: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}

module.exports = { enrichSpeciesById };
