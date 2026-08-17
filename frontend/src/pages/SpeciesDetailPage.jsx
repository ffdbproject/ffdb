// ============================================================
// FFDB - Flora and Fauna Database of Bangladesh
// Species Detail Page — Full species info with Leaflet map
// ============================================================

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
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
    'eol': 'EOL'
  };
  const name = displayNames[platform.toLowerCase()] || platform;

  // In public directory, the icons are named exactly as the platform keys (e.g. eol.png, gbif.png)
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

export default function SpeciesDetailPage() {
  const { id } = useParams();
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
  const [saving, setSaving] = useState(false);
  const [updateError, setUpdateError] = useState(null);
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

  const fallbackTitle = id ? `Species ${id}` : 'Species';
  const pageTitle = species
    ? `${species.english_name || species.bengali_name || species.scientific_name} - FFDB`
    : `${fallbackTitle} - FFDB`;
  const socialTitle = species
    ? (species.english_name || species.bengali_name || species.scientific_name)
    : fallbackTitle;

  const pageDescription = species
    ? (species.description ? stripDescriptionHtml(species.description).substring(0, 160) : `Detailed information about ${species.english_name || species.bengali_name || species.scientific_name} (${species.scientific_name}) in Bangladesh.`)
    : 'Loading species details from the Flora and Fauna Database of Bangladesh.';

  useEffect(() => {
    async function fetchSpecies() {
      setLoading(true);
      setError(null);
      try {
        const res = await speciesAPI.getById(id);
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
    const hasAdminSession = sessionStorage.getItem('ffdb_admin_authenticated') === '1';
    if (!hasAdminSession) {
      return;
    }

    let mounted = true;
    authAPI.checkAuth()
      .then(() => { if (mounted) setIsAdmin(true); })
      .catch(() => {
        if (mounted) setIsAdmin(false);
        sessionStorage.removeItem('ffdb_admin_authenticated');
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
          <meta property="og:title" content={socialTitle} />
          <meta property="og:description" content={pageDescription} />
          <meta name="twitter:title" content={socialTitle} />
          <meta name="twitter:description" content={pageDescription} />
        </Helmet>
        <div className="container empty-state" style={{ paddingTop: '80px' }}>
          <div className="empty-state-icon">Not Found</div>
          <h3>Species not found</h3>
          <p>{error || 'The species you are looking for does not exist.'}</p>
        </div>
      </>
    );
  }

  const siteOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  
  const displayName = species.english_name || species.bengali_name || species.scientific_name;
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
  const canonicalUrl = `${siteOrigin}/species/${(species && species.public_id) ? species.public_id : id}`;
  const pageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: species.english_name && species.bengali_name
      ? `${species.english_name} (${species.bengali_name})`
      : displayName,
    url: canonicalUrl,
    description: pageDescription,
    headline: species.english_name && species.bengali_name
      ? `${species.english_name} (${species.bengali_name})`
      : displayName,
  };
  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'FFDB',
    alternateName: 'Flora and Fauna Database of Bangladesh',
    url: siteOrigin,
    logo: `${siteOrigin}/logo.png`,
  };
  
  // Ensure absolute URL for og:image and twitter:image
  // Pass `species.scientific_name` so the image proxy can derive
  // a filename like `species-name-ffdb.<ext>` when served/saved.
  const resolvedImageUrl = primaryImage ? resolveAssetUrl(primaryImage.image_url, species?.scientific_name) : '';
  const absoluteImageUrl = resolvedImageUrl.startsWith('http') 
    ? resolvedImageUrl 
    : `${siteOrigin}${resolvedImageUrl}`;
  const socialImageUrl = absoluteImageUrl || fallbackImageUrl;

  
  
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
        {socialImageUrl && (
          <link rel="preload" as="image" href={socialImageUrl} />
        )}
        <script type="application/ld+json">{JSON.stringify(pageJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(organizationJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script>
      </Helmet>
      {/* Breadcrumb */}
      <div className="species-breadcrumb">
        <Link to="/" style={{ color: 'var(--accent-primary)' }}>Home</Link>
        {' / '}
        <Link to="/species" style={{ color: 'var(--accent-primary)' }}>Species</Link>
        {' / '}
        <span>{displayName}</span>
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
          <h1>{species.english_name || species.bengali_name || species.scientific_name}</h1>
          {species.bengali_name && (
            <p className="species-detail-bengali">{species.bengali_name}</p>
          )}
          <p className="species-detail-scientific">{species.scientific_name}</p>

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
                style={{ marginLeft: 8 }}
                title="Quick edit"
              >
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

          {species.conservation_status && (
            <div style={{ marginBottom: '16px' }}>
              <strong style={{
                fontSize: '12px',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                letterSpacing: '0.5px',
              }}>
                Conservation Status
              </strong>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={`conservation-badge ${statusClass}`}>{species.conservation_status}</span>
                {{
                  'EX': 'Extinct', 'EW': 'Extinct in the Wild', 'RE': 'Regionally Extinct',
                  'CR': 'Critically Endangered', 'EN': 'Endangered', 'VU': 'Vulnerable',
                  'NT': 'Near Threatened', 'LC': 'Least Concern', 'DD': 'Data Deficient', 'NE': 'Not Evaluated'
                }[species.conservation_status.toUpperCase()] || species.conservation_status}
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
                <td style={{ fontStyle: 'italic' }}>{species.scientific_name}</td>
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

      {/* Navigation and Related Species */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '32px', marginTop: '40px', paddingBottom: '60px' }}>
        
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
          <div className="section-header" style={{ marginTop: '40px' }}>
            <h2>References</h2>
          </div>
          <div 
            className="species-detail-description" 
            style={{ 
              fontSize: '14px', 
              lineHeight: 1.6, 
              color: 'var(--text-secondary)',
              background: 'var(--bg-card)',
              padding: '20px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border-color)',
              marginBottom: '32px',
              wordBreak: 'break-word',
              overflowWrap: 'break-word'
            }}
            dangerouslySetInnerHTML={{ 
              __html: species.references.includes('<a ') 
                ? species.references 
                : species.references.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:var(--accent-primary);text-decoration:underline;word-break:break-all;">$1</a>')
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

      {/* Inline Edit Modal (admin only) */}
      {isAdmin && showEditModal && editForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', overflowY: 'auto', padding: '20px' }}>
          <div style={{ width: '900px', maxWidth: '100%', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '24px' }}>
            <h2 style={{ marginBottom: 20 }}>Edit Species — {editForm.scientific_name}</h2>
            {updateError && (
              <div style={{ background: '#fee', border: '1px solid #fcc', color: '#c33', padding: '10px', borderRadius: '4px', marginBottom: '16px', fontSize: '14px' }}>
                Error: {updateError}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', maxHeight: '70vh', overflowY: 'auto', paddingRight: '8px' }}>
              <label>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Scientific Name *</div>
                <input type="text" value={editForm.scientific_name || ''} onChange={(e) => handleFormChange({ scientific_name: e.target.value })} style={{ width: '100%', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '4px' }} />
              </label>
              <label>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>English Name</div>
                <input type="text" value={editForm.english_name || ''} onChange={(e) => handleFormChange({ english_name: e.target.value })} style={{ width: '100%', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '4px' }} />
              </label>
              <label>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Bengali Name</div>
                <input type="text" value={editForm.bengali_name || ''} onChange={(e) => handleFormChange({ bengali_name: e.target.value })} style={{ width: '100%', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '4px' }} />
              </label>
              <label>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Category *</div>
                <select value={editForm.category || 'flora'} onChange={(e) => handleFormChange({ category: e.target.value })} style={{ width: '100%', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                  <option value="flora">Flora</option>
                  <option value="fauna">Fauna</option>
                </select>
              </label>
              <label>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Origin</div>
                <select value={editForm.origin || 'native'} onChange={(e) => handleFormChange({ origin: e.target.value })} style={{ width: '100%', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                  <option value="native">Native</option>
                  <option value="exotic">Exotic</option>
                </select>
              </label>
              <label>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Conservation Status</div>
                <select value={editForm.conservation_status || ''} onChange={(e) => handleFormChange({ conservation_status: e.target.value })} style={{ width: '100%', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                  <option value="">Not Assessed</option>
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
              </label>
              <label>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Residency Status</div>
                <select value={editForm.residency_status || 'resident'} onChange={(e) => handleFormChange({ residency_status: e.target.value })} style={{ width: '100%', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                  <option value="resident">Resident</option>
                  <option value="migratory">Migratory</option>
                  <option value="summer_visitor">Summer Visitor</option>
                  <option value="vagrant">Vagrant</option>
                </select>
              </label>
              <label>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Status</div>
                <select value={editForm.status || 'published'} onChange={(e) => handleFormChange({ status: e.target.value })} style={{ width: '100%', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                  <option value="draft">Draft</option>
                  <option value="pending_review">Pending Review</option>
                  <option value="published">Published</option>
                </select>
              </label>
              <label style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Description</div>
                <textarea value={editForm.description || ''} onChange={(e) => handleFormChange({ description: e.target.value })} rows={6} style={{ width: '100%', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '4px', fontFamily: 'inherit' }} />
              </label>
              <label style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Habitat</div>
                <textarea value={editForm.habitat || ''} onChange={(e) => handleFormChange({ habitat: e.target.value })} rows={4} style={{ width: '100%', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '4px', fontFamily: 'inherit' }} />
              </label>
              <label style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>References (HTML/Text)</div>
                <textarea value={editForm.references || ''} onChange={(e) => handleFormChange({ references: e.target.value })} rows={4} style={{ width: '100%', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '4px', fontFamily: 'inherit' }} />
              </label>
              
              <div style={{ gridColumn: '1 / -1', marginTop: '8px', marginBottom: '4px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>External Links</div>
              </div>
              <label>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Wikipedia URL</div>
                <input type="url" value={editForm.external_links?.wikipedia || ''} onChange={(e) => handleFormChange({ external_links: { ...editForm.external_links, wikipedia: e.target.value } })} style={{ width: '100%', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '4px' }} placeholder="https://wikipedia.org/wiki/..." />
              </label>
              <label>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>iNaturalist URL</div>
                <input type="url" value={editForm.external_links?.inaturalist || ''} onChange={(e) => handleFormChange({ external_links: { ...editForm.external_links, inaturalist: e.target.value } })} style={{ width: '100%', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '4px' }} placeholder="https://inaturalist.org/taxa/..." />
              </label>
              <label>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>IUCN Redlist URL</div>
                <input type="url" value={editForm.external_links?.iucn || ''} onChange={(e) => handleFormChange({ external_links: { ...editForm.external_links, iucn: e.target.value } })} style={{ width: '100%', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '4px' }} placeholder="https://iucnredlist.org/species/..." />
              </label>
              <label>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>GBIF URL</div>
                <input type="url" value={editForm.external_links?.gbif || ''} onChange={(e) => handleFormChange({ external_links: { ...editForm.external_links, gbif: e.target.value } })} style={{ width: '100%', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '4px' }} placeholder="https://gbif.org/species/..." />
              </label>
              <label>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>EOL URL</div>
                <input type="url" value={editForm.external_links?.eol || ''} onChange={(e) => handleFormChange({ external_links: { ...editForm.external_links, eol: e.target.value } })} style={{ width: '100%', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '4px' }} placeholder="https://eol.org/pages/..." />
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
              <button className="btn btn-secondary" onClick={() => { setShowEditModal(false); setUpdateError(null); }} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={async () => {
                try {
                  setSaving(true);
                  setUpdateError(null);
                  const payload = {
                    scientific_name: editForm.scientific_name,
                    english_name: editForm.english_name,
                    bengali_name: editForm.bengali_name,
                    category: editForm.category,
                    origin: editForm.origin,
                    conservation_status: editForm.conservation_status,
                    residency_status: editForm.residency_status,
                    status: editForm.status,
                    description: editForm.description,
                    habitat: editForm.habitat,
                    references: editForm.references,
                    external_links: editForm.external_links,
                  };
                  await speciesAPI.update(species.id, payload);
                  const refreshed = await speciesAPI.getById(species.id);
                  setSpecies(refreshed.data);
                  setEditForm(refreshed.data);
                  setUpdateError(null);
                  setShowEditModal(false);
                } catch (err) {
                  setUpdateError(err.message || 'Update failed. Please try again.');
                  console.error('Update error:', err);
                } finally {
                  setSaving(false);
                }
              }} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
