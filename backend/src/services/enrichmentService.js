// ============================================================
// Enrichment Service — Fetch description, images and coordinates
// Priority: Wikipedia (page summary) → GBIF species/occurrences (taxonomy, habitat, images + coords)
// ============================================================

const cheerio = require('cheerio');

const WIKIPEDIA_SUMMARY = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
const WIKIPEDIA_HTML = 'https://en.wikipedia.org/api/rest_v1/page/html/';
const WIKIMEDIA_COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const GBIF_SPECIES_SEARCH = 'https://api.gbif.org/v1/species/search';
const GBIF_SPECIES_BASE = 'https://api.gbif.org/v1/species';
const GBIF_OCCURRENCE_SEARCH = 'https://api.gbif.org/v1/occurrence/search';
const INATURALIST_TAXA = 'https://api.inaturalist.org/v1/taxa';

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

function stripHtml(value) {
  return normalizeText(String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#160;/gi, ' '));
}

function normalizeLicenseLabel(value) {
  const label = stripHtml(value);
  if (!label) return '';

  const compact = label
    .replace(/Creative Commons Attribution-ShareAlike/ig, 'CC BY-SA')
    .replace(/Creative Commons Attribution/ig, 'CC BY')
    .replace(/Creative Commons Zero/ig, 'CC0')
    .replace(/International/ig, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (/^CC\s*BY-SA\b/i.test(compact)) return compact.replace(/^CC\s*BY-SA\s*/i, 'CC BY-SA ');
  if (/^CC\s*BY\b/i.test(compact)) return compact.replace(/^CC\s*BY\s*/i, 'CC BY ');
  if (/^CC0\b/i.test(compact)) return 'CC0';

  return compact.slice(0, 120);
}

function extractWikimediaFileName(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') return '';

  try {
    const parsed = new URL(imageUrl);
    const segments = (parsed.pathname || '').split('/').filter(Boolean);
    const commonsIdx = segments.findIndex((seg) => seg.toLowerCase() === 'commons');
    if (commonsIdx === -1) return '';

    let fileSegment = '';
    const isThumb = segments[commonsIdx + 1]?.toLowerCase() === 'thumb';

    if (isThumb) {
      // /wikipedia/commons/thumb/<hash1>/<hash2>/<filename>/<size-prefix-filename>
      fileSegment = segments[commonsIdx + 4] || '';
    } else {
      // /wikipedia/commons/<hash1>/<hash2>/<filename>
      fileSegment = segments[segments.length - 1] || '';
    }

    let fileName = decodeURIComponent(fileSegment || '').trim();
    if (/^\d+px-/i.test(fileName)) {
      fileName = fileName.replace(/^\d+px-/i, '');
    }

    return fileName ? fileName.replace(/_/g, ' ') : '';
  } catch {
    return '';
  }
}

async function fetchWikimediaCommonsMetadata(imageUrl) {
  const fileName = extractWikimediaFileName(imageUrl);
  if (!fileName) return null;

  try {
    const params = new URLSearchParams({
      action: 'query',
      titles: `File:${fileName}`,
      prop: 'imageinfo',
      iiprop: 'extmetadata',
      format: 'json',
      origin: '*',
    });

    const data = await fetchJSON(`${WIKIMEDIA_COMMONS_API}?${params.toString()}`, 15000);
    const pages = data?.query?.pages || {};
    const page = Object.values(pages)[0];
    const ext = page?.imageinfo?.[0]?.extmetadata;
    if (!ext) return null;

    const author = stripHtml(ext.Artist?.value || ext.Credit?.value || ext.Creator?.value || '');
    const license = stripHtml(ext.LicenseShortName?.value || ext.UsageTerms?.value || ext.License?.value || '');
    const rightsHolder = stripHtml(ext.Copyrighted?.value || ext.ImageDescription?.value || ext.AttributionRequired?.value || '');

    return {
      creator: author || null,
      rightsHolder: rightsHolder || 'Wikimedia Commons',
      license: license || 'Unknown license',
      source: 'Wikimedia Commons',
    };
  } catch (err) {
    console.error(`[Enrichment] Wikimedia Commons metadata lookup failed for "${imageUrl}": ${err.message}`);
    return null;
  }
}

function buildImageCredit(image) {
  if (!image || typeof image !== 'object') return null;

  const creator = normalizeText(image.creator || image.author || image.photographer);
  const rightsHolder = normalizeText(image.rightsHolder || image.rights_holder);
  const license = normalizeLicenseLabel(image.license);
  const source = normalizeText(image.source);

  const isWikimedia = /wikimedia|wikipedia/i.test([creator, rightsHolder, license, source].join(' '));
  if (isWikimedia) {
    const wikimediaAuthor = creator || normalizeText(image.author) || 'Unknown author';
    const wikimediaLicense = license || 'Unknown license';
    return `${wikimediaAuthor}/Wikimedia Commons (${wikimediaLicense})`.slice(0, 500);
  }

  const parts = [creator, rightsHolder, license, source]
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
    const [summaryRes, extLinksRes, htmlRes] = await Promise.allSettled([
      fetchJSON(`${WIKIPEDIA_SUMMARY}${title}`, 15000),
      fetchJSON(`https://en.wikipedia.org/w/api.php?action=query&prop=extlinks&titles=${title}&redirects=1&format=json&ellimit=500`, 15000),
      fetch(`${WIKIPEDIA_HTML}${title}`).then(r => r.ok ? r.text() : null).catch(() => null)
    ]);

    let description = null;
    let thumbnail = null;
    let source = null;
    let iucnLink = null;
    let references = '';

    if (summaryRes.status === 'fulfilled' && summaryRes.value) {
      const data = summaryRes.value;
      description = data.extract || null;
      thumbnail = data.thumbnail?.source || null;
      source = data.content_urls?.desktop?.page || null;
    }

    if (extLinksRes.status === 'fulfilled' && extLinksRes.value) {
      const pages = extLinksRes.value.query?.pages || {};
      const pageId = Object.keys(pages)[0];
      const links = pages[pageId]?.extlinks || [];
      const found = links.find(l => typeof l['*'] === 'string' && l['*'].includes('iucnredlist.org/species/'));
      if (found) {
        iucnLink = found['*'];
      }
    }

    if (htmlRes.status === 'fulfilled' && htmlRes.value) {
      try {
        const $ = cheerio.load(htmlRes.value);
        const refs = [];
        $('ol.references cite').each((i, el) => {
          const $el = $(el);

          // Clean up Wikipedia's native styling and extraneous text
          $el.find('.reference-accessdate').remove();
          $el.find('.mw-cite-backlink').remove();

          // Unwrap all internal Wikipedia links (removes hyperlinks from authors, journals, etc.)
          $el.find('a[rel="mw:WikiLink"]').each((_, a) => {
            $(a).replaceWith($(a).html());
          });

          // Fix relative wiki links just in case any were missed
          $el.find('a').each((_, a) => {
            const href = $(a).attr('href');
            if (href) {
              if (href.startsWith('./')) {
                $(a).attr('href', 'https://en.wikipedia.org/wiki/' + href.substring(2));
              } else if (href.startsWith('/wiki/')) {
                $(a).attr('href', 'https://en.wikipedia.org' + href);
              } else if (href.startsWith('//')) {
                $(a).attr('href', 'https:' + href);
              }
              // Add standard target for new tab
              $(a).attr('target', '_blank').attr('rel', 'noopener noreferrer');
            }
          });

          // Extract the beautifully formatted native HTML
          let html = $el.html() || '';
          html = html.trim();
          
          if (html.length > 10) refs.push(html);
        });

        if (refs.length > 0) {
          // Format as HTML ordered list with proper spacing between items
          const listItems = refs.map((ref) => `<li style="margin-bottom: 12px; line-height: 1.6;">${ref}</li>`).join('');
          references = `<ol style="padding-left: 20px; margin: 0;">${listItems}</ol>`;
        }
      } catch (err) {
        console.error('[Enrich] Cheerio parse error:', err.message);
      }
    }

    return {
      description,
      habitat: deriveHabitatFromText(description),
      thumbnail,
      source,
      iucnLink,
      references
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
  const params = new URLSearchParams({ scientificName: scientificName, mediaType: 'StillImage', limit: String(limit), country: 'BD' });
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
 * Query Wikidata for exact IDs (IUCN, EOL, iNaturalist, GBIF, Wikipedia)
 */
async function fetchFromWikidata(scientificName) {
  if (!scientificName) return null;
  try {
    const searchParams = new URLSearchParams({
      action: 'wbsearchentities',
      search: scientificName,
      language: 'en',
      format: 'json'
    });
    const searchData = await fetchJSON(`https://www.wikidata.org/w/api.php?${searchParams.toString()}`, 12000);
    const match = searchData.search && searchData.search[0];
    if (!match) return null;

    const qId = match.id;
    const entityData = await fetchJSON(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qId}&format=json&props=claims|sitelinks/urls`, 12000);
    const entity = entityData.entities && entityData.entities[qId];
    if (!entity) return null;

    const claims = entity.claims || {};
    const iucn = claims['P627'] ? claims['P627'][0].mainsnak?.datavalue?.value : null;
    const eol = claims['P830'] ? claims['P830'][0].mainsnak?.datavalue?.value : null;
    const inat = claims['P3151'] ? claims['P3151'][0].mainsnak?.datavalue?.value : null;
    const gbif = claims['P846'] ? claims['P846'][0].mainsnak?.datavalue?.value : null;
    const powo = claims['P5037'] ? claims['P5037'][0].mainsnak?.datavalue?.value : null;
    const wfo = claims['P7715'] ? claims['P7715'][0].mainsnak?.datavalue?.value : null;
    const bold = claims['P3606'] ? claims['P3606'][0].mainsnak?.datavalue?.value : null;

    const links = {};
    if (iucn) links.iucn = `https://www.iucnredlist.org/species/${iucn}/0`;
    if (eol) links.eol = `https://eol.org/pages/${eol}`;
    if (inat) links.inaturalist = `https://www.inaturalist.org/taxa/${inat}`;
    if (gbif) links.gbif = `https://www.gbif.org/species/${gbif}`;
    if (powo) links.powo = `https://powo.science.kew.org/taxon/${powo}`;
    if (wfo) links.wfo = `https://www.worldfloraonline.org/taxon/${wfo}`;
    if (bold) links.bold = `https://boldsystems.org/index.php/TaxBrowser_TaxonPage?taxid=${bold}`;
    
    if (entity.sitelinks && entity.sitelinks.enwiki) {
      links.wikipedia = entity.sitelinks.enwiki.url;
    }

    return links;
  } catch (err) {
    console.error(`[Enrichment] Wikidata lookup failed for "${scientificName}": ${err.message}`);
    return null;
  }
}

/**
 * Query EOL search API for the page ID (Fallback when Wikidata has no P830)
 */
async function fetchFromEOL(scientificName) {
  if (!scientificName) return null;
  try {
    const params = new URLSearchParams({ q: scientificName, page: '1', key: '' });
    const data = await fetchJSON(`https://eol.org/api/search/1.0.json?${params.toString()}`, 10000);
    const results = Array.isArray(data.results) ? data.results : [];
    // Find exact match by comparing title to scientific name
    const match = results.find(r => r.title && r.title.toLowerCase() === scientificName.toLowerCase());
    if (match && match.id) {
      return `https://eol.org/pages/${match.id}`;
    }
    // If no exact match, use the first result if available
    if (results.length > 0 && results[0].id) {
      return `https://eol.org/pages/${results[0].id}`;
    }
    return null;
  } catch (err) {
    console.error(`[Enrichment] EOL search failed for "${scientificName}": ${err.message}`);
    return null;
  }
}

/**
 * Query iNaturalist for the exact taxon link (Fallback)
 */
async function fetchFromiNaturalist(scientificName) {
  if (!scientificName) return null;
  const params = new URLSearchParams({ q: scientificName, is_active: 'true', rank: 'species,subspecies' });
  try {
    const data = await fetchJSON(`${INATURALIST_TAXA}?${params.toString()}`, 10000);
    const results = Array.isArray(data.results) ? data.results : [];
    // Find exact match
    const match = results.find(r => r.name.toLowerCase() === scientificName.toLowerCase());
    if (match) {
      return `https://www.inaturalist.org/taxa/${match.id}`;
    }
    return null;
  } catch (err) {
    console.error(`[Enrichment] iNaturalist lookup failed for "${scientificName}": ${err.message}`);
    return null;
  }
}

/**
 * Main enrichment function: attempts Wikipedia first, then GBIF fallback.
 * Returns an object { description, images: [], coords: [], sources: [] }
 */
async function enrichByScientificName(scientificName) {
  const result = { description: null, habitat: null, taxonomy: null, images: [], coords: [], sources: [], external_links: {}, references: null };

  if (!scientificName) {
    console.warn(`[Enrichment] Empty scientific name provided`);
    return result;
  }

  console.log(`[Enrichment] Starting enrichment for: ${scientificName}`);

  // 1) Fetch Wikipedia, GBIF species data, Wikidata, and iNaturalist in parallel for performance
  const [wikiResult, gbifSpeciesResult, inatResult, wikidataResult] = await Promise.allSettled([
    fetchFromWikipedia(scientificName),
    fetchFromGBIFSpecies(scientificName),
    fetchFromiNaturalist(scientificName),
    fetchFromWikidata(scientificName),
  ]);

  // Process Wikidata links first
  if (wikidataResult.status === 'fulfilled' && wikidataResult.value) {
    result.external_links = { ...result.external_links, ...wikidataResult.value };
  }

  // Fallback to iNaturalist
  if (!result.external_links.inaturalist && inatResult.status === 'fulfilled' && inatResult.value) {
    result.external_links.inaturalist = inatResult.value;
  }

  // Fallback: if Wikidata did not provide an EOL link, try the EOL search API
  if (!result.external_links.eol) {
    try {
      const eolUrl = await fetchFromEOL(scientificName);
      if (eolUrl) {
        result.external_links.eol = eolUrl;
        console.log(`[Enrichment] EOL fallback: got link via search API`);
      }
    } catch (err) {
      console.error(`[Enrichment] EOL fallback failed:`, err.message);
    }
  }

  // Process Wikipedia results
  try {
    const wiki = wikiResult.status === 'fulfilled' ? wikiResult.value : null;
    if (wiki) {
      if (wiki.description) {
        result.description = wiki.description;
        if (wiki.source && !result.external_links.wikipedia) {
          result.sources.push({ type: 'wikipedia', url: wiki.source });
          result.external_links.wikipedia = wiki.source;
        }
      }
      if (wiki.habitat) {
        result.habitat = wiki.habitat;
      }
      if (wiki.iucnLink) {
        result.external_links.iucn = wiki.iucnLink;
      }
      if (wiki.references) {
        result.references = wiki.references;
        console.log(`[Enrichment] Wikipedia: got references (${wiki.references.length} chars)`);
      }
      if (wiki.thumbnail) {
        const commonsMeta = await fetchWikimediaCommonsMetadata(wiki.thumbnail);
        const wikimediaCredit = commonsMeta
          ? buildImageCredit(commonsMeta)
          : null;
        result.images.push({
          url: wiki.thumbnail,
          source: commonsMeta?.source || 'Wikipedia',
          license: commonsMeta?.license || 'CC-BY-SA 3.0',
          creator: commonsMeta?.creator || null,
          rightsHolder: commonsMeta?.rightsHolder || null,
          image_credit: wikimediaCredit || null,
        });
        console.log(`[Enrichment] Wikipedia: got thumbnail`);
      }
    } else if (wikiResult.status === 'rejected') {
      console.error(`[Enrichment] Wikipedia fetch failed:`, wikiResult.reason?.message);
    }
  } catch (err) {
    console.error(`[Enrichment] Wikipedia processing failed:`, err.message);
  }

  // Process GBIF species results
  try {
    const gbifSpecies = gbifSpeciesResult.status === 'fulfilled' ? gbifSpeciesResult.value : null;
    if (gbifSpecies) {
      if (!result.taxonomy) result.taxonomy = gbifSpecies.taxonomy;
      if (!result.habitat && gbifSpecies.habitat) {
        result.habitat = gbifSpecies.habitat;
      }
      if (gbifSpecies.source && !result.external_links.gbif) {
        result.sources.push({ type: 'gbif', url: gbifSpecies.source });
        result.external_links.gbif = gbifSpecies.source;
      }
      console.log(`[Enrichment] GBIF species: got taxonomy${result.habitat ? ' and habitat' : ''}`);
    } else if (gbifSpeciesResult.status === 'rejected') {
      console.error(`[Enrichment] GBIF species metadata fetch failed:`, gbifSpeciesResult.reason?.message);
    }
  } catch (err) {
    console.error(`[Enrichment] GBIF species processing failed:`, err.message);
  }

  // 2) GBIF fallback for images & coords (only if we lack them)
  const needImages = result.images.length === 0;
  const needCoords = result.coords.length === 0;

  if (needImages || needCoords) {
    try {
      console.log(`[Enrichment] Fetching from GBIF (needImages: ${needImages}, needCoords: ${needCoords})`);
      const gbif = await fetchFromGBIF(scientificName);
      if (gbif.images && gbif.images.length > 0 && needImages) {
        const mappedImages = [];
        for (const i of gbif.images) {
          const url = i.url || i.identifier || i.image || null;
          if (!url) continue;

          const isWikimedia = /wikimedia|wikipedia/i.test(String(url)) || /wikimedia|wikipedia/i.test([i.source, i.creator, i.rightsHolder, i.license].join(' '));
          const commonsMeta = isWikimedia ? await fetchWikimediaCommonsMetadata(url) : null;

          mappedImages.push({
            url,
            source: commonsMeta?.source || i.source || 'GBIF',
            license: commonsMeta?.license || i.license || null,
            creator: commonsMeta?.creator || i.creator || null,
            rightsHolder: commonsMeta?.rightsHolder || i.rightsHolder || null,
            image_credit: commonsMeta
              ? buildImageCredit(commonsMeta)
              : buildImageCredit({
              creator: commonsMeta?.creator || i.creator || null,
              author: commonsMeta?.creator || i.creator || null,
              rightsHolder: commonsMeta?.rightsHolder || i.rightsHolder || null,
              license: commonsMeta?.license || i.license || null,
              source: commonsMeta?.source || i.source || 'GBIF',
            }),
          });
        }

        result.images.push(...mappedImages);
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
