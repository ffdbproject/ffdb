// ============================================================
// FFDB - Flora and Fauna Database of Bangladesh
// GBIF Controller — Fetch species data from GBIF public API
//
// Workflow: Admin searches GBIF → selects a result → data
// populates the admin form → Admin adds bengali_name & local
// data → saves as draft → later publishes.
//
// GBIF API docs: https://www.gbif.org/developer/species
// No API key required (public, free, open-source).
// ============================================================

const GBIF_BASE = 'https://api.gbif.org/v1';
const THREAT_STATUS_MAP = {
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
  taxonomy: 100,
  image_url: 500,
};

function trimTo(value, maxLen) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

function normalizeThreatStatus(threatStatus) {
  if (!threatStatus || typeof threatStatus !== 'string') return '';
  const upper = threatStatus.trim().toUpperCase();
  if (!upper) return '';
  if (['LC', 'NT', 'VU', 'EN', 'CR', 'EW', 'EX'].includes(upper)) return upper;
  const aliasKey = upper.replace(/[^A-Z]+/g, '_').replace(/^_+|_+$/g, '');
  return THREAT_STATUS_MAP[aliasKey] || '';
}

/**
 * Helper: Fetch JSON from a URL using Node's native fetch with a timeout.
 */
async function fetchJSON(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`GBIF API error: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`GBIF API request timed out after ${timeoutMs}ms`);
    }
    throw err;
  }
}

/**
 * GET /api/admin/gbif/search?q=panthera+tigris&limit=10
 *
 * Search GBIF species database.
 * Returns a simplified list of matching species with key, scientific name,
 * common name, rank, and status.
 */
async function searchGBIF(req, res, next) {
  try {
    const { q } = req.query;
    const limit = Math.min(20, parseInt(req.query.limit, 10) || 10);

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query "q" is required (minimum 2 characters).',
      });
    }

    const url = `${GBIF_BASE}/species/search?q=${encodeURIComponent(q.trim())}&limit=${limit}&rank=SPECIES&status=ACCEPTED`;
    const data = await fetchJSON(url);

    // Map to a clean, simplified format for the admin UI
    const results = (Array.isArray(data.results) ? data.results : []).map((sp) => ({
      gbif_key: sp.key,
      scientific_name: trimTo(sp.scientificName || sp.canonicalName || '', FIELD_LIMITS.scientific_name),
      english_name: trimTo(sp.vernacularNames?.find((v) => v.language === 'eng')?.vernacularName || '', FIELD_LIMITS.english_name),
      rank: sp.rank || '',
      status: sp.taxonomicStatus || '',
      kingdom: trimTo(sp.kingdom || '', FIELD_LIMITS.taxonomy),
      phylum: trimTo(sp.phylum || '', FIELD_LIMITS.taxonomy),
      class: trimTo(sp.class || '', FIELD_LIMITS.taxonomy),
      order: trimTo(sp.order || '', FIELD_LIMITS.taxonomy),
      family: trimTo(sp.family || '', FIELD_LIMITS.taxonomy),
      genus: trimTo(sp.genus || '', FIELD_LIMITS.taxonomy),
    }));

    res.json({
      success: true,
      query: q.trim(),
      totalResults: data.count,
      data: results,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/gbif/species/:gbifKey
 *
 * Fetch detailed species information from GBIF by its key.
 * Returns taxonomy, vernacular names, descriptions, and media
 * in a format ready to populate the admin form.
 */
async function getGBIFSpecies(req, res, next) {
  try {
    const { gbifKey } = req.params;

    // Fetch species detail, vernacular names, descriptions, and media in parallel
    const [species, vernaculars, descriptions, media] = await Promise.all([
      fetchJSON(`${GBIF_BASE}/species/${gbifKey}`),
      fetchJSON(`${GBIF_BASE}/species/${gbifKey}/vernacularNames?limit=20`).catch((err) => {
        console.error(`Failed to fetch vernacular names for ${gbifKey}:`, err.message);
        return { results: [] };
      }),
      fetchJSON(`${GBIF_BASE}/species/${gbifKey}/descriptions?limit=5`).catch((err) => {
        console.error(`Failed to fetch descriptions for ${gbifKey}:`, err.message);
        return { results: [] };
      }),
      fetchJSON(`${GBIF_BASE}/species/${gbifKey}/media?limit=10`).catch((err) => {
        console.error(`Failed to fetch media for ${gbifKey}:`, err.message);
        return { results: [] };
      }),
    ]);

    // Extract English common name
    const vernacularResults = Array.isArray(vernaculars.results) ? vernaculars.results : [];
    const descriptionResults = Array.isArray(descriptions.results) ? descriptions.results : [];
    const mediaResults = Array.isArray(media.results) ? media.results : [];

    const englishName = trimTo(vernacularResults
      ?.find((v) => v.language === 'eng' || v.language === 'en')
      ?.vernacularName || '', FIELD_LIMITS.english_name);

    // Extract Bengali common name (if available in GBIF — rare but possible)
    const bengaliName = trimTo(vernacularResults
      ?.find((v) => v.language === 'ben' || v.language === 'bn')
      ?.vernacularName || '', FIELD_LIMITS.bengali_name);

    // Extract first available description
    const description = descriptionResults[0]?.description || descriptionResults[0]?.value || '';

    // Determine category (flora vs fauna) from kingdom
    const kingdom = (species.kingdom || '').toLowerCase();
    let category = '';
    if (['plantae', 'fungi'].includes(kingdom)) {
      category = 'flora';
    } else if (['animalia'].includes(kingdom)) {
      category = 'fauna';
    }

    // Extract media/images
    const images = mediaResults
      .filter((m) => m.type === 'StillImage' && m.identifier)
      .slice(0, 5)
      .map((m) => ({
        url: trimTo(m.identifier, FIELD_LIMITS.image_url),
        source: m.source || '',
        license: m.license || '',
        creator: m.creator || '',
      }))
      .filter((img) => img.url);

    // Map IUCN threat status if available
    const conservationStatus = normalizeThreatStatus(species.threatStatus);

    // Build the pre-populated form data
    const formData = {
      gbif_key: species.key,
      scientific_name: trimTo(species.scientificName || species.canonicalName || '', FIELD_LIMITS.scientific_name),
      english_name: englishName,
      bengali_name: bengaliName,
      category,
      description: cleanHTML(description),
      habitat: '',           // GBIF rarely provides habitat — admin fills this
      conservation_status: conservationStatus,
      taxonomy: {
        kingdom: trimTo(species.kingdom || '', FIELD_LIMITS.taxonomy),
        phylum: trimTo(species.phylum || '', FIELD_LIMITS.taxonomy),
        class: trimTo(species.class || '', FIELD_LIMITS.taxonomy),
        order: trimTo(species.order || '', FIELD_LIMITS.taxonomy),
        family: trimTo(species.family || '', FIELD_LIMITS.taxonomy),
        genus: trimTo(species.genus || '', FIELD_LIMITS.taxonomy),
      },
      gbif_images: images,   // External URLs for admin to download/upload locally
      all_vernacular_names: vernacularResults.map((v) => ({
        name: v.vernacularName,
        language: v.language,
      })) || [],
    };

    res.json({ success: true, data: formData });
  } catch (err) {
    next(err);
  }
}

/**
 * Strip basic HTML tags from GBIF descriptions.
 */
function cleanHTML(html) {
  if (!html) return '';

  if (Array.isArray(html)) {
    return html
      .map((item) => cleanHTML(item))
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  if (typeof html === 'object') {
    return cleanHTML(html.description || html.value || html.text || '');
  }

  if (typeof html !== 'string') {
    return String(html).trim();
  }

  return html
    .replace(/<[^>]+>/g, '')   // Remove HTML tags
    .replace(/&nbsp;/g, ' ')   // Replace HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')      // Collapse whitespace
    .trim();
}

module.exports = { searchGBIF, getGBIFSpecies };
