const { pool } = require('../config/db');

async function exportDatabase(req, res) {
  try {
    // Fetch all species
    const speciesRes = await pool.query('SELECT * FROM species ORDER BY id ASC');
    const speciesList = speciesRes.rows;

    // Fetch all taxonomy
    const taxonomyRes = await pool.query('SELECT * FROM taxonomy');
    const taxonomyMap = {};
    taxonomyRes.rows.forEach(t => {
      taxonomyMap[t.species_id] = t;
    });

    // Fetch all images
    const imagesRes = await pool.query('SELECT * FROM images');
    const imagesMap = {};
    imagesRes.rows.forEach(img => {
      if (!imagesMap[img.species_id]) imagesMap[img.species_id] = [];
      imagesMap[img.species_id].push(img);
    });

    // Construct JSON
    const exportData = speciesList.map(s => ({
      ...s,
      taxonomy: taxonomyMap[s.id] || null,
      images: imagesMap[s.id] || []
    }));

    res.json({ success: true, data: exportData });
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ success: false, message: 'Failed to export database' });
  }
}

async function importDatabase(req, res) {
  let client;
  try {
    const importData = req.body;
    if (!Array.isArray(importData)) {
      return res.status(400).json({ success: false, message: 'Invalid data format. Expected an array of species.' });
    }

    client = await pool.connect();
    await client.query('BEGIN');

    let inserted = 0;
    let updated = 0;

    for (const s of importData) {
      if (!s.scientific_name) continue;

      // Upsert species by scientific_name
      const speciesQuery = `
        INSERT INTO species (
          scientific_name, english_name, bengali_name, category, origin,
          description, habitat, conservation_status, location_coordinates, status,
          public_id, internal_id, external_links, references, residency_status
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
        )
        ON CONFLICT (scientific_name) DO UPDATE SET
          english_name = EXCLUDED.english_name,
          bengali_name = EXCLUDED.bengali_name,
          category = EXCLUDED.category,
          origin = EXCLUDED.origin,
          description = EXCLUDED.description,
          habitat = EXCLUDED.habitat,
          conservation_status = EXCLUDED.conservation_status,
          location_coordinates = EXCLUDED.location_coordinates,
          status = EXCLUDED.status,
          external_links = EXCLUDED.external_links,
          references = EXCLUDED.references,
          residency_status = EXCLUDED.residency_status
        RETURNING id, (xmax = 0) AS is_insert;
      `;
      
      const speciesValues = [
        s.scientific_name,
        s.english_name || null,
        s.bengali_name || null,
        s.category || 'flora',
        s.origin || 'native',
        s.description || null,
        s.habitat || null,
        s.conservation_status || null,
        s.location_coordinates ? JSON.stringify(s.location_coordinates) : '[]',
        s.status || 'draft',
        s.public_id || null,
        s.internal_id || null,
        s.external_links ? JSON.stringify(s.external_links) : '{}',
        s.references ? JSON.stringify(s.references) : '[]',
        s.residency_status || 'resident'
      ];

      const speciesResult = await client.query(speciesQuery, speciesValues);
      const newSpeciesId = speciesResult.rows[0].id;
      const isInsert = speciesResult.rows[0].is_insert;
      
      if (isInsert) inserted++; else updated++;

      // Upsert taxonomy
      if (s.taxonomy) {
        const t = s.taxonomy;
        await client.query(`
          INSERT INTO taxonomy (species_id, kingdom, phylum, class, "order", family, genus)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (species_id) DO UPDATE SET
            kingdom = EXCLUDED.kingdom,
            phylum = EXCLUDED.phylum,
            class = EXCLUDED.class,
            "order" = EXCLUDED."order",
            family = EXCLUDED.family,
            genus = EXCLUDED.genus
        `, [newSpeciesId, t.kingdom, t.phylum, t.class, t.order, t.family, t.genus]);
      }

      // Recreate images (delete existing for this species and insert from JSON)
      // This is safer because image count/order could change.
      if (Array.isArray(s.images)) {
        await client.query('DELETE FROM images WHERE species_id = $1', [newSpeciesId]);
        for (const img of s.images) {
          if (!img.image_url) continue;
          await client.query(`
            INSERT INTO images (species_id, image_url, image_credit, is_primary)
            VALUES ($1, $2, $3, $4)
          `, [newSpeciesId, img.image_url, img.image_credit, !!img.is_primary]);
        }
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, message: `Import complete: ${inserted} added, ${updated} updated.`, inserted, updated });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('Import error:', err);
    res.status(500).json({ success: false, message: 'Failed to import database: ' + err.message });
  } finally {
    if (client) client.release();
  }
}

module.exports = { exportDatabase, importDatabase };
