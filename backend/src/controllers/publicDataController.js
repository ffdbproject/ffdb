const { pool } = require('../config/db');
const xlsx = require('xlsx');

/**
 * Public Data Dump endpoint for researchers.
 * GET /api/public/data-dump?format=json|csv
 * Returns all published species records in clean JSON or CSV format.
 */
async function getPublicDataDump(req, res) {
  try {
    // 1. Query only published species
    const speciesRes = await pool.query(
      `SELECT
        id, public_id, scientific_name, english_name, bengali_name,
        category, origin, description, habitat, conservation_status,
        conservation_status_year, bd_conservation_status, bd_conservation_status_year,
        residency_status, location_coordinates, external_links, "references",
        status, published_at, created_at, updated_at
       FROM species
       WHERE status = 'published'
       ORDER BY id ASC`
    );
    const speciesList = speciesRes.rows;

    // 2. Fetch taxonomy for published species
    const taxonomyRes = await pool.query('SELECT * FROM taxonomy');
    const taxonomyMap = {};
    taxonomyRes.rows.forEach(t => {
      taxonomyMap[t.species_id] = {
        kingdom: t.kingdom,
        phylum: t.phylum,
        class: t.class,
        order: t.order,
        family: t.family,
        genus: t.genus,
        taxonomic_authority: t.taxonomic_authority,
        authority_year: t.authority_year
      };
    });

    // 3. Fetch primary and secondary images for published species
    const imagesRes = await pool.query(
      `SELECT species_id, image_url, image_credit, is_primary
       FROM images
       ORDER BY is_primary DESC, id ASC`
    );
    const imagesMap = {};
    imagesRes.rows.forEach(img => {
      if (!imagesMap[img.species_id]) imagesMap[img.species_id] = [];
      imagesMap[img.species_id].push({
        image_url: img.image_url,
        image_credit: img.image_credit,
        is_primary: img.is_primary
      });
    });

    // Build public payload
    const dumpData = speciesList.map(s => ({
      public_id: s.public_id,
      scientific_name: s.scientific_name,
      english_name: s.english_name,
      bengali_name: s.bengali_name,
      category: s.category,
      origin: s.origin,
      conservation_status: s.conservation_status,
      conservation_status_year: s.conservation_status_year,
      bd_conservation_status: s.bd_conservation_status,
      bd_conservation_status_year: s.bd_conservation_status_year,
      residency_status: s.residency_status,
      description: s.description,
      habitat: s.habitat,
      taxonomy: taxonomyMap[s.id] || null,
      images: imagesMap[s.id] || [],
      location_coordinates: s.location_coordinates,
      external_links: s.external_links,
      references: s.references,
      status: s.status,
      published_at: s.published_at,
      created_at: s.created_at,
      updated_at: s.updated_at
    }));

    const format = (req.query.format || 'json').toLowerCase();
    const dateStr = new Date().toISOString().slice(0, 10);

    if (format === 'csv') {
      const rows = dumpData.map(s => ({
        public_id: s.public_id,
        scientific_name: s.scientific_name,
        english_name: s.english_name || '',
        bengali_name: s.bengali_name || '',
        category: s.category,
        origin: s.origin || '',
        conservation_status: s.conservation_status || '',
        residency_status: s.residency_status || '',
        kingdom: s.taxonomy?.kingdom || '',
        phylum: s.taxonomy?.phylum || '',
        class: s.taxonomy?.class || '',
        order: s.taxonomy?.order || '',
        family: s.taxonomy?.family || '',
        genus: s.taxonomy?.genus || '',
        taxonomic_authority: s.taxonomy?.taxonomic_authority || '',
        authority_year: s.taxonomy?.authority_year || '',
        description: s.description || '',
        habitat: s.habitat || '',
        conservation_status_year: s.conservation_status_year || '',
        bd_conservation_status: s.bd_conservation_status || '',
        bd_conservation_status_year: s.bd_conservation_status_year || '',
        primary_image: s.images.find(img => img.is_primary)?.image_url || s.images[0]?.image_url || '',
        images: JSON.stringify(s.images),
        location_coordinates: JSON.stringify(s.location_coordinates || []),
        external_links: JSON.stringify(s.external_links || {}),
        references: JSON.stringify(s.references || []),
        status: s.status || '',
        published_at: s.published_at || '',
        created_at: s.created_at,
        updated_at: s.updated_at
      }));

      const ws = xlsx.utils.json_to_sheet(rows);
      const csv = xlsx.utils.sheet_to_csv(ws);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="ffdb-public-data-${dateStr}.csv"`);
      return res.send(`\uFEFF${csv}`);
    }

    // Default JSON
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="ffdb-public-data-${dateStr}.json"`);
    return res.json({
      success: true,
      meta: {
        title: "Flora and Fauna Database of Bangladesh (FFDB) Public Dataset",
        license: "https://creativecommons.org/licenses/by/4.0/",
        exported_at: new Date().toISOString(),
        total_records: dumpData.length
      },
      data: dumpData
    });
  } catch (err) {
    console.error('[Public Data Dump] Error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate public data dump' });
  }
}

module.exports = { getPublicDataDump };
