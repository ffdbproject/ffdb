import { Helmet } from 'react-helmet-async';

const endpointGroups = [
  {
    title: 'Public data',
    items: [
      { method: 'GET', path: '/api/health', summary: 'Health check' },
      { method: 'GET', path: '/api/species', summary: 'List published species with pagination and filters' },
      { method: 'GET', path: '/api/species/:id', summary: 'Fetch a single species with taxonomy and images' },
      { method: 'POST', path: '/api/species/contribute', summary: 'Public contribution endpoint (always stored as draft)' },
      { method: 'GET', path: '/api/search?q=term', summary: 'Search by scientific, English, or Bengali name' },
      { method: 'GET', path: '/api/search/suggest?q=term', summary: 'Autocomplete suggestions for the header search' },
      { method: 'GET', path: '/api/team', summary: 'List public team members' },
      { method: 'GET', path: '/sitemap.xml', summary: 'XML sitemap for published species and key pages' },
      { method: 'GET', path: '/robots.txt', summary: 'Crawler policy and sitemap location' },
    ],
  },
  {
    title: 'Admin endpoints (Requires Auth)',
    items: [
      { method: 'POST', path: '/api/admin/login', summary: 'Create an HttpOnly admin session cookie' },
      { method: 'POST', path: '/api/admin/logout', summary: 'Clear the admin session' },
      { method: 'GET', path: '/api/admin/me', summary: 'Check current authentication status' },
      { method: 'POST', path: '/api/species', summary: 'Create a species record' },
      { method: 'PUT', path: '/api/species/:id', summary: 'Update a species record' },
      { method: 'POST', path: '/api/species/:id/delete', summary: 'Delete a species record' },
      { method: 'POST', path: '/api/species/:id/upload', summary: 'Upload a species image file' },
      { method: 'GET', path: '/api/species/stats/overview', summary: 'Get dashboard statistics' },
      { method: 'POST', path: '/api/admin/enrich/:id', summary: 'Trigger backend enrichment for a species' },
      { method: 'GET', path: '/api/admin/gbif/search?q=term', summary: 'Search GBIF from the admin panel' },
      { method: 'GET', path: '/api/admin/gbif/species/:gbifKey', summary: 'Fetch detailed GBIF species data' },
      { method: 'GET', path: '/api/admin/team', summary: 'Get team members (admin view)' },
      { method: 'POST', path: '/api/admin/team', summary: 'Create a team member' },
      { method: 'PUT', path: '/api/admin/team/:id', summary: 'Update a team member' },
      { method: 'POST', path: '/api/admin/team/:id/delete', summary: 'Delete a team member' },
    ],
  },
];

export default function ApiDocsPage() {
  const siteOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const canonicalUrl = `${siteOrigin}/api-docs`;
  const openApiUrl = `${siteOrigin}/api/openapi.json`;
  const pageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'API Docs - FFDB',
    url: canonicalUrl,
    description: 'Public API documentation for the Flora and Fauna Database of Bangladesh.',
  };

  return (
    <div className="page-enter container docs-page" style={{ paddingTop: '40px', paddingBottom: '80px' }}>
      <Helmet>
        <title>API Docs - FFDB</title>
        <meta name="description" content="Public API documentation for the Flora and Fauna Database of Bangladesh." />
        <meta name="robots" content="index, follow" />
        <meta property="og:title" content="API Docs - FFDB" />
        <meta property="og:description" content="Public API documentation for the Flora and Fauna Database of Bangladesh." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:site_name" content="FFDB" />
        <meta property="og:image" content={`${siteOrigin}/og-fallback.png`} />
        <meta property="og:image:alt" content="Flora and Fauna Database of Bangladesh" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="API Docs - FFDB" />
        <meta name="twitter:description" content="Public API documentation for the Flora and Fauna Database of Bangladesh." />
        <link rel="canonical" href={canonicalUrl} />
        <script type="application/ld+json">{JSON.stringify(pageJsonLd)}</script>
      </Helmet>

      <div className="docs-hero">
        <div>
          <h1>FFDB API Documentation</h1>
          <p>
            Use the public endpoints to browse published species, search names,
            and integrate the database into research tools or companion apps.
          </p>
        </div>

        <div className="docs-meta-card">
          <div>
            <span>Base URL</span>
            <strong>{siteOrigin || 'Same origin as the site'}</strong>
          </div>
          <div>
            <span>OpenAPI JSON</span>
            <a href={openApiUrl} target="_blank" rel="noreferrer">/api/openapi.json</a>
          </div>
          <div>
            <span>Auth</span>
            <strong>Admin-only routes use HttpOnly cookies</strong>
          </div>
        </div>
      </div>

      <div className="docs-grid">
        <section className="docs-card">
          <h2>Quick start</h2>
          <pre className="docs-code-block"><code>{`# List species (paginated)
curl ${siteOrigin || 'https://your-domain.com'}/api/species?limit=5

# Fetch a single species by ID
curl ${siteOrigin || 'https://your-domain.com'}/api/species/3

# Search by name
curl ${siteOrigin || 'https://your-domain.com'}/api/search?q=tiger

# Filter by category and conservation status
curl "${siteOrigin || 'https://your-domain.com'}/api/species?category=fauna&conservation_status=EN"

# Autocomplete suggestions
curl ${siteOrigin || 'https://your-domain.com'}/api/search/suggest?q=pan`}</code></pre>
        </section>

        <section className="docs-card">
          <h2>List response shape</h2>
          <pre className="docs-code-block"><code>{`// GET /api/species?limit=2
{
  "success": true,
  "data": [
    {
      "id": "SP-0003",
      "scientific_name": "Panthera tigris",
      "english_name": "Bengal Tiger",
      "bengali_name": "বাঘ",
      "category": "fauna",
      "origin": "native",
      "conservation_status": "EN",
      "status": "published",
      "created_at": "2025-12-01T10:30:00.000Z",
      "updated_at": "2025-12-15T08:45:00.000Z",
      "family": "Felidae",
      "genus": "Panthera",
      "primary_image": "https://upload.wikimedia.org/..."
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 2,
    "totalRecords": 42,
    "totalPages": 21,
    "hasNextPage": true,
    "hasPreviousPage": false,
    "nextCursor": "eyJkIjoiMjAyNS0xMi..."
  }
}`}</code></pre>
        </section>

        <section className="docs-card">
          <h2>Detail response shape</h2>
          <pre className="docs-code-block"><code>{`// GET /api/species/SP-0003
{
  "success": true,
  "data": {
    "id": "SP-0003",
    "public_id": "SP-0003",
    "scientific_name": "Panthera tigris",
    "english_name": "Bengal Tiger",
    "bengali_name": "বাঘ",
    "category": "fauna",
    "origin": "native",
    "description": "<p>A large cat species...</p>",
    "habitat": "Sundarbans mangrove forests",
    "conservation_status": "EN",
    "residency_status": "Resident",
    "references": [{"type": "wikipedia", "url": "..."}],
    "external_links": {
      "wikipedia": "https://en.wikipedia.org/wiki/Tiger",
      "iucn": "https://apiv3.iucnredlist.org/api/v3/taxonredirect/15955"
    },
    "status": "published",
    "created_at": "2025-12-01T10:30:00.000Z",
    "updated_at": "2025-12-15T08:45:00.000Z",
    "taxonomy": {
      "kingdom": "Animalia",
      "phylum": "Chordata",
      "class": "Mammalia",
      "order": "Carnivora",
      "family": "Felidae",
      "genus": "Panthera"
    },
    "location_coordinates": [],
    "images": [{
      "id": 12,
      "image_url": "https://upload.wikimedia.org/...",
      "image_credit": "Wikimedia Commons",
      "is_primary": true,
      "thumbnail_url": null
    }],
    "related_species": [],
    "previous_species": null,
    "next_species": null
  }
}`}</code></pre>
        </section>

        <section className="docs-card">
          <h2>Search response shape</h2>
          <pre className="docs-code-block"><code>{`// GET /api/search?q=tiger
{
  "success": true,
  "query": "tiger",
  "data": [
    {
      "id": "SP-0003",
      "scientific_name": "Panthera tigris",
      "english_name": "Bengal Tiger",
      "bengali_name": "বাঘ",
      "category": "fauna",
      "conservation_status": "EN",
      "habitat": "Sundarbans mangrove forests",
      "status": "published",
      "created_at": "2025-12-01T10:30:00.000Z",
      "family": "Felidae",
      "genus": "Panthera",
      "primary_image": "https://upload.wikimedia.org/..."
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalRecords": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}`}</code></pre>
        </section>

        <section className="docs-card">
          <h2>Error handling</h2>
          <ul className="docs-list">
            <li><strong>400</strong> invalid input, missing query parameters, or bad payload shape</li>
            <li><strong>401</strong> missing admin session cookie</li>
            <li><strong>403</strong> expired or invalid admin session</li>
            <li><strong>404</strong> species or route not found</li>
            <li><strong>429</strong> too many requests</li>
          </ul>
        </section>
      </div>

      {endpointGroups.map((group) => (
        <section className="docs-card" key={group.title}>
          <h2>{group.title}</h2>
          <div className="docs-endpoint-list">
            {group.items.map((item) => (
              <article className="docs-endpoint" key={item.path + item.method}>
                <span className={`docs-method method-${item.method.toLowerCase()}`}>{item.method}</span>
                <div>
                  <h3>{item.path}</h3>
                  <p>{item.summary}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      <section className="docs-card">
        <h2>Useful filters</h2>
        <div className="docs-pill-row">
          <span className="docs-pill">category=flora|fauna</span>
          <span className="docs-pill">origin=native|exotic</span>
          <span className="docs-pill">status=draft|pending_review|published</span>
          <span className="docs-pill">conservation_status=LC|NT|VU|EN|CR|EW|EX</span>
          <span className="docs-pill">page=1&amp;limit=20</span>
          <span className="docs-pill">cursor=&lt;nextCursor&gt;</span>
        </div>
      </section>
    </div>
  );
}