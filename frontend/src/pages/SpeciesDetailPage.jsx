// ============================================================
// FFDB - Flora and Fauna Database of Bangladesh
// Species Detail Page — Full species info with Leaflet map
// ============================================================

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

const CONSERVATION_STATUS_LABELS = {
  EX: 'Extinct',
  EW: 'Extinct in the Wild',
  RE: 'Regionally Extinct',
  CR: 'Critically Endangered',
  EN: 'Endangered',
  VU: 'Vulnerable',
  NT: 'Near Threatened',
  LC: 'Least Concern',
  DD: 'Data Deficient',
  NE: 'Not Evaluated',
};
import { speciesAPI, resolveAssetUrl, authAPI } from '../services/api';
import SafeImage from '../components/SafeImage';

// Leaflet imports
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function DeferredMount({ children, placeholderHeight = 280 }) {
  const sentinelRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = sentinelRef.current;
    if (!element) return undefined;

    if (typeof IntersectionObserver === 'undefined') {
      const timer = setTimeout(() => setIsVisible(true), 0);
      return () => clearTimeout(timer);
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setIsVisible(true);
        observer.disconnect();
      }
    }, {
      rootMargin: '200px 0px',
      threshold: 0.01,
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={sentinelRef}>
      {isVisible ? children : (
        <div style={{
          minHeight: `${placeholderHeight}px`,
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-secondary)',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
        }}>
          Scroll to load gallery
        </div>
      )}
    </div>
  );
}

function stripDescriptionHtml(value) {
  if (!value) return '';
  const parser = new DOMParser();
  const documentFragment = parser.parseFromString(`<div>${value}</div>`, 'text/html');
  return documentFragment.body.textContent?.trim() || '';
}

// -- Fix Leaflet default marker icon path issue with bundlers --
// Leaflet's default icon paths break in Vite/Webpack because the
// asset URLs aren't resolved correctly. We override with CDN URLs.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom marker icon matching the FFDB brand color
const ffdbIcon = new L.Icon({
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize:      [25, 41],
  iconAnchor:    [12, 41],
  popupAnchor:   [1, -34],
  shadowSize:    [41, 41],
});

const ExternalLinkItem = ({ platform, url }) => {
  let domain = 'example.com';
  try {
    domain = new URL(url).hostname;
  } catch { /* ignore */ }
  
  const displayNames = {
    'wikipedia': 'Wikipedia',
    'inaturalist': 'iNaturalist',
    'iucn': 'IUCN Redlist',
    'gbif': 'GBIF',
    'eol': 'EOL',
    'powo': 'POWO',
    'wfo': 'WFO',
    'bold': 'Barcode of Life'
  };
  const name = displayNames[platform.toLowerCase()] || platform;

  // In public directory, the icons are named exactly as the platform keys
  // except wikipedia is wiki.png
  const iconFile = platform.toLowerCase() === 'wikipedia' ? 'wiki.png' : `${platform.toLowerCase()}.png`;
  const initialSrc = `/${iconFile}`;
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px 8px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius)',
        textDecoration: 'none',
        color: 'var(--text-primary)',
        transition: 'var(--transition-fast)',
        textAlign: 'center',
        gap: '12px',
        flex: '1 1 calc(33.333% - 16px)',
        minWidth: '90px',
        maxWidth: '120px'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--accent-primary)';
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-color)';
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {!imgFailed ? (
        <img 
          src={initialSrc} 
          alt={`Visit ${name} page`} 
          style={{ width: '48px', height: '48px', objectFit: 'contain' }}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div style={{ width: '48px', height: '48px', background: 'var(--bg-secondary)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'var(--text-muted)' }}>
          {name.substring(0, 2).toUpperCase()}
        </div>
      )}
      <span style={{ fontSize: '12px', fontWeight: 600, lineHeight: 1.2 }}>
        {name}
      </span>
    </a>
  );
};

export default function SpeciesDetailPage({ isPreview = false }) {
  const { id } = useParams();
  const location = useLocation();
  const isPreviewMode = isPreview || location.pathname.startsWith('/species/preview/');
  const [species, setSpecies] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [lightboxImageIdx, setLightboxImageIdx] = useState(null);
  const [lightboxScale, setLightboxScale] = useState(1);
  const [lightboxPan, setLightboxPan] = useState({ x: 0, y: 0 });
  const [lightboxDragging, setLightboxDragging] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editActiveTab, setEditActiveTab] = useState('general');
  const [saving, setSaving] = useState(false);
  const [updateError, setUpdateError] = useState(null);
  const [enriching, setEnriching] = useState(false);
  const [enrichFeedback, setEnrichFeedback] = useState(null);
  const lightboxTouchStartDistanceRef = useRef(null);
  const lightboxTouchStartScaleRef = useRef(1);
  const lightboxImageRef = useRef(null);
  // Drag-to-pan state
  const lightboxDragRef = useRef({ dragging: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0 });

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  // Memoize images so the reference is stable for hook dependencies
  const images = useMemo(() => (species && species.images) ? species.images : [], [species]);

  // Keep form updates centralized for edit modal fields.
  const handleFormChange = useCallback((updates) => {
    setEditForm(prev => ({
      ...prev,
      ...updates
    }));
  }, []);

  const updateTaxonomyField = useCallback((field, value) => {
    setEditForm(prev => ({
      ...prev,
      taxonomy: {
        ...(prev?.taxonomy || {}),
        [field]: value,
      },
    }));
  }, []);

  const updateExternalLinkField = useCallback((field, value) => {
    setEditForm(prev => ({
      ...prev,
      external_links: {
        ...(prev?.external_links || {}),
        [field]: value,
      },
    }));
  }, []);

  const fallbackTitle = id ? `Species ${id}` : 'Species';
  
  const getPrimaryTitle = (sp) => {
    if (!sp) return fallbackTitle;
    const eng = sp.english_name;
    const ben = sp.bengali_name;
    const sci = sp.scientific_name;
    if (eng && ben) return `${eng} (${ben})`;
    return eng || ben || sci;
  };

  const pageTitle = `${getPrimaryTitle(species)} - FFDB`;
  const socialTitle = getPrimaryTitle(species);

  const pageDescription = species
    ? (species.description ? stripDescriptionHtml(species.description).substring(0, 160) : `Detailed information about ${species.english_name || species.bengali_name || species.scientific_name} (${species.scientific_name}) in Bangladesh.`)
    : 'Loading species details from the Flora and Fauna Database of Bangladesh.';

  useEffect(() => {
    async function fetchSpecies() {
      setLoading(true);
      setError(null);
      try {
        const res = isPreviewMode ? await speciesAPI.getPreview(id) : await speciesAPI.getById(id);
        setSpecies(res.data);
        setEditForm(res.data ? { ...res.data } : null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchSpecies();
  }, [id]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [id]);

  // Public-facing requests resolve by public_id directly, so no client-side ID redirect is needed.

  // Check admin auth once on mount
  useEffect(() => {
    const hasAdminSession = localStorage.getItem('ffdb_admin_authenticated') === '1';
    if (!hasAdminSession) {
      return;
    }

    let mounted = true;
    authAPI.checkAuth()
      .then(() => { if (mounted) setIsAdmin(true); })
      .catch(() => {
        if (mounted) setIsAdmin(false);
        localStorage.removeItem('ffdb_admin_authenticated');
      });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (lightboxImageIdx === null) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setLightboxImageIdx(null);
      }
      if (event.key === 'ArrowRight' && images.length > 1) {
        setLightboxImageIdx((current) => (current === null ? 0 : (current + 1) % images.length));
      }
      if (event.key === 'ArrowLeft' && images.length > 1) {
        setLightboxImageIdx((current) => (current === null ? 0 : (current - 1 + images.length) % images.length));
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [lightboxImageIdx, images.length]);

  // Modal ESC key listener and body scroll lock
  useEffect(() => {
    if (!showEditModal) return undefined;
    const handleModalKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowEditModal(false);
        setUpdateError(null);
        setEnrichFeedback(null);
      }
    };
    document.addEventListener('keydown', handleModalKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleModalKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [showEditModal]);

  // Preload helper and activation (moved above early returns so hooks are stable)
  const preloadImage = (url, cb) => {
    try {
      const resolved = resolveAssetUrl(url, species?.scientific_name);
      const img = new window.Image();
      img.src = resolved;
      if (img.complete) {
        if (cb) cb();
        return;
      }
      img.onload = () => { if (cb) cb(); };
      // If the preload fails, still fire the callback so the UI
      // switches thumbnails instead of appearing unresponsive.
      img.onerror = () => { if (cb) cb(); };
    } catch {
      if (cb) cb();
    }
  };

  const preloadAndSetActive = (index) => {
    const target = images[index];
    if (!target) return;
    // Switch immediately — don't wait for preload
    setActiveImageIdx(index);
    // Preload in background for smoother experience
    preloadImage(target.image_url);
  };

  const openLightbox = (index) => {
    const target = images[index];
    if (!target) return;
    setLightboxScale(1);
    setLightboxPan({ x: 0, y: 0 });
    setLightboxImageIdx(index);
    preloadImage(target.image_url);
  };

  const closeLightbox = () => {
    setLightboxImageIdx(null);
    setLightboxScale(1);
    setLightboxPan({ x: 0, y: 0 });
    lightboxTouchStartDistanceRef.current = null;
    lightboxTouchStartScaleRef.current = 1;
    lightboxDragRef.current.dragging = false;
    setLightboxDragging(false);
  };

  // Removed "Back to Browse" button — navigation handled by breadcrumbs/header

  const goToLightboxImage = (nextIndex) => {
    if (!images.length) return;
    const normalizedIndex = (nextIndex + images.length) % images.length;
    openLightbox(normalizedIndex);
  };

  const handleLightboxWheel = (event) => {
    if (lightboxImageIdx === null) return;
    event.preventDefault();
    const direction = event.deltaY > 0 ? -1 : 1;
    setLightboxScale((current) => {
      const next = clamp(current + (direction * 0.18), 1, 4);
      if (next <= 1) {
        setLightboxPan({ x: 0, y: 0 });
      } else if (lightboxImageRef.current) {
        // Adjust pan to zoom toward cursor position
        const rect = lightboxImageRef.current.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const mx = event.clientX - cx;
        const my = event.clientY - cy;
        const ratio = next / current;
        setLightboxPan(prev => ({
          x: prev.x - mx * (ratio - 1),
          y: prev.y - my * (ratio - 1),
        }));
      }
      return next;
    });
  };

  const getTouchDistance = (touches) => {
    if (!touches || touches.length < 2) return null;
    const [touchA, touchB] = touches;
    return Math.hypot(touchA.clientX - touchB.clientX, touchA.clientY - touchB.clientY);
  };

  // --- Mouse drag-to-pan (when zoomed in) ---
  const handleLightboxMouseDown = (event) => {
    if (lightboxScale <= 1) return;
    event.preventDefault();
    lightboxDragRef.current = {
      dragging: true,
      startX: event.clientX,
      startY: event.clientY,
      startPanX: lightboxPan.x,
      startPanY: lightboxPan.y,
    };
    setLightboxDragging(true);
  };

  const handleLightboxMouseMove = (event) => {
    const drag = lightboxDragRef.current;
    if (!drag.dragging) return;
    event.preventDefault();
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    setLightboxPan({ x: drag.startPanX + dx, y: drag.startPanY + dy });
  };

  const handleLightboxMouseUp = () => {
    lightboxDragRef.current.dragging = false;
    setLightboxDragging(false);
  };

  // --- Touch: pinch-zoom + single-finger pan ---
  const handleLightboxTouchStart = (event) => {
    if (event.touches.length === 2) {
      const distance = getTouchDistance(event.touches);
      if (distance) {
        lightboxTouchStartDistanceRef.current = distance;
        lightboxTouchStartScaleRef.current = lightboxScale;
      }
    } else if (event.touches.length === 1 && lightboxScale > 1) {
      lightboxDragRef.current = {
        dragging: true,
        startX: event.touches[0].clientX,
        startY: event.touches[0].clientY,
        startPanX: lightboxPan.x,
        startPanY: lightboxPan.y,
      };
      setLightboxDragging(true);
    }
  };

  const handleLightboxTouchMove = (event) => {
    if (event.touches.length === 2 && lightboxTouchStartDistanceRef.current) {
      event.preventDefault();
      const distance = getTouchDistance(event.touches);
      if (!distance) return;
      const nextScale = clamp(
        lightboxTouchStartScaleRef.current * (distance / lightboxTouchStartDistanceRef.current),
        1, 4
      );
      if (nextScale <= 1) {
        setLightboxPan({ x: 0, y: 0 });
      }
      setLightboxScale(nextScale);
    } else if (event.touches.length === 1 && lightboxDragRef.current.dragging) {
      event.preventDefault();
      const dx = event.touches[0].clientX - lightboxDragRef.current.startX;
      const dy = event.touches[0].clientY - lightboxDragRef.current.startY;
      setLightboxPan({ x: lightboxDragRef.current.startPanX + dx, y: lightboxDragRef.current.startPanY + dy });
    }
  };

  const handleLightboxTouchEnd = (event) => {
    if (event.touches.length < 2) {
      lightboxTouchStartDistanceRef.current = null;
      lightboxTouchStartScaleRef.current = lightboxScale;
      lightboxDragRef.current.dragging = false;
      setLightboxDragging(false);
    }
  };

  // Preload adjacent images when active changes
  useEffect(() => {
    if (!images || images.length === 0) return;
    const idx = activeImageIdx;
    const toPreload = [idx, idx + 1, idx - 1]
      .map(i => (i >= 0 && i < images.length) ? images[i].image_url : null)
      .filter(Boolean);
    toPreload.forEach((u) => preloadImage(u));
  }, [activeImageIdx, images]);

  if (loading) {
    return (
      <>
        <Helmet>
          <title>{pageTitle}</title>
          <meta name="description" content={pageDescription} />
          <meta property="og:title" content={socialTitle} />
          <meta property="og:description" content={pageDescription} />
          <meta name="twitter:title" content={socialTitle} />
          <meta name="twitter:description" content={pageDescription} />
        </Helmet>
        <div className="loading">
          <div className="spinner"></div>
          <span className="loading-text">Loading species details...</span>
        </div>
      </>
    );
  }



  if (error || !species) {
    return (
      <>
        <Helmet>
          <title>{pageTitle}</title>
          <meta name="description" content={pageDescription} />
          {isPreviewMode && <meta name="robots" content="noindex, nofollow" />}
        </Helmet>
        <div className="container empty-state" style={{ paddingTop: '80px', textAlign: 'center' }}>
          <div className="empty-state-icon" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
            {isPreviewMode ? (
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--text-muted)' }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            ) : (
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--text-muted)' }}>
                <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
                <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
              </svg>
            )}
          </div>
          <h3>{isPreviewMode ? 'Preview Unavailable' : 'Species not found'}</h3>
          <p style={{ maxWidth: '480px', margin: '0 auto 24px', color: 'var(--text-secondary)' }}>
            {error || (isPreviewMode
              ? 'This draft does not exist, or you need to be logged in as an administrator to preview it.'
              : 'The species you are looking for does not exist.')}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            {isPreviewMode ? (
              <>
                <Link to="/admin/login" className="btn btn-primary">
                  Log in to Admin
                </Link>
                <Link to="/" className="btn btn-secondary">
                  Back to Home
                </Link>
              </>
            ) : (
              <Link to="/species" className="btn btn-primary">
                Browse Species
              </Link>
            )}
          </div>
        </div>
      </>
    );
  }

  const siteOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  
  const displayName = species.english_name && species.bengali_name
    ? `${species.english_name} (${species.bengali_name})`
    : (species.english_name || species.bengali_name || species.scientific_name);
  const breadcrumbSpeciesName = species.english_name || species.scientific_name || species.bengali_name || 'Species';
  const statusClass = (species.conservation_status || '').toLowerCase();
  const taxonomy = species.taxonomy || {};
  const coords = species.location_coordinates || [];
  const primaryImage = images.length > 0 ? images[activeImageIdx] || images[0] : null;
  const fallbackImageUrl = `${siteOrigin}/og-fallback.png`;

  // Calculate map center from coordinates
  const mapCenter = coords.length > 0
    ? [coords[0].lat, coords[0].lng]
    : [23.685, 90.3563]; // Default: center of Bangladesh
  const mapZoom = coords.length === 1 ? 10 : coords.length > 1 ? 7 : 7;
  const canonicalUrl = isPreviewMode
    ? `${siteOrigin}/species/preview/${id}`
    : `${siteOrigin}/species/${(species && species.public_id) ? species.public_id : id}`;
  const pageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: displayName,
    url: canonicalUrl,
    description: pageDescription,
    headline: displayName,
  };
  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'FFDB',
    alternateName: 'Flora and Fauna Database of Bangladesh',
    url: siteOrigin,
    logo: `${siteOrigin}/logo.png`,
  };
  
  // For OG/Twitter and Schema, use the direct image URL (matching the server prerender)
  // so external crawlers don't hit the shared-hosting image proxy.
  let directImageUrl = '';
  if (primaryImage && primaryImage.image_url) {
    const rawUrl = primaryImage.image_url;
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      directImageUrl = rawUrl.replace(/^http:\/\//, 'https://');
    } else {
      directImageUrl = rawUrl.startsWith('/') ? `${siteOrigin}${rawUrl}` : `${siteOrigin}/${rawUrl}`;
    }
  }
  const socialImageUrl = directImageUrl || fallbackImageUrl;
  
  // JSON-LD Structured Data — Taxon schema for flora/fauna
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Taxon",
    "name": species.scientific_name,
    "alternateName": [species.english_name, species.bengali_name].filter(Boolean),
    "description": species.description,
    "image": socialImageUrl,
    "url": canonicalUrl,
    "identifier": species && species.public_id ? String(species.public_id) : String(id),
    "taxonRank": "Species",
    "additionalProperty": species.conservation_status ? {
      "@type": "PropertyValue",
      "name": "IUCN Status",
      "value": species.conservation_status
    } : undefined
  };
  
  // Add parent taxon (genus) if available
  if (taxonomy.genus) {
    jsonLd.parentTaxon = {
      "@type": "Taxon",
      "name": taxonomy.genus,
      "taxonRank": "Genus"
    };
  }
  
  // Remove undefined properties
  Object.keys(jsonLd).forEach(key => jsonLd[key] === undefined && delete jsonLd[key]);
  
  // BreadcrumbList schema for navigation (Google-supported rich result)
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": `${siteOrigin}/`
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Species",
        "item": `${siteOrigin}/species`
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": displayName,
        "item": canonicalUrl
      }
    ]
  };

  // Article schema for Google Rich Results (matches server prerender)
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: pageTitle,
    name: displayName,
    description: pageDescription,
    url: canonicalUrl,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalUrl,
    },
    image: socialImageUrl ? [socialImageUrl] : undefined,
    author: {
      '@type': 'Organization',
      name: 'FFDB',
      url: `${siteOrigin}/`,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Flora and Fauna Database of Bangladesh',
      logo: {
        '@type': 'ImageObject',
        url: `${siteOrigin}/logo.png`,
      },
    },
    datePublished: (species.published_at || species.created_at) ? new Date(species.published_at || species.created_at).toISOString() : undefined,
    dateModified: species.updated_at ? new Date(species.updated_at).toISOString() : (species.created_at ? new Date(species.created_at).toISOString() : undefined),
    articleSection: species.category === 'flora' ? 'Flora' : (species.category === 'fauna' ? 'Fauna' : 'Species'),
    keywords: [species.english_name, species.bengali_name, species.scientific_name, 'Bangladesh', 'biodiversity'].filter(Boolean).join(', '),
    about: {
      '@type': 'Taxon',
      name: species.scientific_name,
    },
  };

  const taxonomyRows = [
    ['kingdom', 'Kingdom'],
    ['phylum', 'Phylum'],
    ['class', 'Class'],
    ['order', 'Order'],
    ['family', 'Family'],
    ['genus', 'Genus'],
  ].filter(([key]) => taxonomy[key]);

  const lightboxMarkup = lightboxImageIdx !== null && images[lightboxImageIdx] ? createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Gallery image viewer"
      onClick={closeLightbox}
      onWheel={handleLightboxWheel}
      onMouseMove={handleLightboxMouseMove}
      onMouseUp={handleLightboxMouseUp}
      onMouseLeave={handleLightboxMouseUp}
      onTouchStart={handleLightboxTouchStart}
      onTouchMove={handleLightboxTouchMove}
      onTouchEnd={handleLightboxTouchEnd}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        background: 'rgba(0, 0, 0, 0.88)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        overflow: 'hidden',
        touchAction: 'none',
      }}
    >
      <button
        type="button"
        onClick={closeLightbox}
        aria-label="Close gallery viewer"
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          width: '42px',
          height: '42px',
          borderRadius: '999px',
          border: 'none',
          background: 'rgba(255,255,255,0.14)',
          color: '#fff',
          fontSize: '22px',
          lineHeight: 1,
          cursor: 'pointer',
        }}
      >
        ×
      </button>

      {images.length > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goToLightboxImage(lightboxImageIdx - 1);
          }}
          aria-label="Previous image"
          style={{
            position: 'absolute',
            left: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '44px',
            height: '44px',
            borderRadius: '999px',
            border: 'none',
            background: 'rgba(255,255,255,0.14)',
            color: '#fff',
            fontSize: '24px',
            cursor: 'pointer',
          }}
        >
          ‹
        </button>
      )}

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 'min(1200px, 100%)',
          maxHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          touchAction: 'none',
        }}
      >
        <SafeImage
          ref={lightboxImageRef}
          src={images[lightboxImageIdx].image_url}
          imageName={species.scientific_name}
          alt={`Full size photo ${lightboxImageIdx + 1} of ${displayName}`}
          draggable={false}
          loading="eager"
          onMouseDown={handleLightboxMouseDown}
          style={{
            maxWidth: '100%',
            maxHeight: '78vh',
            objectFit: 'contain',
            borderRadius: '12px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
            background: '#111',
            transform: `translate(${lightboxPan.x}px, ${lightboxPan.y}px) scale(${lightboxScale})`,
            transformOrigin: 'center',
            transition: lightboxDragging ? 'none' : 'transform 80ms linear',
            cursor: lightboxScale > 1 ? (lightboxDragging ? 'grabbing' : 'grab') : 'default',
            userSelect: 'none',
          }}
          referrerPolicy="no-referrer"
        />

        <div style={{ color: '#fff', textAlign: 'center', maxWidth: '900px' }}>
          <div style={{ fontWeight: 700, marginBottom: '4px' }}>
            {displayName}
          </div>
          <div style={{ fontSize: '13px', opacity: 0.82 }}>
            {images[lightboxImageIdx].image_credit || 'No credit provided'}
          </div>
        </div>
      </div>

      {images.length > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goToLightboxImage(lightboxImageIdx + 1);
          }}
          aria-label="Next image"
          style={{
            position: 'absolute',
            right: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '44px',
            height: '44px',
            borderRadius: '999px',
            border: 'none',
            background: 'rgba(255,255,255,0.14)',
            color: '#fff',
            fontSize: '24px',
            cursor: 'pointer',
          }}
        >
          ›
        </button>
      )}
    </div>,
    document.body
  ) : null;

  return (
    <div className="page-enter container species-detail" id="species-detail-page">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta name="keywords" content={`${species.english_name}, ${species.bengali_name}, ${species.scientific_name}, ${species.category}, Bangladesh, flora, fauna`} />
        <meta name="author" content="FFDB" />
        <meta property="og:title" content={socialTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:site_name" content="FFDB" />
        <meta property="og:image" content={socialImageUrl} />
        <meta property="og:image:alt" content={displayName} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={socialTitle} />
        <meta name="twitter:description" content={pageDescription} />
        <meta name="twitter:image" content={socialImageUrl} />
        <meta name="twitter:image:alt" content={displayName} />
        <meta name="twitter:image:width" content="1024" />
        <meta name="twitter:image:height" content="512" />
        <link rel="canonical" href={canonicalUrl} />
        <script type="application/ld+json">{JSON.stringify(pageJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(organizationJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(articleJsonLd)}</script>
        {(isPreviewMode || (species && species.status !== 'published')) && (
          <meta name="robots" content="noindex, nofollow" />
        )}
      </Helmet>

      {/* Draft / Pending Review Preview Banner */}
      {(isPreviewMode || (species && species.status !== 'published')) && (
        <div
          className="species-preview-banner"
          style={{
            background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
            color: '#ffffff',
            padding: '14px 20px',
            borderRadius: '10px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            boxShadow: '0 4px 14px rgba(180, 83, 9, 0.25)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '0.2px' }}>
                {species?.status === 'pending_review' ? 'PENDING REVIEW PREVIEW' : 'DRAFT PREVIEW'} — UNPUBLISHED SPECIES
              </div>
              <div style={{ fontSize: '13px', opacity: 0.95 }}>
                This species is not published on the live site. Only administrators and authorized contributors can see this preview.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Link
              to="/admin"
              className="btn btn-sm"
              style={{
                background: 'rgba(255,255,255,0.2)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.3)',
                fontWeight: 600,
                textDecoration: 'none',
                padding: '6px 14px',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              Dashboard
            </Link>
            {isAdmin && (
              <button
                onClick={() => setShowEditModal(true)}
                className="btn btn-sm"
                style={{
                  background: '#ffffff',
                  color: '#b45309',
                  border: 'none',
                  fontWeight: 700,
                  padding: '6px 14px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit Species
              </button>
            )}
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      <div className="species-breadcrumb">
        <Link to="/" style={{ color: 'var(--accent-primary)' }}>Home</Link>
        <span className="species-breadcrumb-separator" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M4.5 2.5L8 6L4.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <Link to="/species" style={{ color: 'var(--accent-primary)' }}>Species</Link>
        <span className="species-breadcrumb-separator" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M4.5 2.5L8 6L4.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span>{breadcrumbSpeciesName}</span>
      </div>

      {/* Header: Image + Info side by side */}
      <div className="species-detail-header">
        {/* Image section */}
        <div className="species-detail-image-wrap">
          {primaryImage ? (
            <SafeImage
              src={primaryImage.image_url}
              imageName={species.scientific_name}
              alt={`Photo of ${displayName}`}
              loading="eager"
              style={{ width: '100%', height: 'auto', display: 'block' }}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="species-card-placeholder" style={{ aspectRatio: '4/3', fontSize: '72px' }}>
              {species.category === 'flora' ? 'Flora' : 'Fauna'}
            </div>
          )}

          {/* Image credit/attribution */}
          {primaryImage?.image_credit && (
            <div style={{
              padding: '8px 10px',
              background: 'var(--bg-secondary)',
              borderTop: '1px solid var(--border-color)',
              fontSize: '12px',
              color: 'var(--text-muted)',
              fontStyle: 'italic'
            }}>
              Photo credit: {primaryImage.image_credit}
            </div>
          )}

          {/* Image thumbnails (if multiple) */}
          {images.length > 1 && (
            <div style={{
              display: 'flex',
              gap: '6px',
              padding: '10px',
              background: 'var(--bg-secondary)',
              borderTop: '1px solid var(--border-color)',
              flexWrap: 'nowrap',
              overflowX: 'auto',
              overflowY: 'hidden',
              WebkitOverflowScrolling: 'touch',
              overscrollBehaviorX: 'contain',
              scrollSnapType: 'x proximity',
            }}>
              {images.map((img, i) => (
                <button
                  type="button"
                  key={img.id}
                  onClick={() => preloadAndSetActive(i)}
                  style={{
                    width: '82px',
                    borderRadius: '6px',
                    border: i === activeImageIdx
                      ? '2px solid var(--accent-primary)'
                      : '2px solid transparent',
                    cursor: 'pointer',
                    padding: 0,
                    background: 'var(--bg-card)',
                    opacity: i === activeImageIdx ? 1 : 0.6,
                    transition: 'var(--transition-fast)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    flex: '0 0 auto',
                    scrollSnapAlign: 'start',
                  }}
                >
                  <SafeImage
                    src={img.thumbnail_url || img.image_url}
                    imageName={species.scientific_name}
                    alt={`Thumbnail ${i + 1} of ${displayName}`}
                    width={82}
                    height={46}
                    loading="eager"
                    style={{ width: '100%', height: '46px', objectFit: 'cover', display: 'block' }}
                    referrerPolicy="no-referrer"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Species info */}
        <div className="species-detail-info">
          <h1>
            {species.english_name || species.bengali_name || species.scientific_name}
            {species.english_name && species.bengali_name && (
              <span style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
                {` (${species.bengali_name})`}
              </span>
            )}
          </h1>
          {species.bengali_name && (
            <p className="species-detail-bengali">{species.bengali_name}</p>
          )}
          <p className="species-detail-scientific">
            <em>{species.scientific_name}</em>
          </p>

          <div className="species-detail-badges">
            <span className={`species-card-category ${species.category}`} style={{ position: 'static' }}>
              {species.category}
            </span>
            {species.origin && (
              <span style={{
                background: 'var(--bg-secondary)',
                padding: '3px 12px',
                borderRadius: '50px',
                fontSize: '13px',
                fontWeight: 500,
                marginLeft: '8px'
              }}>
                {species.origin === 'native' ? 'Native' : species.origin === 'exotic' ? 'Exotic' : species.origin}
              </span>
            )}
            {species.residency_status && (
              <span style={{
                background: 'var(--bg-secondary)',
                padding: '3px 12px',
                borderRadius: '50px',
                fontSize: '13px',
                fontWeight: 500,
                marginLeft: '8px',
                textTransform: 'capitalize'
              }}>
                {species.residency_status}
              </span>
            )}
            {species.conservation_status && (
              <span className={`conservation-badge ${statusClass}`}>
                {species.conservation_status}
              </span>
            )}
            {species.status && species.status !== 'published' && (
              <span style={{
                background: species.status === 'draft' ? 'rgba(108,117,125,0.1)' : 'rgba(249,168,37,0.1)',
                color: species.status === 'draft' ? '#6c757d' : '#f9a825',
                padding: '3px 12px',
                borderRadius: '50px',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                {species.status.replace('_', ' ')}
              </span>
            )}
            {isAdmin && (
              <button
                onClick={() => setShowEditModal(true)}
                className="btn btn-secondary btn-sm"
                style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                title="Quick edit species details"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit
              </button>
            )}
          </div>

          {species.description && (
            <div
              className="species-detail-description"
              dangerouslySetInnerHTML={{ __html: species.description }}
            />
          )}

          <div style={{ marginBottom: '20px' }}>
              <strong style={{
                fontSize: '12px',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                letterSpacing: '0.5px',
              }}>
                Conservation Assessments
              </strong>
              <div className="conservation-assessment-grid">
                {[
                  ['Global', species.conservation_status, species.conservation_status_year],
                  ['Bangladesh', species.bd_conservation_status, species.bd_conservation_status_year],
                ].map(([label, status, year]) => (
                  <div key={label} className="conservation-assessment-card">
                    <span className="conservation-assessment-label">{label}</span>
                    <div className="conservation-assessment-value">
                      <span className={`conservation-badge ${(status || '').toLowerCase()}`}>
                        {status || 'N/A'}
                      </span>
                      <span className="conservation-assessment-name">
                        {status ? CONSERVATION_STATUS_LABELS[status] || status : 'Not assessed'}
                      </span>
                      {year && <span className="conservation-assessment-year">({year})</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          {species.origin && (
            <div style={{ marginBottom: '16px' }}>
              <strong style={{
                fontSize: '12px',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                letterSpacing: '0.5px',
              }}>
                Origin
              </strong>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px', textTransform: 'capitalize' }}>
                {species.origin}
              </p>
            </div>
          )}

          {species.residency_status && (
            <div style={{ marginBottom: '16px' }}>
              <strong style={{
                fontSize: '12px',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                letterSpacing: '0.5px',
              }}>
                Residency Status
              </strong>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px', textTransform: 'capitalize' }}>
                {species.residency_status.replace('_', ' ')}
              </p>
            </div>
          )}

          {species.habitat && (
            <div style={{ marginBottom: '20px' }}>
              <strong style={{
                fontSize: '12px',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                letterSpacing: '0.5px',
              }}>
                Habitat
              </strong>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
                {species.habitat}
              </p>
            </div>
          )}



          {/* Quick metadata */}
          <div className="species-detail-meta" style={{
            display: 'flex',
            gap: '24px',
            fontSize: '12px',
            color: 'var(--text-muted)',
            borderTop: '1px solid var(--border-color)',
            paddingTop: '14px',
            marginTop: '8px',
          }}>
            {taxonomy.family && (
              <div>
                <span style={{ textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Family</span>
                <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '2px' }}>{taxonomy.family}</div>
              </div>
            )}
            {taxonomy.order && (
              <div>
                <span style={{ textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Order</span>
                <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '2px' }}>{taxonomy.order}</div>
              </div>
            )}
            {coords.length > 0 && (
              <div>
                <span style={{ textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Locations</span>
                <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '2px' }}>{coords.length} mapped</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Taxonomy Table */}
      {taxonomy.kingdom && (
        <>
          <div className="section-header">
            <h2>Taxonomy</h2>
          </div>
          <table className="taxonomy-table" id="taxonomy-table">
            <tbody>
              {taxonomyRows.map(([rank, label]) => (
                <tr key={rank}>
                  <td>{label}</td>
                  <td>
                    <Link
                      to={`/species?${rank}=${encodeURIComponent(taxonomy[rank])}`}
                      style={{
                        color: 'var(--accent-primary)',
                        textDecoration: 'none',
                        fontStyle: rank === 'genus' ? 'italic' : 'normal',
                      }}
                      title={`Browse species in ${label.toLowerCase()} ${taxonomy[rank]}`}
                    >
                      {taxonomy[rank]}
                    </Link>
                  </td>
                </tr>
              ))}
              {/* Also show species name in the taxonomy table */}
              <tr>
                <td>Species</td>
                <td>
                  <em>{species.scientific_name}</em>
                  {(taxonomy.taxonomic_authority || taxonomy.authority_year) && (
                    <> ({[taxonomy.taxonomic_authority, taxonomy.authority_year].filter(Boolean).join(', ')})</>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </>
      )}



      {/* ============================================
          LEAFLET MAP — Distribution Map
          ============================================ */}
      {coords.length > 0 && (
        <>
          <div className="section-header">
            <h2>Distribution Map</h2>
          </div>
          <div className="map-container" id="species-map">
            <MapContainer
              center={mapCenter}
              zoom={mapZoom}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {coords.map((point, i) => (
                <Marker
                  key={i}
                  position={[point.lat, point.lng]}
                  icon={ffdbIcon}
                >
                  <Popup>
                    <div style={{ fontFamily: 'Inter, sans-serif', minWidth: '160px' }}>
                      <strong style={{ fontSize: '14px' }}>
                        {point.label || `Location ${i + 1}`}
                      </strong>
                      <br />
                      <span style={{ fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
                        {species.scientific_name}
                      </span>
                      <br />
                      <span style={{ fontSize: '11px', color: '#999' }}>
                        {point.lat.toFixed(4)}°N, {point.lng.toFixed(4)}°E
                      </span>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          {/* Location list below map */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            marginTop: '12px',
            marginBottom: '32px',
          }}>
            {coords.map((point, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 14px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '13px',
                }}
              >
                <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>Loc</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px' }}>
                    {point.label || `Location ${i + 1}`}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {point.lat.toFixed(4)}°N, {point.lng.toFixed(4)}°E
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Image Gallery (if multiple images, shown as full-width section below) */}
      {images.length > 1 && (
        <>
          <div className="section-header">
            <h2>Gallery</h2>
          </div>
          <DeferredMount placeholderHeight={320}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '12px',
              marginBottom: '40px',
            }}>
              {images.map((img, i) => (
                <div
                  key={img.id}
                  onClick={() => openLightbox(i)}
                  style={{
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                    border: '1px solid var(--border-color)',
                    cursor: 'pointer',
                    transition: 'var(--transition)',
                    position: 'relative',
                  }}
                >
                  <SafeImage
                    src={img.image_url}
                    imageName={species.scientific_name}
                    alt={`Gallery photo ${i + 1} of ${displayName}`}
                    width={800}
                    height={600}
                    style={{ width: '100%', height: 'auto', objectFit: 'cover', display: 'block' }}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                  <div style={{
                    padding: '8px 10px 10px',
                    background: 'var(--bg-card)',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    lineHeight: 1.4,
                  }}>
                    <div>Photo credit: {img.image_credit || 'No credit provided'}</div>
                  </div>
                  {img.is_primary && (
                    <span style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      background: 'var(--accent-primary)',
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '50px',
                      fontSize: '10px',
                      fontWeight: 700,
                    }}>
                      Primary
                    </span>
                  )}
                </div>
              ))}
            </div>
          </DeferredMount>
        </>
      )}

      {/* Last Edited Info */}
      {(species.updated_at || species.created_at) && (
        <div style={{
          textAlign: 'center',
          fontSize: '13px',
          color: 'var(--text-muted)',
          marginTop: '60px',
          marginBottom: '20px',
          fontStyle: 'italic'
        }}>
          {species.published_at && (
            <div>
              Published on {new Date(species.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.
            </div>
          )}
          <div>
            Last updated on {new Date(species.updated_at || species.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.
          </div>
        </div>
      )}

      {/* Navigation and Related Species */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '32px', marginTop: '40px', marginBottom: '32px' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px', gap: '20px' }}>
          {species.previous_species ? (
            <Link to={`/species/${species.previous_species.id}`} style={{ 
              flex: 1, 
              padding: '16px', 
              background: 'var(--bg-card)', 
              borderRadius: 'var(--radius)', 
              textDecoration: 'none', 
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>« Previous Species</span>
              <strong style={{ fontSize: '16px' }}>{species.previous_species.english_name || species.previous_species.scientific_name}</strong>
            </Link>
          ) : <div style={{ flex: 1 }}></div>}
          
          {species.next_species ? (
            <Link to={`/species/${species.next_species.id}`} style={{ 
              flex: 1, 
              padding: '16px', 
              background: 'var(--bg-card)', 
              borderRadius: 'var(--radius)', 
              textDecoration: 'none', 
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              textAlign: 'right'
            }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Next Species »</span>
              <strong style={{ fontSize: '16px' }}>{species.next_species.english_name || species.next_species.scientific_name}</strong>
            </Link>
          ) : <div style={{ flex: 1 }}></div>}
        </div>

        {species.related_species && species.related_species.length > 0 && (
          <>
            <div className="section-header">
              <h2>Related Species</h2>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '16px',
            }}>
              {species.related_species.map((rel) => (
                <Link key={rel.id} to={`/species/${rel.id}`} style={{
                  textDecoration: 'none',
                  color: 'inherit',
                  background: 'var(--bg-card)',
                  borderRadius: 'var(--radius)',
                  overflow: 'hidden',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  {rel.primary_image ? (
                    <SafeImage 
                      src={rel.primary_image}
                      imageName={rel.scientific_name}
                      style={{ width: '100%', height: '140px', objectFit: 'cover' }}
                      alt={`Photo of ${rel.english_name || rel.scientific_name}`}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div style={{ width: '100%', height: '140px', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                      No image
                    </div>
                  )}
                  <div style={{ padding: '12px' }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>{rel.english_name || rel.scientific_name}</div>
                    {rel.english_name && <div style={{ fontSize: '12px', fontStyle: 'italic', color: 'var(--text-muted)' }}>{rel.scientific_name}</div>}
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      {/* References Section */}
      {species.references && (
        <>
          <div className="section-header">
            <h2>References</h2>
          </div>
          <div 
            className="species-detail-description" 
            style={{ 
              fontSize: '14px', 
              lineHeight: 1.6, 
              color: 'var(--text-secondary)',
              background: 'var(--bg-card, #fff)',
              padding: '30px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              marginBottom: '32px',
              wordBreak: 'break-word',
              overflowWrap: 'break-word'
            }}
            dangerouslySetInnerHTML={{ 
              __html: (() => {
                let html = species.references;
                // If it doesn't already have HTML links, auto-link raw URLs
                if (!html.includes('<a ')) {
                  html = html.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
                }
                // Inject the standard styles into all <a> tags (whether they came from DB or were auto-linked)
                html = html.replace(/<a /g, '<a style="color:var(--accent-primary);text-decoration:underline;word-break:break-all;" ');
                // Convert newlines to HTML breaks so spacing is preserved
                return html.replace(/\n/g, '<br/>');
              })()
            }}
          />
        </>
      )}

      {/* External Links */}
      {species.external_links && Object.keys(species.external_links).some(k => species.external_links[k]) && (
        <>
          <div className="section-header">
            <h2>External Links</h2>
          </div>
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap',
            gap: '16px', 
            marginBottom: '32px',
            justifyContent: 'center'
          }}>
            {Object.entries(species.external_links)
              .filter(([_, url]) => url && url.trim() !== '')
              .map(([platform, url]) => (
                <ExternalLinkItem key={platform} platform={platform} url={url} />
              ))}
          </div>
        </>
      )}

      {/* Back to Browse button removed per UX request */}

      {lightboxMarkup}

      {/* Enhanced Frontend Edit Drawer (Right-side slideout mounted directly to body) */}
      {isAdmin && showEditModal && editForm && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            display: 'flex',
            justifyContent: 'flex-end',
            background: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(3px)',
            WebkitBackdropFilter: 'blur(3px)',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <style>{`
            @keyframes slideInRight {
              from {
                transform: translateX(100%);
                opacity: 0.8;
              }
              to {
                transform: translateX(0);
                opacity: 1;
              }
            }
          `}</style>
          <div
            className="species-edit-drawer"
            style={{
              width: '640px',
              maxWidth: '92vw',
              height: '100vh',
              maxHeight: '100dvh',
              background: 'var(--bg-card, #ffffff)',
              borderLeft: '1px solid var(--border-color)',
              boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header (Fixed at top of drawer) */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: 'rgba(45, 138, 78, 0.12)',
                    color: 'var(--accent-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                      Quick Edit
                    </h2>
                    <span className={`species-card-category ${editForm.category}`} style={{ position: 'static', fontSize: '10px', padding: '1px 6px' }}>
                      {editForm.category}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontWeight: 700,
                        background: editForm.status === 'published' ? '#dcfce7' : editForm.status === 'pending_review' ? '#fef3c7' : '#f3f4f6',
                        color: editForm.status === 'published' ? '#166534' : editForm.status === 'pending_review' ? '#92400e' : '#4b5563',
                        textTransform: 'uppercase',
                        letterSpacing: '0.4px',
                      }}
                    >
                      {editForm.status?.replace('_', ' ')}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {editForm.scientific_name} {editForm.english_name ? `• ${editForm.english_name}` : ''}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={async () => {
                    if (!species?.id) return;
                    setEnriching(true);
                    setEnrichFeedback(null);
                    try {
                      const res = await speciesAPI.previewEnrich(species.id);
                      const preview = res.data || {};
                      setEditForm((current) => {
                        const existingImages = Array.isArray(current.images) ? current.images : [];
                        const previewImages = Array.isArray(preview.images)
                          ? preview.images
                            .filter((image) => image?.url)
                            .map((image) => ({
                              image_url: image.url,
                              image_credit: image.image_credit || image.source || null,
                              is_primary: false,
                            }))
                          : [];
                        const images = [
                          ...existingImages,
                          ...previewImages.filter((image) => !existingImages.some(
                            (existing) => existing.image_url === image.image_url
                          )),
                        ];
                        const currentTaxonomy = current.taxonomy || {};
                        const previewTaxonomy = preview.taxonomy || {};
                        const nextTaxonomy = Object.keys({ ...currentTaxonomy, ...previewTaxonomy })
                          .reduce((taxonomy, key) => {
                            taxonomy[key] = currentTaxonomy[key] || previewTaxonomy[key] || '';
                            return taxonomy;
                          }, {});
                        return {
                          ...current,
                          description: current.description || preview.description || '',
                          habitat: current.habitat || preview.habitat || '',
                          references: current.references || preview.references || '',
                          taxonomy: nextTaxonomy,
                          external_links: { ...(current.external_links || {}), ...(preview.external_links || {}) },
                          location_coordinates: Array.isArray(current.location_coordinates) && current.location_coordinates.length > 0
                            ? current.location_coordinates
                            : (preview.coords || []),
                          images,
                        };
                      });
                      setEnrichFeedback('Enrichment preview added to this form. Click Save Changes to apply it.');
                    } catch (err) {
                      setEnrichFeedback(`Enrichment preview failed: ${err.message || 'Error occurred'}`);
                    } finally {
                      setEnriching(false);
                    }
                  }}
                  disabled={enriching}
                  title="Enrich with external data from Wikipedia & GBIF"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '11px',
                    padding: '5px 10px',
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z" />
                  </svg>
                  {enriching ? 'Enriching...' : 'Auto-Enrich'}
                </button>

                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setUpdateError(null); setEnrichFeedback(null); }}
                  aria-label="Close drawer"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '5px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Notification / Feedback Banner */}
            {enrichFeedback && (
              <div style={{ background: '#ecfdf5', borderBottom: '1px solid #a7f3d0', color: '#065f46', padding: '8px 20px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                {enrichFeedback}
              </div>
            )}
            {updateError && (
              <div style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca', color: '#991b1b', padding: '8px 20px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                {updateError}
              </div>
            )}

            {/* Segmented Navigation Tabs */}
            <div
              style={{
                display: 'flex',
                gap: '6px',
                padding: '8px 16px',
                borderBottom: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                overflowX: 'auto',
                flexShrink: 0,
              }}
            >
              {[
                {
                  id: 'general',
                  label: 'General',
                  icon: (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                  ),
                },
                {
                  id: 'taxonomy',
                  label: 'Taxonomy',
                  icon: (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="5" r="3" />
                      <line x1="12" y1="8" x2="12" y2="14" />
                      <line x1="5" y1="14" x2="19" y2="14" />
                      <circle cx="5" cy="19" r="3" />
                      <circle cx="19" cy="19" r="3" />
                    </svg>
                  ),
                },
                {
                  id: 'content',
                  label: 'Content',
                  icon: (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                  ),
                },
                {
                  id: 'links',
                  label: 'Links & GPS',
                  icon: (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                  ),
                },
              ].map((t) => {
                const isActive = editActiveTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setEditActiveTab(t.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '1px solid',
                      borderColor: isActive ? 'var(--accent-primary)' : 'transparent',
                      background: isActive ? 'rgba(45, 138, 78, 0.09)' : 'transparent',
                      color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      fontWeight: isActive ? 700 : 500,
                      fontSize: '12px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {t.icon}
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Drawer Body / Scrollable Form Area */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                padding: '20px',
                background: 'var(--bg-primary)',
              }}
            >
              {/* Tab 1: General Info */}
              {editActiveTab === 'general' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
                  <label>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>Scientific Name *</div>
                    <input
                      type="text"
                      className="form-control"
                      value={editForm.scientific_name || ''}
                      onChange={(e) => handleFormChange({ scientific_name: e.target.value })}
                      style={{ fontStyle: 'italic', width: '100%' }}
                      placeholder="e.g. Panthera tigris"
                    />
                  </label>

                  <label>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>English Name</div>
                    <input
                      type="text"
                      className="form-control"
                      value={editForm.english_name || ''}
                      onChange={(e) => handleFormChange({ english_name: e.target.value })}
                      style={{ width: '100%' }}
                      placeholder="e.g. Bengal Tiger"
                    />
                  </label>

                  <label>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>Bengali Name (বাংলা নাম)</div>
                    <input
                      type="text"
                      className="form-control"
                      value={editForm.bengali_name || ''}
                      onChange={(e) => handleFormChange({ bengali_name: e.target.value })}
                      style={{ width: '100%' }}
                      placeholder="e.g. রয়েল বেঙ্গল টাইগার"
                    />
                  </label>

                  <label>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>Category *</div>
                    <select
                      className="form-control"
                      value={editForm.category || 'flora'}
                      onChange={(e) => handleFormChange({ category: e.target.value })}
                      style={{ width: '100%' }}
                    >
                      <option value="flora">Flora</option>
                      <option value="fauna">Fauna</option>
                    </select>
                  </label>

                  <label>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>Origin</div>
                    <select
                      className="form-control"
                      value={editForm.origin || 'native'}
                      onChange={(e) => handleFormChange({ origin: e.target.value })}
                      style={{ width: '100%' }}
                    >
                      <option value="native">Native to Bangladesh</option>
                      <option value="exotic">Exotic / Introduced</option>
                    </select>
                  </label>

                  <label>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>Publication Status</div>
                    <select
                      className="form-control"
                      value={editForm.status || 'draft'}
                      onChange={(e) => handleFormChange({ status: e.target.value })}
                      style={{ width: '100%' }}
                    >
                      <option value="draft">Draft</option>
                      <option value="pending_review">Pending Review</option>
                      <option value="published">Published</option>
                    </select>
                  </label>

                  <label style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>Residency Status</div>
                    <select
                      className="form-control"
                      value={editForm.residency_status || 'resident'}
                      onChange={(e) => handleFormChange({ residency_status: e.target.value })}
                      style={{ width: '100%' }}
                    >
                      <option value="resident">Resident</option>
                      <option value="migratory">Migratory</option>
                      <option value="summer_visitor">Summer Visitor</option>
                      <option value="vagrant">Vagrant</option>
                    </select>
                  </label>

                  <label>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>Global Conservation Status</div>
                    <select
                      className="form-control"
                      value={editForm.conservation_status || ''}
                      onChange={(e) => handleFormChange({ conservation_status: e.target.value })}
                      style={{ width: '100%' }}
                    >
                      <option value="">Not Assessed</option>
                      <option value="LC">LC — Least Concern</option>
                      <option value="NT">NT — Near Threatened</option>
                      <option value="VU">VU — Vulnerable</option>
                      <option value="EN">EN — Endangered</option>
                      <option value="CR">CR — Critically Endangered</option>
                      <option value="EW">EW — Extinct in the Wild</option>
                      <option value="EX">EX — Extinct</option>
                      <option value="DD">DD — Data Deficient</option>
                      <option value="NE">NE — Not Evaluated</option>
                    </select>
                  </label>

                  <label>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>Global Assessment Year</div>
                    <input type="number" min="1000" max="2100" className="form-control" value={editForm.conservation_status_year || ''} onChange={(e) => handleFormChange({ conservation_status_year: e.target.value })} placeholder="e.g. 2022" />
                  </label>

                  <label>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>Bangladesh Conservation Status</div>
                    <select className="form-control" value={editForm.bd_conservation_status || ''} onChange={(e) => handleFormChange({ bd_conservation_status: e.target.value })}>
                      <option value="">Not Assessed</option>
                      <option value="LC">LC — Least Concern</option>
                      <option value="NT">NT — Near Threatened</option>
                      <option value="VU">VU — Vulnerable</option>
                      <option value="EN">EN — Endangered</option>
                      <option value="CR">CR — Critically Endangered</option>
                      <option value="RE">RE — Regionally Extinct</option>
                      <option value="EW">EW — Extinct in the Wild</option>
                      <option value="EX">EX — Extinct</option>
                      <option value="DD">DD — Data Deficient</option>
                      <option value="NE">NE — Not Evaluated</option>
                    </select>
                  </label>

                  <label>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>Bangladesh Assessment Year</div>
                    <input type="number" min="1000" max="2100" className="form-control" value={editForm.bd_conservation_status_year || ''} onChange={(e) => handleFormChange({ bd_conservation_status_year: e.target.value })} placeholder="e.g. 2015" />
                  </label>

                </div>
              )}

              {/* Tab 2: Taxonomy */}
              {editActiveTab === 'taxonomy' && (
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                    Scientific classification hierarchy. Updating taxonomy synchronizes taxonomy tags, genus links, and related species.
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
                    <label>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>Kingdom</div>
                      <input
                        type="text"
                        className="form-control"
                        value={editForm.taxonomy?.kingdom || ''}
                        onChange={(e) => updateTaxonomyField('kingdom', e.target.value)}
                        placeholder="e.g. Animalia or Plantae"
                        style={{ width: '100%' }}
                      />
                    </label>

                    <label>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>Phylum</div>
                      <input
                        type="text"
                        className="form-control"
                        value={editForm.taxonomy?.phylum || ''}
                        onChange={(e) => updateTaxonomyField('phylum', e.target.value)}
                        placeholder="e.g. Chordata or Tracheophyta"
                        style={{ width: '100%' }}
                      />
                    </label>

                    <label>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>Class</div>
                      <input
                        type="text"
                        className="form-control"
                        value={editForm.taxonomy?.class || ''}
                        onChange={(e) => updateTaxonomyField('class', e.target.value)}
                        placeholder="e.g. Mammalia or Magnoliopsida"
                        style={{ width: '100%' }}
                      />
                    </label>

                    <label>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>Order</div>
                      <input
                        type="text"
                        className="form-control"
                        value={editForm.taxonomy?.order || ''}
                        onChange={(e) => updateTaxonomyField('order', e.target.value)}
                        placeholder="e.g. Carnivora or Rosales"
                        style={{ width: '100%' }}
                      />
                    </label>

                    <label>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>Family</div>
                      <input
                        type="text"
                        className="form-control"
                        value={editForm.taxonomy?.family || ''}
                        onChange={(e) => updateTaxonomyField('family', e.target.value)}
                        placeholder="e.g. Felidae or Moraceae"
                        style={{ width: '100%' }}
                      />
                    </label>

                    <label>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>Genus</div>
                      <input
                        type="text"
                        className="form-control"
                        value={editForm.taxonomy?.genus || ''}
                        onChange={(e) => updateTaxonomyField('genus', e.target.value)}
                        placeholder="e.g. Panthera or Ficus"
                        style={{ width: '100%', fontStyle: 'italic' }}
                      />
                    </label>
                    
                    <label>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>Taxonomic authority</div>
                      <input type="text" className="form-control" value={editForm.taxonomy?.taxonomic_authority || ''} onChange={(e) => updateTaxonomyField('taxonomic_authority', e.target.value)} placeholder="e.g. Hodgson" style={{ width: '100%' }} />
                    </label>

                    <label>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>Authority year</div>
                      <input type="number" min="1000" max="2100" className="form-control" value={editForm.taxonomy?.authority_year || ''} onChange={(e) => updateTaxonomyField('authority_year', e.target.value)} placeholder="e.g. 1845" style={{ width: '100%' }} />
                    </label>
                  </div>
                </div>
              )}

              {/* Tab 3: Description & Habitat */}
              {editActiveTab === 'content' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <label>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Description & Identification</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>HTML or text</span>
                    </div>
                    <textarea
                      className="form-control"
                      value={editForm.description || ''}
                      onChange={(e) => handleFormChange({ description: e.target.value })}
                      rows={6}
                      style={{ width: '100%', fontFamily: 'inherit', lineHeight: 1.6 }}
                      placeholder="Comprehensive species overview, physical description, size, and distinctive traits..."
                    />
                  </label>

                  <label>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Habitat & Distribution in Bangladesh</span>
                    </div>
                    <textarea
                      className="form-control"
                      value={editForm.habitat || ''}
                      onChange={(e) => handleFormChange({ habitat: e.target.value })}
                      rows={4}
                      style={{ width: '100%', fontFamily: 'inherit', lineHeight: 1.6 }}
                      placeholder="Local ecological zones, Sundarbans, Chittagong Hill Tracts, wetlands, forests, rivers..."
                    />
                  </label>

                  <label>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>References & Scientific Citations</span>
                    </div>
                    <textarea
                      className="form-control"
                      value={editForm.references || ''}
                      onChange={(e) => handleFormChange({ references: e.target.value })}
                      rows={3}
                      style={{ width: '100%', fontFamily: 'inherit', lineHeight: 1.6 }}
                      placeholder="Scientific papers, field guides, IUCN reports, or institutional surveys..."
                    />
                  </label>
                </div>
              )}

              {/* Tab 4: Links & Coordinates */}
              {editActiveTab === 'links' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px', color: 'var(--text-primary)' }}>
                      External Biodiversity Databases
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                      <label>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>Wikipedia URL</div>
                        <input
                          type="url"
                          className="form-control"
                          value={editForm.external_links?.wikipedia || ''}
                          onChange={(e) => updateExternalLinkField('wikipedia', e.target.value)}
                          placeholder="https://en.wikipedia.org/wiki/..."
                          style={{ width: '100%' }}
                        />
                      </label>

                      <label>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>iNaturalist URL</div>
                        <input
                          type="url"
                          className="form-control"
                          value={editForm.external_links?.inaturalist || ''}
                          onChange={(e) => updateExternalLinkField('inaturalist', e.target.value)}
                          placeholder="https://www.inaturalist.org/taxa/..."
                          style={{ width: '100%' }}
                        />
                      </label>

                      <label>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>IUCN Red List URL</div>
                        <input
                          type="url"
                          className="form-control"
                          value={editForm.external_links?.iucn || ''}
                          onChange={(e) => updateExternalLinkField('iucn', e.target.value)}
                          placeholder="https://www.iucnredlist.org/species/..."
                          style={{ width: '100%' }}
                        />
                      </label>

                      <label>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>GBIF URL</div>
                        <input
                          type="url"
                          className="form-control"
                          value={editForm.external_links?.gbif || ''}
                          onChange={(e) => updateExternalLinkField('gbif', e.target.value)}
                          placeholder="https://www.gbif.org/species/..."
                          style={{ width: '100%' }}
                        />
                      </label>

                      <label>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>Encyclopedia of Life (EOL)</div>
                        <input
                          type="url"
                          className="form-control"
                          value={editForm.external_links?.eol || ''}
                          onChange={(e) => updateExternalLinkField('eol', e.target.value)}
                          placeholder="https://eol.org/pages/..."
                          style={{ width: '100%' }}
                        />
                      </label>

                      <label>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>BOLD Systems URL</div>
                        <input
                          type="url"
                          className="form-control"
                          value={editForm.external_links?.bold || ''}
                          onChange={(e) => updateExternalLinkField('bold', e.target.value)}
                          placeholder="https://www.boldsystems.org/..."
                          style={{ width: '100%' }}
                        />
                      </label>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        Location Coordinates (JSON)
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Array of [ {`{ "lat": 22.3, "lng": 89.5, "label": "Sundarbans" }`} ]
                      </span>
                    </div>
                    <textarea
                      className="form-control"
                      value={
                        typeof editForm.location_coordinates === 'string'
                          ? editForm.location_coordinates
                          : JSON.stringify(editForm.location_coordinates || [], null, 2)
                      }
                      onChange={(e) => {
                        try {
                          const parsed = JSON.parse(e.target.value);
                          handleFormChange({ location_coordinates: parsed });
                        } catch {
                          handleFormChange({ location_coordinates: e.target.value });
                        }
                      }}
                      rows={4}
                      style={{ width: '100%', fontFamily: 'monospace', fontSize: '12px', lineHeight: 1.5 }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer (Sticky at bottom) */}
            <div
              className="species-edit-drawer-footer"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 20px',
                borderTop: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                flexWrap: 'wrap',
                gap: '10px',
                flexShrink: 0,
              }}
            >
              <Link
                to="/admin"
                style={{
                  fontSize: '12px',
                  color: 'var(--accent-primary)',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontWeight: 600,
                }}
              >
                Full Dashboard
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </Link>

              <div className="species-edit-drawer-actions" style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setShowEditModal(false); setUpdateError(null); setEnrichFeedback(null); }}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={async () => {
                    try {
                      setSaving(true);
                      setUpdateError(null);
                      let coords = editForm.location_coordinates;
                      if (typeof coords === 'string') {
                        try { coords = JSON.parse(coords); } catch { /* ignore */ }
                      }
                      const payload = {
                        scientific_name: editForm.scientific_name,
                        english_name: editForm.english_name,
                        bengali_name: editForm.bengali_name,
                        category: editForm.category,
                        origin: editForm.origin,
                        conservation_status: editForm.conservation_status,
                        conservation_status_year: editForm.conservation_status_year || null,
                        bd_conservation_status: editForm.bd_conservation_status || null,
                        bd_conservation_status_year: editForm.bd_conservation_status_year || null,
                        residency_status: editForm.residency_status,
                        status: editForm.status,
                        description: editForm.description,
                        habitat: editForm.habitat,
                        references: editForm.references,
                        external_links: editForm.external_links,
                        taxonomy: editForm.taxonomy,
                        location_coordinates: coords,
                        images: editForm.images,
                      };
                      await speciesAPI.update(species.id, payload);
                      const refreshed = isPreviewMode ? await speciesAPI.getPreview(species.id) : await speciesAPI.getById(species.public_id || species.id);
                      setSpecies(refreshed.data);
                      setEditForm(refreshed.data);
                      setUpdateError(null);
                      setEnrichFeedback(null);
                      setShowEditModal(false);
                    } catch (err) {
                      setUpdateError(err.message || 'Update failed. Please check your inputs.');
                      console.error('Update error:', err);
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={saving}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontWeight: 600,
                  }}
                >
                  {saving ? (
                    <>
                      <span className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px', display: 'inline-block' }} />
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
