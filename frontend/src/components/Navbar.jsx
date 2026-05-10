import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { searchAPI } from '../services/api';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const navigate = useNavigate();
  const searchRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Debounced autocomplete
  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchAPI.suggest(query);
        setSuggestions(res.data || []);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      setShowSuggestions(false);
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleSuggestionClick = (id) => {
    setShowSuggestions(false);
    setQuery('');
    navigate(`/species/${id}`);
  };

  return (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''}`} id="main-navbar">
      <div className="container">
        <Link to="/" className="navbar-logo">
          <span className="logo-flora">FFDB</span>
          <span className="logo-dot" aria-hidden="true"></span>
        </Link>

        <ul className="navbar-links">
          <li><Link to="/">Home</Link></li>
          <li><Link to="/species">Browse</Link></li>
          <li><Link to="/contribute">Contribute</Link></li>
          <li><Link to="/api-docs">API Docs</Link></li>
        </ul>

        <div className="navbar-search" ref={searchRef} style={{ position: 'relative' }}>
          <span className="navbar-search-icon">Search</span>
          <form onSubmit={handleSearch}>
            <input
              type="text"
              placeholder="Search species..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              id="navbar-search-input"
            />
          </form>

          {showSuggestions && suggestions.length > 0 && (
            <div className="search-suggestions">
              {suggestions.map((s) => (
                <div
                  key={s.id}
                  className="search-suggestion-item"
                  onClick={() => handleSuggestionClick(s.id)}
                >
                  <div>
                    <div className="name">
                      {s.english_name || s.scientific_name}
                    </div>
                    <div className="scientific">{s.scientific_name}</div>
                  </div>
                  <span className={`species-card-category ${s.category}`} style={{ position: 'static' }}>
                    {s.category}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
