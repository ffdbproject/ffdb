import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { speciesAPI } from '../services/api';
import SpeciesCard from '../components/SpeciesCard';

export default function HomePage() {
  const [stats, setStats] = useState(null);
  const [recentSpecies, setRecentSpecies] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const homePageRef = useRef(null);
  const navigate = useNavigate();
  const siteOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const canonicalUrl = `${siteOrigin}/`;
  const fallbackImageUrl = `${siteOrigin}/og-fallback.png`;
  const currentPath = typeof window !== 'undefined'
    ? `${window.location.pathname}${window.location.search}${window.location.hash}`
    : '/';
  const shouldRestoreScroll = typeof window !== 'undefined'
    && sessionStorage.getItem('ffdb_return_path') === currentPath;

  const webSiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'FFDB',
    alternateName: 'Flora and Fauna Database of Bangladesh',
    url: canonicalUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${siteOrigin}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'FFDB',
    alternateName: 'Flora and Fauna Database of Bangladesh',
    url: siteOrigin,
  };

  // Use public/logo.png when available. Prefer absolute origin when known,
  // otherwise use site-root relative path so the URL resolves in all hosts.
  const logoPath = siteOrigin ? `${siteOrigin}/logo.png` : '/logo.png';

  useLayoutEffect(() => {
    if (loading || !shouldRestoreScroll) return;

    const savedScrollY = Number(sessionStorage.getItem('ffdb_return_scroll_y') || 0);
    sessionStorage.removeItem('ffdb_return_path');
    sessionStorage.removeItem('ffdb_return_scroll_y');
    window.scrollTo({ top: savedScrollY, left: 0, behavior: 'auto' });
  }, [loading, shouldRestoreScroll]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, speciesRes] = await Promise.all([
          speciesAPI.getStats(),
          speciesAPI.getAll({ page: 1, limit: 8 }),
        ]);
        setStats(statsRes.data);
        setRecentSpecies(speciesRes.data);
      } catch (err) {
        console.error('Failed to load homepage data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <span className="loading-text">Loading FFDB...</span>
      </div>
    );
  }

  return (
    <div className="page-enter" id="home-page" ref={homePageRef}>
      <Helmet>
        <title>Flora and Fauna Database of Bangladesh</title>
        <meta name="description" content="Explore the rich biodiversity of Bangladesh. A centralized, authoritative database for researchers, students, and conservationists." />
        <meta property="og:title" content="Flora and Fauna Database of Bangladesh" />
        <meta property="og:site_name" content="FFDB" />
        <meta property="og:description" content="Explore the rich biodiversity of Bangladesh. A centralized, authoritative database for researchers, students, and conservationists." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content={fallbackImageUrl} />
        <meta property="og:image:alt" content="Flora and Fauna Database of Bangladesh" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Flora and Fauna Database of Bangladesh" />
        <meta name="twitter:description" content="Explore the rich biodiversity of Bangladesh. A centralized, authoritative database for researchers, students, and conservationists." />
        <meta name="twitter:image" content={fallbackImageUrl} />
        <meta name="twitter:image:alt" content="Flora and Fauna Database of Bangladesh" />
        <meta name="twitter:image:width" content="1024" />
        <meta name="twitter:image:height" content="512" />
        <link rel="canonical" href={canonicalUrl} />
        <script type="application/ld+json">{JSON.stringify(webSiteJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify({ ...organizationJsonLd, logo: logoPath })}</script>
      </Helmet>
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <h1>
            Flora and Fauna Database of{' '}
            <span className="highlight">Bangladesh</span> (FFDB)
          </h1>
          <p>
            Explore the rich biodiversity of Bangladesh, from iconic wildlife to native and exotic plants found across forests, rivers, and wetlands. A centralized, authoritative database for researchers, students, and conservationists.
          </p>
          {stats && (
            <div className="hero-stats">
              <div className="hero-stat">
                <div className="number">{stats.total}</div>
                <div className="label">Total Species</div>
              </div>
              <div className="hero-stat">
                <div className="number">{stats.flora_count}</div>
                <div className="label">Flora</div>
              </div>
              <div className="hero-stat">
                <div className="number">{stats.fauna_count}</div>
                <div className="label">Fauna</div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Search Bar */}
      <div className="container">
        <div className="search-hero">
          <form onSubmit={handleSearch}>
            <div className="search-bar-wrap">
              <input
                type="text"
                placeholder="Search by scientific name, English name, or বাংলা নাম..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                id="home-search-input"
              />
              <button type="submit" className="search-bar-btn" id="home-search-btn">
                Search
              </button>
            </div>
          </form>
        </div>

        {/* Recent Species */}
        <div className="section-header">
          <h2>Recently Added Species</h2>
          <a href="/species">View All</a>
        </div>

        {recentSpecies.length > 0 ? (
          <div className="species-grid">
            {recentSpecies.map((sp, i) => (
              <SpeciesCard key={sp.id} species={sp} index={i} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">No Data</div>
            <h3>No species yet</h3>
            <p>Start by adding species through the admin panel or contribute data.</p>
          </div>
        )}
      </div>
    </div>
  );
}
