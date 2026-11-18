const { pool } = require('../config/db');
const xlsx = require('xlsx');
const path = require('path');

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

    // Construct export structure
    const exportData = speciesList.map(s => ({
      ...s,
      taxonomy: taxonomyMap[s.id] || null,
      images: imagesMap[s.id] || []
    }));

    const format = (req.query.format || 'json').toLowerCase();

    if (format === 'json') {
      return res.json({ success: true, data: exportData });
    }

    // For CSV/XLSX we flatten each species into a single row with JSON strings for nested fields
    const rows = exportData.map(s => ({
      id: s.id,
      public_id: s.public_id,
      scientific_name: s.scientific_name,
      english_name: s.english_name,
      bengali_name: s.bengali_name,
      category: s.category,
      origin: s.origin,
      description: s.description,
      habitat: s.habitat,
      conservation_status: s.conservation_status,
      residency_status: s.residency_status,
      status: s.status,
      created_at: s.created_at,
      updated_at: s.updated_at,
      taxonomy: JSON.stringify(s.taxonomy || {}),
      images: JSON.stringify(s.images || []),
    }));

    const ws = xlsx.utils.json_to_sheet(rows);

    if (format === 'csv') {
      const csv = xlsx.utils.sheet_to_csv(ws);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="ffdb-export-${new Date().toISOString().slice(0,10)}.csv"`);
      return res.send(csv);
    }

    // Default: xlsx
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Species');
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="ffdb-export-${new Date().toISOString().slice(0,10)}.xlsx"`);
    return res.send(buf);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ success: false, message: 'Failed to export database' });
  }
}

async function importDatabase(req, res) {
  let client;
  try {
    // Support JSON body import or file upload (multipart/form-data with file field 'file')
    let importArray = null;
    if (req.file && req.file.buffer) {
      const origName = req.file.originalname || '';
      const ext = path.extname(origName).toLowerCase();
      // Try to parse with xlsx for csv/xlsx; fallback to JSON
      try {
        const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
        const first = wb.SheetNames[0];
        importArray = xlsx.utils.sheet_to_json(wb.Sheets[first], { defval: null });
      } catch (e) {
        // Not a spreadsheet — try JSON
        try {
          importArray = JSON.parse(req.file.buffer.toString('utf8'));
        } catch (je) {
          return res.status(400).json({ success: false, message: 'Unsupported file format for import' });
        }
      }
    } else if (Array.isArray(req.body)) {
      importArray = req.body;
    } else if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
      // Sometimes fetch sends JSON wrapped in object
      importArray = req.body.data || req.body;
    }

    if (!Array.isArray(importArray)) {
      return res.status(400).json({ success: false, message: 'Invalid import format: expected an array of species' });
    }

    client = await pool.connect();
    await client.query('BEGIN');

    let inserted = 0;
    let skipped = 0;

    for (const s of importArray) {
      if (!s || !s.scientific_name) continue;

      // Check existing by scientific_name — skip if exists
      const existsRes = await client.query('SELECT id FROM species WHERE scientific_name = $1 LIMIT 1', [s.scientific_name]);
      if (existsRes.rows.length > 0) {
        skipped++;
        continue;
      }

      // Insert species
      const insertRes = await client.query(
        `INSERT INTO species (
          scientific_name, english_name, bengali_name, category, origin,
          description, habitat, conservation_status, location_coordinates, status,
          public_id, internal_id, external_links, references, residency_status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
        [
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
          s.external_links ? (typeof s.external_links === 'string' ? s.external_links : JSON.stringify(s.external_links)) : '{}',
          s.references ? (typeof s.references === 'string' ? s.references : JSON.stringify(s.references)) : '[]',
          s.residency_status || 'resident'
        ]
      );

      const newId = insertRes.rows[0].id;

      // Insert taxonomy if present
      if (s.taxonomy) {
        const t = s.taxonomy;
        await client.query(`INSERT INTO taxonomy (species_id, kingdom, phylum, class, "order", family, genus) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [newId, t.kingdom, t.phylum, t.class, t.order, t.family, t.genus]);
      }

      // Insert images if present
      if (Array.isArray(s.images)) {
        for (const img of s.images) {
          if (!img || !img.image_url) continue;
          await client.query(`INSERT INTO images (species_id, image_url, image_credit, is_primary) VALUES ($1,$2,$3,$4)`, [newId, img.image_url, img.image_credit || null, !!img.is_primary]);
        }
      }

      inserted++;
    }

    await client.query('COMMIT');
    res.json({ success: true, message: `Import complete: ${inserted} added, ${skipped} skipped (duplicates).`, inserted, skipped });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('Import error:', err);
    res.status(500).json({ success: false, message: 'Failed to import database: ' + err.message });
  } finally {
    if (client) client.release();
  }
}

module.exports = { exportDatabase, importDatabase };
