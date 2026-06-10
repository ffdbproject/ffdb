import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { searchAPI } from '../services/api';
import { preloadRoute } from '../utils/routePreload';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const searchRef = useRef(null);
  const debounceRef = useRef(null);
  const scrollYRef = useRef(0);

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

  // Lock body scroll when mobile menu is open (preserve scroll position)
  useEffect(() => {
    const body = document.body;
    if (mobileMenuOpen) {
      // store current scroll position
      scrollYRef.current = window.scrollY || window.pageYOffset || 0;
      // lock
      body.style.position = 'fixed';
      body.style.top = `-${scrollYRef.current}px`;
      body.style.left = '0';
      body.style.right = '0';
      body.style.overflow = 'hidden';
      body.style.width = '100%';
    } else {
      // unlock and restore scroll
      body.style.position = '';
      body.style.top = '';
      body.style.left = '';
      body.style.right = '';
      body.style.overflow = '';
      body.style.width = '';
      window.scrollTo(0, scrollYRef.current || 0);
    }

    return () => {
      // ensure unlock on unmount
      body.style.position = '';
      body.style.top = '';
      body.style.left = '';
      body.style.right = '';
      body.style.overflow = '';
      body.style.width = '';
    };
  }, [mobileMenuOpen]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      setShowSuggestions(false);
      setMobileMenuOpen(false);
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleSuggestionClick = (id) => {
    // remember the last selected species to avoid showing it immediately
    try { sessionStorage.setItem('lastSearchedSpeciesId', String(id)); } catch (e) {}
    setShowSuggestions(false);
    setQuery('');
    setMobileMenuOpen(false);
    navigate(`/species/${id}`);
  };

  const handleLogoClick = () => {
    setMobileMenuOpen(false);
  };

  const handleQueryChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    if (value.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const prefetchOnIntent = (path) => {
    preloadRoute(path);
  };

  return (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''} ${mobileMenuOpen ? 'menu-open' : ''}`} id="main-navbar">
      <div className="container">
        {/* Hamburger Menu Button (Mobile) */}
        <button
          className={`hamburger ${mobileMenuOpen ? 'active' : ''}`}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen}
        >
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
        </button>

        {/* Logo */}
        <Link
          to="/"
          className="navbar-logo"
          onClick={handleLogoClick}
          onMouseEnter={() => prefetchOnIntent('/')}
          onFocus={() => prefetchOnIntent('/')}
          onTouchStart={() => prefetchOnIntent('/')}
        >
          <span className="logo-flora">FFDB</span>
          <span className="logo-dot" aria-hidden="true"></span>
        </Link>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div className="mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)}></div>
        )}

        {/* Navigation Links (drawer) */}
        <div className={`navbar-nav ${mobileMenuOpen ? 'open' : ''}`}>
          <ul className="navbar-links">
            <li><Link to="/" onClick={() => setMobileMenuOpen(false)} onMouseEnter={() => prefetchOnIntent('/')} onFocus={() => prefetchOnIntent('/')} onTouchStart={() => prefetchOnIntent('/')}>Home</Link></li>
            <li><Link to="/species" onClick={() => setMobileMenuOpen(false)} onMouseEnter={() => prefetchOnIntent('/species')} onFocus={() => prefetchOnIntent('/species')} onTouchStart={() => prefetchOnIntent('/species')}>Browse</Link></li>
            <li><Link to="/contribute" onClick={() => setMobileMenuOpen(false)} onMouseEnter={() => prefetchOnIntent('/contribute')} onFocus={() => prefetchOnIntent('/contribute')} onTouchStart={() => prefetchOnIntent('/contribute')}>Contribute</Link></li>
            <li><Link to="/report-problem" onClick={() => setMobileMenuOpen(false)} onMouseEnter={() => prefetchOnIntent('/report-problem')} onFocus={() => prefetchOnIntent('/report-problem')} onTouchStart={() => prefetchOnIntent('/report-problem')}>Report a Problem</Link></li>
            <li><Link to="/team" onClick={() => setMobileMenuOpen(false)} onMouseEnter={() => prefetchOnIntent('/team')} onFocus={() => prefetchOnIntent('/team')} onTouchStart={() => prefetchOnIntent('/team')}>Team</Link></li>
            <li><Link to="/about" onClick={() => setMobileMenuOpen(false)} onMouseEnter={() => prefetchOnIntent('/about')} onFocus={() => prefetchOnIntent('/about')} onTouchStart={() => prefetchOnIntent('/about')}>About</Link></li>
            <li><Link to="/api-docs" onClick={() => setMobileMenuOpen(false)} onMouseEnter={() => prefetchOnIntent('/api-docs')} onFocus={() => prefetchOnIntent('/api-docs')} onTouchStart={() => prefetchOnIntent('/api-docs')}>API Docs</Link></li>
          </ul>
        </div>

        {/* Desktop Search */}
        <div className="navbar-search" ref={searchRef} style={{ position: 'relative' }}>
          <span className="navbar-search-icon">Search</span>
          <form onSubmit={handleSearch}>
            <input
              type="text"
              placeholder="Search species..."
              value={query}
              onChange={handleQueryChange}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              id="navbar-search-input-desktop"
            />
          </form>

          {showSuggestions && suggestions.length > 0 && (
            <div className="search-suggestions">
              {(() => {
                let lastId = null;
                try { lastId = sessionStorage.getItem('lastSearchedSpeciesId'); } catch (e) {}
                const filtered = suggestions.filter((s) => {
                  const publicId = String(s.public_id || s.id);
                  return publicId !== String(lastId);
                });
                const itemsToRender = (filtered.length === 0 && suggestions.length > 0) ? suggestions : filtered;
                return itemsToRender.map((s) => {
                  const publicId = s.public_id || s.id;
                  return (
                    <div
                      key={publicId}
                      className="search-suggestion-item"
                      onMouseDown={(e) => {
                        e.preventDefault(); // prevent input blur / layout shift
                        handleSuggestionClick(publicId);
                      }}
                    >
                      <div>
                        <div className="name">
                          {s.english_name || s.scientific_name}
                        </div>
                        {s.bengali_name && (
                          <div className="bengali-name">{s.bengali_name}</div>
                        )}
                        <div className="scientific">{s.scientific_name}</div>
                      </div>
                      <span className={`species-card-category ${s.category}`} style={{ position: 'static' }}>
                        {s.category}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
