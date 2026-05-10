// ============================================================
// Enrichment Service — Fetch description, images and coordinates
// Priority: Wikipedia (page summary) → GBIF species/occurrences (taxonomy, habitat, images + coords)
// ============================================================

const WIKIPEDIA_SUMMARY = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
const GBIF_SPECIES_SEARCH = 'https://api.gbif.org/v1/species/search';
const GBIF_SPECIES_BASE = 'https://api.gbif.org/v1/species';
const GBIF_OCCURRENCE_SEARCH = 'https://api.gbif.org/v1/occurrence/search';

function normalizeText(value) {
  if (!value) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function pickFirstText(...values) {
  for (const value of values) {
    const text = normalizeText(value);
    if (text) return text;
  }
  return '';
}

function buildImageCredit(image) {
  if (!image || typeof image !== 'object') return null;
  const parts = [image.creator, image.rightsHolder, image.license, image.source]
    .map(normalizeText)
    .filter(Boolean);
  return parts.length > 0 ? parts.join(' · ').slice(0, 500) : null;
}

function deriveHabitatFromText(text) {
  const normalized = normalizeText(text);
  if (!normalized) return '';

  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const habitatSentence = sentences.find((sentence) => /\b(habitat|inhabits|found in|occurs in|lives in|native to|grows in)\b/i.test(sentence));
  if (!habitatSentence) return '';

  return habitatSentence.replace(/^habitat[:\s-]*/i, '').trim().slice(0, 10000);
}

async function fetchJSON(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.error(`[Enrichment] Fetch timeout (${timeoutMs}ms) for URL: ${url}`);
    controller.abort();
  }, timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) {
      console.error(`[Enrichment] HTTP ${res.status} from ${url}`);
      throw new Error(`${res.status} ${res.statusText}`);
    }
    return await res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    console.error(`[Enrichment] Fetch error: ${err.message} (${url})`);
    throw err;
  }
}

/**
 * Try to get a short description and thumbnail from Wikipedia REST summary
 */
async function fetchFromWikipedia(scientificName) {
  if (!scientificName) return null;
  const title = encodeURIComponent(scientificName.replace(/\s+/g, '_'));
  try {
    const data = await fetchJSON(`${WIKIPEDIA_SUMMARY}${title}`, 15000); // Increased timeout for shared hosting
    const description = data.extract || null;
    const thumbnail = data.thumbnail?.source || null;
    return {
      description,
      habitat: deriveHabitatFromText(description),
      thumbnail,
      source: data.content_urls?.desktop?.page || null,
    };
  } catch (err) {
    console.error(`[Enrichment] Wikipedia lookup failed for "${scientificName}": ${err.message}`);
    return null;
  }
}

async function fetchFromGBIFSpecies(scientificName) {
  if (!scientificName) return null;

  const searchParams = new URLSearchParams({
    q: scientificName,
    limit: '5',
    rank: 'SPECIES',
    status: 'ACCEPTED',
  });

  try {
    const searchData = await fetchJSON(`${GBIF_SPECIES_SEARCH}?${searchParams.toString()}`, 12000);
    const firstMatch = Array.isArray(searchData.results) ? searchData.results[0] : null;
    if (!firstMatch) return null;

    const [descriptionsData] = await Promise.all([
      fetchJSON(`${GBIF_SPECIES_BASE}/${firstMatch.key}/descriptions?limit=10`, 12000).catch(() => ({ results: [] })),
    ]);

    const descriptionText = Array.isArray(descriptionsData.results)
      ? descriptionsData.results.map((item) => pickFirstText(item.description, item.value, item.text)).filter(Boolean).join(' ')
      : '';

    return {
      taxonomy: {
        kingdom: pickFirstText(firstMatch.kingdom),
        phylum: pickFirstText(firstMatch.phylum),
        class: pickFirstText(firstMatch.class),
        order: pickFirstText(firstMatch.order),
        family: pickFirstText(firstMatch.family),
        genus: pickFirstText(firstMatch.genus),
      },
      habitat: deriveHabitatFromText(descriptionText),
      source: `https://www.gbif.org/species/${firstMatch.key}`,
    };
  } catch (err) {
    console.error(`[Enrichment] GBIF species lookup failed for "${scientificName}": ${err.message}`);
    return null;
  }
}

/**
 * Query GBIF occurrences for images and coordinates as fallback
 */
async function fetchFromGBIF(scientificName, limit = 8) {
  if (!scientificName) return { images: [], coords: [] };
  const params = new URLSearchParams({ scientificName: scientificName, mediaType: 'StillImage', limit: String(limit) });
  try {
    const data = await fetchJSON(`${GBIF_OCCURRENCE_SEARCH}?${params.toString()}`, 12000); // Increased timeout for shared hosting
    const results = Array.isArray(data.results) ? data.results : [];

    const images = [];
    const coords = [];

    for (const r of results) {
      if (r.decimalLatitude && r.decimalLongitude) {
        coords.push({ lat: Number(r.decimalLatitude), lng: Number(r.decimalLongitude), label: r.locality || r.country || undefined });
      }

      if (Array.isArray(r.media)) {
        for (const m of r.media) {
          if (m.type === 'StillImage' && m.identifier) {
            images.push({
              url: m.identifier,
              source: m.source || 'GBIF',
              license: m.license || null,
              creator: m.creator || null,
              rightsHolder: m.rightsHolder || null,
            });
          }
        }
      }
    }

    return { images: images.slice(0, limit), coords };
  } catch (err) {
    console.error(`[Enrichment] GBIF lookup failed for "${scientificName}": ${err.message}`);
    return { images: [], coords: [] };
  }
}

/**
 * Main enrichment function: attempts Wikipedia first, then GBIF fallback.
 * Returns an object { description, images: [], coords: [], sources: [] }
 */
async function enrichByScientificName(scientificName) {
  const result = { description: null, habitat: null, taxonomy: null, images: [], coords: [], sources: [] };

  if (!scientificName) {
    console.warn(`[Enrichment] Empty scientific name provided`);
    return result;
  }

  console.log(`[Enrichment] Starting enrichment for: ${scientificName}`);

  // 1) Wikipedia summary
  try {
    const wiki = await fetchFromWikipedia(scientificName);
    if (wiki) {
      if (wiki.description) {
        result.description = wiki.description;
        if (wiki.source) result.sources.push({ type: 'wikipedia', url: wiki.source });
        console.log(`[Enrichment] Wikipedia: got description (${wiki.description.length} chars)`);
      }
      if (wiki.habitat) {
        result.habitat = wiki.habitat;
        console.log(`[Enrichment] Wikipedia: inferred habitat`);
      }
      if (wiki.thumbnail) {
        result.images.push({
          url: wiki.thumbnail,
          source: 'Wikipedia',
          license: 'CC-BY-SA 3.0 (Wikipedia)',
          creator: 'Wikipedia Community',
          rightsHolder: 'Wikimedia Foundation',
          image_credit: buildImageCredit({
            creator: 'Wikipedia Community',
            rightsHolder: 'Wikimedia Foundation',
            license: 'CC-BY-SA 3.0',
            source: 'Wikipedia'
          })
        });
        console.log(`[Enrichment] Wikipedia: got thumbnail`);
      }
    }
  } catch (err) {
    console.error(`[Enrichment] Wikipedia fetch failed:`, err.message);
    // Continue to GBIF
  }

  try {
    const gbifSpecies = await fetchFromGBIFSpecies(scientificName);
    if (gbifSpecies) {
      if (!result.taxonomy) result.taxonomy = gbifSpecies.taxonomy;
      if (!result.habitat && gbifSpecies.habitat) {
        result.habitat = gbifSpecies.habitat;
      }
      if (gbifSpecies.source) {
        result.sources.push({ type: 'gbif_species', url: gbifSpecies.source });
      }
      console.log(`[Enrichment] GBIF species: got taxonomy${result.habitat ? ' and habitat' : ''}`);
    }
  } catch (err) {
    console.error(`[Enrichment] GBIF species metadata fetch failed:`, err.message);
  }

  // 2) GBIF fallback for images & coords (only if we lack them)
  const needImages = result.images.length === 0;
  const needCoords = result.coords.length === 0;

  if (needImages || needCoords) {
    try {
      console.log(`[Enrichment] Fetching from GBIF (needImages: ${needImages}, needCoords: ${needCoords})`);
      const gbif = await fetchFromGBIF(scientificName);
      if (gbif.images && gbif.images.length > 0 && needImages) {
        result.images.push(...gbif.images.map((i) => ({
          url: i.url || i.identifier || i.image || null,
          source: i.source || 'GBIF',
          license: i.license || null,
          creator: i.creator || null,
          rightsHolder: i.rightsHolder || null,
          image_credit: buildImageCredit(i),
        })).filter((img) => Boolean(img.url)));
        if (gbif.images.length > 0) {
          result.sources.push({ type: 'gbif_occurrence', url: 'https://www.gbif.org' });
          console.log(`[Enrichment] GBIF: got ${gbif.images.length} images`);
        }
      }
      if (gbif.coords && gbif.coords.length > 0 && needCoords) {
        result.coords.push(...gbif.coords);
        console.log(`[Enrichment] GBIF: got ${gbif.coords.length} coordinates`);
      }
    } catch (err) {
      console.error(`[Enrichment] GBIF fetch failed:`, err.message);
      // Return partial results (images from Wikipedia if any)
    }
  }

  if (result.images.length > 0) {
    result.images = result.images.map((image) => ({
      ...image,
      image_credit: image.image_credit || buildImageCredit(image) || image.source || null,
    }));
  }

  console.log(`[Enrichment] Finished: description=${!!result.description}, habitat=${!!result.habitat}, taxonomy=${!!result.taxonomy}, images=${result.images.length}, coords=${result.coords.length}`);
  return result;
}

module.exports = { enrichByScientificName };
