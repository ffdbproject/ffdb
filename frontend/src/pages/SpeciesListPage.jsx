import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { speciesAPI } from '../services/api';
import SpeciesCard from '../components/SpeciesCard';

function getFiltersFromSearch(search) {
  const params = new URLSearchParams(search);
  return {
    page: Math.max(1, parseInt(params.get('page'), 10) || 1),
    limit: 12,
    cursor: params.get('cursor') || '',
    category: params.get('category') || '',
    origin: params.get('origin') || '',
    conservation_status: params.get('conservation_status') || '',
    kingdom: params.get('kingdom') || '',
    phylum: params.get('phylum') || '',
    class: params.get('class') || '',
    order: params.get('order') || '',
    family: params.get('family') || '',
    genus: params.get('genus') || '',
  };
}

function buildSearchFromFilters(filters) {
  const params = new URLSearchParams();
  if (filters.page && filters.page !== 1) params.set('page', String(filters.page));
  if (filters.cursor) params.set('cursor', filters.cursor);
  if (filters.category) params.set('category', filters.category);
  if (filters.origin) params.set('origin', filters.origin);
  if (filters.conservation_status) params.set('conservation_status', filters.conservation_status);
  if (filters.kingdom) params.set('kingdom', filters.kingdom);
  if (filters.phylum) params.set('phylum', filters.phylum);
  if (filters.class) params.set('class', filters.class);
  if (filters.order) params.set('order', filters.order);
  if (filters.family) params.set('family', filters.family);
  if (filters.genus) params.set('genus', filters.genus);
  return params.toString();
}

export default function SpeciesListPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [species, setSpecies] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const pageRef = useRef(null);
  const filters = getFiltersFromSearch(location.search);
  const siteOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  // Canonical should be the base page URL without pagination/filter params
  const canonicalUrl = `${siteOrigin}/species`;
  const shouldRestoreScroll = typeof window !== 'undefined'
    && sessionStorage.getItem('ffdb_return_path') === `${location.pathname}${location.search}${location.hash}`;

  const taxonomyFilterLabels = {
    kingdom: 'Kingdom',
    phylum: 'Phylum',
    class: 'Class',
    order: 'Order',
    family: 'Family',
    genus: 'Genus',
  };

  const activeTaxonomyFilters = Object.entries(taxonomyFilterLabels)
    .map(([key, label]) => ({ key, label, value: filters[key] }))
    .filter((item) => item.value);

  const listJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Browse Species - FFDB',
    url: canonicalUrl,
    description: 'Browse the complete catalog of flora and fauna species in Bangladesh.',
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: pagination.totalRecords || species.length,
      itemListElement: species.slice(0, 12).map((sp, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: `${siteOrigin}/species/${sp.public_id || sp.id}`,
        name: sp.english_name || sp.bengali_name || sp.scientific_name,
      })),
    },
  };

  useEffect(() => {
    async function fetchSpecies() {
      const cacheKey = `ffdb_browse_cache_${location.search}`;

      // On back-navigation, instantly restore cached data while
      // re-fetching in the background for freshness.
      if (shouldRestoreScroll) {
        try {
          const cached = sessionStorage.getItem(cacheKey);
          if (cached) {
            const { data, pagination: pag } = JSON.parse(cached);
            setSpecies(data);
            setPagination(pag);
            setLoading(false);
            // Still re-fetch silently in background
            try {
              const params = { page: filters.page, limit: filters.limit };
              if (filters.category) params.category = filters.category;
              if (filters.origin) params.origin = filters.origin;
              if (filters.conservation_status) params.conservation_status = filters.conservation_status;
              if (filters.kingdom) params.kingdom = filters.kingdom;
              if (filters.phylum) params.phylum = filters.phylum;
              if (filters.class) params.class = filters.class;
              if (filters.order) params.order = filters.order;
              if (filters.family) params.family = filters.family;
              if (filters.genus) params.genus = filters.genus;
              const res = await speciesAPI.getAll(params);
              sessionStorage.setItem(cacheKey, JSON.stringify({ data: res.data, pagination: res.pagination }));
            } catch { /* ignore background refresh errors */ }
            return;
          }
        } catch { /* cache read failed, fall through to normal fetch */ }
      }

      setLoading(true);
      try {
        const params = { page: filters.page, limit: filters.limit };
        if (filters.cursor) params.cursor = filters.cursor;
        if (filters.category) params.category = filters.category;
        if (filters.origin) params.origin = filters.origin;
        if (filters.conservation_status) params.conservation_status = filters.conservation_status;
        if (filters.kingdom) params.kingdom = filters.kingdom;
        if (filters.phylum) params.phylum = filters.phylum;
        if (filters.class) params.class = filters.class;
        if (filters.order) params.order = filters.order;
        if (filters.family) params.family = filters.family;
        if (filters.genus) params.genus = filters.genus;

        const res = await speciesAPI.getAll(params);
        setSpecies(res.data);
        setPagination(res.pagination);
        // Intentionally avoid aggressive preloading here; the image queue in
        // SafeImage now controls concurrency and keeps the browser from firing
        // too many proxy requests at once.
        // Cache the result for instant back-navigation
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({ data: res.data, pagination: res.pagination }));
        } catch { /* ignore if sessionStorage is full */ }
      } catch (err) {
        console.error('Failed to fetch species:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchSpecies();
  }, [location.search]);

  useLayoutEffect(() => {
    if (loading || !shouldRestoreScroll) return;
    const savedPath = sessionStorage.getItem('ffdb_return_path');
    const savedScrollY = Number(sessionStorage.getItem('ffdb_return_scroll_y') || 0);

    if (savedPath !== `${location.pathname}${location.search}${location.hash}`) {
      return;
    }

    sessionStorage.removeItem('ffdb_return_path');
    sessionStorage.removeItem('ffdb_return_scroll_y');
    window.scrollTo({ top: savedScrollY, left: 0, behavior: 'auto' });
  }, [loading, shouldRestoreScroll, location.pathname, location.search, location.hash]);

  const handleFilterChange = (key, value) => {
    const nextFilters = { ...filters, [key]: value, page: 1 };
    const search = buildSearchFromFilters(nextFilters);
    navigate(search ? `${location.pathname}?${search}` : location.pathname, { replace: true });
  };

  const handlePageChange = (newPage) => {
    const nextFilters = { ...filters, page: newPage };
    const search = buildSearchFromFilters(nextFilters);
    navigate(search ? `${location.pathname}?${search}` : location.pathname, { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Use cursor for "Next" — much faster at deep pages
  const handleNextPage = () => {
    if (pagination.nextCursor) {
      const nextFilters = { ...filters, page: (pagination.page || filters.page) + 1, cursor: pagination.nextCursor };
      const search = buildSearchFromFilters(nextFilters);
      navigate(search ? `${location.pathname}?${search}` : location.pathname, { replace: true });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      handlePageChange((pagination.page || filters.page) + 1);
    }
  };

  const clearTaxonomyFilter = (key) => {
    const nextFilters = { ...filters, [key]: '', page: 1 };
    const search = buildSearchFromFilters(nextFilters);
    navigate(search ? `${location.pathname}?${search}` : location.pathname, { replace: true });
  };

  const clearAllTaxonomyFilters = () => {
    const nextFilters = {
      ...filters,
      kingdom: '',
      phylum: '',
      class: '',
      order: '',
      family: '',
      genus: '',
      page: 1,
    };
    const search = buildSearchFromFilters(nextFilters);
    navigate(search ? `${location.pathname}?${search}` : location.pathname, { replace: true });
  };

  return (
    <div className="page-enter container" id="species-list-page" ref={pageRef} style={{ paddingTop: '40px', paddingBottom: '60px' }}>
      <Helmet>
        <title>Browse Species - FFDB</title>
        <meta name="description" content="Browse the complete catalog of flora and fauna species in Bangladesh. Filter by category and conservation status." />
        <meta property="og:title" content="Browse Species - FFDB" />
        <meta property="og:site_name" content="FFDB" />
        <meta property="og:description" content="Browse the complete catalog of flora and fauna species in Bangladesh." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content={`${siteOrigin}/og-fallback.png`} />
        <meta property="og:image:alt" content="Flora and Fauna Database of Bangladesh" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Browse Species - FFDB" />
        <meta name="twitter:description" content="Browse the complete catalog of flora and fauna species in Bangladesh." />
        {/* Prevent Google from indexing paginated/filtered variants as separate pages */}
        {(filters.page > 1 || filters.category || filters.origin || filters.conservation_status) && (
          <meta name="robots" content="noindex, follow" />
        )}
        <link rel="canonical" href={canonicalUrl} />
        <script type="application/ld+json">{JSON.stringify(listJsonLd)}</script>
      </Helmet>
      <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '8px' }}>
        Browse Species
      </h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '15px' }}>
        Explore the biodiversity of Bangladesh — {pagination.totalRecords || 0} species catalogued.
      </p>

      {/* Filters */}
      <div className="filters-bar" id="species-filters">
        <select
          className="filter-select"
          value={filters.category}
          onChange={(e) => handleFilterChange('category', e.target.value)}
          id="filter-category"
        >
          <option value="">All Categories</option>
          <option value="flora">Flora</option>
          <option value="fauna">Fauna</option>
        </select>

        <select
          className="filter-select"
          value={filters.conservation_status}
          onChange={(e) => handleFilterChange('conservation_status', e.target.value)}
          id="filter-conservation"
        >
          <option value="">All Conservation Status</option>
          <option value="NE">NE — Not Evaluated</option>
          <option value="DD">DD — Data Deficient</option>
          <option value="LC">LC — Least Concern</option>
          <option value="NT">NT — Near Threatened</option>
          <option value="VU">VU — Vulnerable</option>
          <option value="EN">EN — Endangered</option>
          <option value="CR">CR — Critically Endangered</option>
          <option value="RE">RE — Regionally Extinct</option>
          <option value="EW">EW — Extinct in the Wild</option>
          <option value="EX">EX — Extinct</option>
        </select>

        <select
          className="filter-select"
          value={filters.origin}
          onChange={(e) => handleFilterChange('origin', e.target.value)}
          id="filter-origin"
        >
          <option value="">All Origins</option>
          <option value="native">Native</option>
          <option value="exotic">Exotic</option>
        </select>
      </div>

      {activeTaxonomyFilters.length > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          alignItems: 'center',
          marginBottom: '20px',
        }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Taxonomy
          </span>
          {activeTaxonomyFilters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => clearTaxonomyFilter(filter.key)}
              title={`Clear ${filter.label} filter`}
              style={{
                border: '1px solid var(--border-color)',
                background: 'var(--accent-subtle)',
                color: 'var(--accent-primary)',
                borderRadius: '999px',
                padding: '7px 12px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>{filter.label}: {filter.value}</span>
              <span aria-hidden="true">×</span>
            </button>
          ))}
          <button
            type="button"
            onClick={clearAllTaxonomyFilters}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: '4px 2px',
            }}
          >
            Clear taxonomy
          </button>
        </div>
      )}

      {/* Species Grid */}
      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <span className="loading-text">Loading species...</span>
        </div>
      ) : species.length > 0 ? (
        <>
          <div className="species-grid">
            {species.map((sp, i) => (
              <SpeciesCard key={sp.id} species={sp} index={i} />
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="pagination" id="species-pagination">
              <button
                disabled={!pagination.hasPreviousPage}
                onClick={() => handlePageChange(pagination.page - 1)}
              >
                Prev
              </button>
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                .filter((p) => {
                  // Show first, last, and pages near current
                  return p === 1 || p === pagination.totalPages || Math.abs(p - pagination.page) <= 2;
                })
                .map((p, idx, arr) => (
                  <span key={p}>
                    {idx > 0 && arr[idx - 1] !== p - 1 && (
                      <button disabled>...</button>
                    )}
                    <button
                      className={p === pagination.page ? 'active' : ''}
                      onClick={() => handlePageChange(p)}
                    >
                      {p}
                    </button>
                  </span>
                ))}
              <button
                disabled={!pagination.hasNextPage}
                onClick={handleNextPage}
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">No Result</div>
          <h3>No species found</h3>
          <p>Try adjusting your filters or check back later.</p>
        </div>
      )}
    </div>
  );
}
