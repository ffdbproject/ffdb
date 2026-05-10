import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { searchAPI } from '../services/api';
import SpeciesCard from '../components/SpeciesCard';

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const page = parseInt(searchParams.get('page'), 10) || 1;
  const category = searchParams.get('category') || '';

  const [results, setResults] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query) return;

    async function doSearch() {
      setLoading(true);
      try {
        const params = { page, limit: 20 };
        if (category) params.category = category;

        const res = await searchAPI.search(query, params);
        setResults(res.data);
        setPagination(res.pagination);
      } catch (err) {
        console.error('Search failed:', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }
    doSearch();
  }, [query, page, category]);

  const handleCategoryFilter = (cat) => {
    const params = { q: query };
    if (cat) params.category = cat;
    setSearchParams(params);
  };

  const handlePageChange = (newPage) => {
    const params = { q: query, page: newPage };
    if (category) params.category = category;
    setSearchParams(params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="page-enter container" id="search-page" style={{ paddingTop: '40px', paddingBottom: '60px' }}>
      <Helmet>
        <title>{query ? `Search: "${query}"` : 'Search Species'} | FFDB</title>
        <meta name="description" content={`Search results for ${query} in the Flora and Fauna Database of Bangladesh.`} />
        <meta name="robots" content="noindex, follow" />
      </Helmet>
      <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '4px' }}>
        Search Results
      </h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '14px' }}>
        {loading
          ? 'Searching...'
          : `${pagination.totalRecords || 0} result(s) for "${query}"`}
      </p>

      {/* Category filter pills */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {['', 'flora', 'fauna'].map((cat) => (
          <button
            key={cat}
            onClick={() => handleCategoryFilter(cat)}
            className={`btn btn-sm ${category === cat ? 'btn-primary' : 'btn-secondary'}`}
            id={`search-filter-${cat || 'all'}`}
          >
            {cat === '' ? 'All' : cat === 'flora' ? 'Flora' : 'Fauna'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <span className="loading-text">Searching...</span>
        </div>
      ) : results.length > 0 ? (
        <>
          <div className="species-grid">
            {results.map((sp) => (
              <SpeciesCard key={sp.id} species={sp} />
            ))}
          </div>

          {pagination.totalPages > 1 && (
            <div className="pagination">
              <button
                disabled={!pagination.hasPreviousPage}
                onClick={() => handlePageChange(page - 1)}
              >
                Prev
              </button>
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === pagination.totalPages || Math.abs(p - page) <= 2)
                .map((p, idx, arr) => (
                  <span key={p}>
                    {idx > 0 && arr[idx - 1] !== p - 1 && <button disabled>...</button>}
                    <button
                      className={p === page ? 'active' : ''}
                      onClick={() => handlePageChange(p)}
                    >
                      {p}
                    </button>
                  </span>
                ))}
              <button
                disabled={!pagination.hasNextPage}
                onClick={() => handlePageChange(page + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">No Result</div>
          <h3>No results found</h3>
          <p>Try a different search term or adjust your filters.</p>
        </div>
      )}
    </div>
  );
}
