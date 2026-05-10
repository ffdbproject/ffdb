import { Helmet } from 'react-helmet-async';

const endpointGroups = [
  {
    title: 'Public data',
    items: [
      { method: 'GET', path: '/api/health', summary: 'Health check' },
      { method: 'GET', path: '/api/species', summary: 'List published species with pagination and filters' },
      { method: 'GET', path: '/api/species/:id', summary: 'Fetch a single species with taxonomy and images' },
      { method: 'GET', path: '/api/search?q=term', summary: 'Search by scientific, English, or Bengali name' },
      { method: 'GET', path: '/api/search/suggest?q=term', summary: 'Autocomplete suggestions for the header search' },
      { method: 'GET', path: '/sitemap.xml', summary: 'XML sitemap for published species and key pages' },
      { method: 'GET', path: '/robots.txt', summary: 'Crawler policy and sitemap location' },
    ],
  },
  {
    title: 'Admin data entry',
    items: [
      { method: 'POST', path: '/api/admin/login', summary: 'Create an HttpOnly admin session cookie' },
      { method: 'POST', path: '/api/species', summary: 'Create a species record' },
      { method: 'PUT', path: '/api/species/:id', summary: 'Update a species record' },
      { method: 'DELETE', path: '/api/species/:id', summary: 'Delete a species record' },
      { method: 'POST', path: '/api/species/:id/upload', summary: 'Upload a species image file' },
      { method: 'GET', path: '/api/admin/gbif/search?q=term', summary: 'Search GBIF from the admin panel' },
      { method: 'GET', path: '/api/admin/gbif/species/:gbifKey', summary: 'Fetch detailed GBIF species data' },
    ],
  },
];

export default function ApiDocsPage() {
  const siteOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const canonicalUrl = `${siteOrigin}/api-docs`;
  const openApiUrl = `${siteOrigin}/api/openapi.json`;

  return (
    <div className="page-enter container docs-page" style={{ paddingTop: '40px', paddingBottom: '80px' }}>
      <Helmet>
        <title>API Docs | FFDB</title>
        <meta name="description" content="Public API documentation for the Flora and Fauna Database of Bangladesh." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>

      <div className="docs-hero">
        <div>
          <span className="docs-kicker">Developer Access</span>
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
          <pre className="docs-code-block"><code>{`curl ${siteOrigin || 'https://your-domain.com'}/api/species?limit=5

curl ${siteOrigin || 'https://your-domain.com'}/api/search?q=tiger`}</code></pre>
        </section>

        <section className="docs-card">
          <h2>Response shape</h2>
          <pre className="docs-code-block"><code>{`{
  "success": true,
  "data": [
    {
      "id": 1,
      "scientific_name": "Panthera tigris",
      "english_name": "Bengal Tiger",
      "category": "fauna",
      "conservation_status": "EN"
    }
  ],
  "pagination": { "page": 1, "limit": 20 }
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
          <span className="docs-pill">status=draft|pending_review|published</span>
          <span className="docs-pill">conservation_status=LC|NT|VU|EN|CR|EW|EX</span>
        </div>
      </section>
    </div>
  );
}