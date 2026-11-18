import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { searchAPI, noticeAPI } from '../services/api';
import { preloadRoute } from '../utils/routePreload';
import ThemeToggle from './ThemeToggle';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false); // new state for mobile dropdown
  const [notice, setNotice] = useState(null);
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const navigate = useNavigate();
  const searchRef = useRef(null);
  const debounceRef = useRef(null);
  const scrollYRef = useRef(0);

  useEffect(() => {
    noticeAPI.getActive()
      .then((res) => {
        const nextNotice = res.data || null;
        setNotice(nextNotice);
        setNoticeDismissed(nextNotice ? localStorage.getItem(`ffdb_notice_dismissed_${nextNotice.updated_at}`) === '1' : false);
      })
      .catch(() => setNotice(null));
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault(); // Prevent '/' from being typed into the input initially
        const searchInput = document.querySelector('.navbar-search-input');
        if (searchInput) {
          // On mobile, if we focus the input, we should also open the search overlay
          if (window.innerWidth <= 768) {
            setMobileMenuOpen(false);
            setMobileSearchOpen(true);
          }
          searchInput.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSuggestions(false);
        // On mobile, clicking outside should close the search dropdown
        if (window.innerWidth <= 768) {
           setMobileSearchOpen(false);
        }
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
      scrollYRef.current = window.scrollY || window.pageYOffset || 0;
      body.style.position = 'fixed';
      body.style.top = `-${scrollYRef.current}px`;
      body.style.left = '0';
      body.style.right = '0';
      body.style.overflow = 'hidden';
      body.style.width = '100%';
    } else {
      body.style.position = '';
      body.style.top = '';
      body.style.left = '';
      body.style.right = '';
      body.style.overflow = '';
      body.style.width = '';
      window.scrollTo(0, scrollYRef.current || 0);
    }
    return () => {
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
      setMobileSearchOpen(false);
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleSuggestionClick = (id) => {
    try { sessionStorage.setItem('lastSearchedSpeciesId', String(id)); } catch (e) {}
    setShowSuggestions(false);
    setQuery('');
    setMobileMenuOpen(false);
    setMobileSearchOpen(false);
    navigate(`/species/${id}`);
  };

  const handleLogoClick = () => {
    setMobileMenuOpen(false);
    setMobileSearchOpen(false);
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
    <>
      <nav className={`navbar ${scrolled ? 'scrolled' : ''} ${mobileMenuOpen ? 'menu-open' : ''}`} id="main-navbar">
      <div className="container">
        {/* Hamburger Menu Button (Mobile) */}
        <button
          className={`hamburger ${mobileMenuOpen ? 'active' : ''}`}
          onClick={() => { setMobileMenuOpen(!mobileMenuOpen); setMobileSearchOpen(false); }}
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

        {/* Navigation Links (drawer) */}
        {mobileMenuOpen && (
          <div className="mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)}></div>
        )}
        <div className={`navbar-nav ${mobileMenuOpen ? 'open' : ''}`}>
          <ul className="navbar-links">
            <li><Link to="/" onClick={() => setMobileMenuOpen(false)} onMouseEnter={() => prefetchOnIntent('/')} onFocus={() => prefetchOnIntent('/')}>Home</Link></li>
            <li><Link to="/species" onClick={() => setMobileMenuOpen(false)} onMouseEnter={() => prefetchOnIntent('/species')} onFocus={() => prefetchOnIntent('/species')}>Browse</Link></li>
            <li><Link to="/contribute" onClick={() => setMobileMenuOpen(false)} onMouseEnter={() => prefetchOnIntent('/contribute')} onFocus={() => prefetchOnIntent('/contribute')}>Contribute</Link></li>
            <li><Link to="/report-problem" onClick={() => setMobileMenuOpen(false)} onMouseEnter={() => prefetchOnIntent('/report-problem')} onFocus={() => prefetchOnIntent('/report-problem')}>Report a Problem</Link></li>
            <li><Link to="/team" onClick={() => setMobileMenuOpen(false)} onMouseEnter={() => prefetchOnIntent('/team')} onFocus={() => prefetchOnIntent('/team')}>Team</Link></li>
            <li><Link to="/about" onClick={() => setMobileMenuOpen(false)} onMouseEnter={() => prefetchOnIntent('/about')} onFocus={() => prefetchOnIntent('/about')}>About</Link></li>
            <li><Link to="/api-docs" onClick={() => setMobileMenuOpen(false)} onMouseEnter={() => prefetchOnIntent('/api-docs')} onFocus={() => prefetchOnIntent('/api-docs')}>API Docs</Link></li>
          </ul>
        </div>

        {/* Center Search Bar & Right Controls */}
        <div className="navbar-controls">
          
          {/* Mobile Search Toggle Icon */}
          <button 
            className="mobile-search-toggle" 
            onClick={() => { setMobileSearchOpen(!mobileSearchOpen); setMobileMenuOpen(false); }}
            aria-label="Toggle search"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </button>

          {/* Search Container */}
          <div className={`navbar-search-container ${mobileSearchOpen ? 'mobile-open' : ''}`} ref={searchRef}>
            <form className="navbar-search-form" onSubmit={handleSearch}>
              <div className="search-input-wrapper">
                <svg className="search-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input
                  type="text"
                  placeholder="Search species..."
                  value={query}
                  onChange={handleQueryChange}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  className="navbar-search-input"
                  autoComplete="off"
                />
                {/* Desktop shortcut hint (optional) */}
                <div className="search-shortcut">/</div>
              </div>
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
                          e.preventDefault(); 
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
          
          <ThemeToggle />
        </div>
      </div>
      </nav>
      {notice && !noticeDismissed && (
      <div className={`site-notice site-notice-${notice.style}`} role="status">
        <div className="site-notice-content">
          <div>
            {notice.title && <strong>{notice.title}</strong>}
            <span className="site-notice-message" dangerouslySetInnerHTML={{ __html: notice.message }} />
          </div>
          {notice.dismissible && (
            <button
              type="button"
              className="site-notice-dismiss"
              aria-label="Dismiss notice"
              onClick={() => {
                localStorage.setItem(`ffdb_notice_dismissed_${notice.updated_at}`, '1');
                setNoticeDismissed(true);
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>
      )}
    </>
  );
}
