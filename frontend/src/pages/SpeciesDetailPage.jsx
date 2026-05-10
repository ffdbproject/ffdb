// ============================================================
// FFDB - Flora and Fauna Database of Bangladesh
// Species Detail Page — Full species info with Leaflet map
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { speciesAPI, resolveAssetUrl, authAPI } from '../services/api';
import SafeImage from '../components/SafeImage';

// Leaflet imports
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

export default function SpeciesDetailPage() {
  const { id } = useParams();
  const [species, setSpecies] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [updateError, setUpdateError] = useState(null);
  const updateTimeoutRef = useRef(null);

  // Debounce form input changes to prevent mobile keyboard interference
  const handleFormChange = useCallback((updates) => {
    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    setEditForm(prev => ({
      ...prev,
      ...updates
    }));
  }, []);

  const fallbackTitle = id ? `Species ${id}` : 'Species';
  const pageTitle = species
    ? `${species.english_name || species.bengali_name || species.scientific_name} | FFDB`
    : `${fallbackTitle} | FFDB`;
  const socialTitle = species
    ? (species.english_name || species.bengali_name || species.scientific_name)
    : fallbackTitle;

  const pageDescription = species
    ? (species.description ? species.description.substring(0, 160) : `Detailed information about ${species.english_name || species.bengali_name || species.scientific_name} (${species.scientific_name}) in Bangladesh.`)
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

    // Cleanup timeout on unmount
    return () => {
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    };
  }, [id]);

  // Check admin auth once on mount
  useEffect(() => {
    let mounted = true;
    authAPI.checkAuth()
      .then(() => { if (mounted) setIsAdmin(true); })
      .catch(() => { if (mounted) setIsAdmin(false); });
    return () => { mounted = false; };
  }, []);

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
          <Link to="/species" className="btn btn-primary" style={{ marginTop: '16px' }}>
            Back to Browse
          </Link>
        </div>
      </>
    );
  }

  const siteOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  
  const displayName = species.english_name || species.bengali_name || species.scientific_name;
  const statusClass = (species.conservation_status || '').toLowerCase();
  const taxonomy = species.taxonomy || {};
  const coords = species.location_coordinates || [];
  const images = species.images || [];
  const primaryImage = images.length > 0 ? images[activeImageIdx] || images[0] : null;
  const fallbackImageUrl = `${siteOrigin}/og-fallback.png`;

  // Calculate map center from coordinates
  const mapCenter = coords.length > 0
    ? [coords[0].lat, coords[0].lng]
    : [23.685, 90.3563]; // Default: center of Bangladesh
  const mapZoom = coords.length === 1 ? 10 : coords.length > 1 ? 7 : 7;
  const canonicalUrl = `${siteOrigin}/species/${id}`;
  
  // Ensure absolute URL for og:image and twitter:image
  const resolvedImageUrl = primaryImage ? resolveAssetUrl(primaryImage.image_url) : '';
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
    "identifier": String(id),
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

  return (
    <div className="page-enter container species-detail" id="species-detail-page">
      <Helmet>
        <html lang="en" />
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
              alt={displayName}
              style={{ width: '100%', display: 'block' }}
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
              flexWrap: 'wrap',
            }}>
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setActiveImageIdx(i)}
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
                  }}
                >
                  <SafeImage
                    src={img.image_url}
                    alt=""
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
            <p className="species-detail-description">{species.description}</p>
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
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '12px',
            marginBottom: '40px',
          }}>
            {images.map((img, i) => (
              <div
                key={img.id}
                onClick={() => {
                  setActiveImageIdx(i);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
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
                  alt={`${displayName} ${i + 1}`}
                  style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }}
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
        </>
      )}

      {/* Back button */}
      <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
        <Link to="/species" className="btn btn-secondary">
          Back to Browse
        </Link>
      </div>

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
                <input type="text" placeholder="e.g., LC, NT, VU, EN, CR, EW, EX" value={editForm.conservation_status || ''} onChange={(e) => handleFormChange({ conservation_status: e.target.value })} style={{ width: '100%', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '4px' }} />
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
                    status: editForm.status,
                    description: editForm.description,
                    habitat: editForm.habitat,
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
