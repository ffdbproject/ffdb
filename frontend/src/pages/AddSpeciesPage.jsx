import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { speciesAPI } from '../services/api';
import { preloadRoute } from '../utils/routePreload';

const EMPTY_FORM = {
  scientific_name: '',
  english_name: '',
  bengali_name: '',
  category: 'flora',
  origin: 'native',
  conservation_status: '',
  residency_status: 'resident',
  description: '',
  habitat: '',
  references: '',
  external_links: {},
  featured_image_url: '',
  featured_image_credit: '',
  additional_image_urls: '',
  additional_image_credits: '',
  location_coordinates: [],
  status: 'draft',
  taxonomy: {
    kingdom: '',
    phylum: '',
    class: '',
    order: '',
    family: '',
    genus: '',
  },
};

export default function AddSpeciesPage() {
  const navigate = useNavigate();
  const prefetchAdmin = () => preloadRoute('/admin');
  const [activeTab, setActiveTab] = useState('form'); // 'form' or 'json'
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [jsonInput, setJsonInput] = useState('');
  const [pendingImages, setPendingImages] = useState({ featured: null, additional: [] });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [coordsText, setCoordsText] = useState('');

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateTaxonomy = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      taxonomy: { ...prev.taxonomy, [field]: value },
    }));
  };

  const updateCoords = (text) => {
    setCoordsText(text);
    if (!text.trim()) {
      updateField('location_coordinates', []);
      return;
    }
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) updateField('location_coordinates', parsed);
    } catch { /* ignore parse errors while typing */ }
  };

  const handleFeaturedFileChange = (e) => {
    const file = e.target.files[0];
    setPendingImages((prev) => ({
      ...prev,
      featured: file || null,
    }));
  };

  const handleAdditionalFilesChange = (e) => {
    const files = Array.from(e.target.files || []);
    setPendingImages((prev) => ({
      ...prev,
      additional: files,
    }));
  };

  // Parse JSON and auto-populate form
  const handleJsonImport = () => {
    if (!jsonInput.trim()) {
      showToast('Paste JSON data to import', 'error');
      return;
    }

    try {
      const data = JSON.parse(jsonInput);

      // Map JSON fields to form structure
      setFormData((prev) => ({
        ...prev,
        scientific_name: data.scientific_name || prev.scientific_name,
        english_name: data.english_name || prev.english_name,
        bengali_name: data.bengali_name || prev.bengali_name,
        category: data.category || prev.category,
        origin: data.origin || prev.origin,
        conservation_status: data.conservation_status || prev.conservation_status,
        residency_status: data.residency_status || prev.residency_status,
        description: data.description || prev.description,
        habitat: data.habitat || prev.habitat,
        references: data.references || prev.references,
        external_links: data.external_links || prev.external_links,
        featured_image_url: data.featured_image_url || prev.featured_image_url,
        featured_image_credit: data.featured_image_credit || prev.featured_image_credit,
        additional_image_urls: data.additional_image_urls || prev.additional_image_urls,
        additional_image_credits: data.additional_image_credits || prev.additional_image_credits,
        status: data.status || 'draft',
        taxonomy: {
          kingdom: data.taxonomy?.kingdom || prev.taxonomy.kingdom,
          phylum: data.taxonomy?.phylum || prev.taxonomy.phylum,
          class: data.taxonomy?.class || prev.taxonomy.class,
          order: data.taxonomy?.order || prev.taxonomy.order,
          family: data.taxonomy?.family || prev.taxonomy.family,
          genus: data.taxonomy?.genus || prev.taxonomy.genus,
        },
        location_coordinates: data.location_coordinates || prev.location_coordinates,
      }));

      if (data.location_coordinates) {
        setCoordsText(JSON.stringify(data.location_coordinates, null, 2));
      }

      showToast('JSON imported! Review and edit form fields above.', 'success');
      setActiveTab('form');
      setJsonInput('');
    } catch (err) {
      showToast(`Invalid JSON: ${err.message}`, 'error');
    }
  };

  const handleSave = async () => {
    if (!formData.scientific_name.trim()) {
      showToast('Scientific name is required', 'error');
      return;
    }

    setSaving(true);
    try {
      const featuredImageUrl = (formData.featured_image_url || '').trim();
      const featuredImageCredit = (formData.featured_image_credit || '').trim();
      const additionalImageUrls = (formData.additional_image_urls || '')
        .split(/\r?\n|,/) 
        .map((url) => url.trim())
        .filter(Boolean);
      const additionalImageCredits = (formData.additional_image_credits || '')
        .split(/\r?\n/)
        .map((credit) => credit.trim());

      const images = [...new Set([
        ...(featuredImageUrl ? [featuredImageUrl] : []),
        ...additionalImageUrls,
      ])].map((imageUrl, idx) => ({
        image_url: imageUrl,
        image_credit: idx === 0
          ? (featuredImageCredit || null)
          : (additionalImageCredits[idx - 1] || null),
        is_primary: idx === 0,
      }));

      // Create species
      const payload = {
        scientific_name: formData.scientific_name,
        english_name: formData.english_name,
        bengali_name: formData.bengali_name,
        category: formData.category,
        origin: formData.origin,
        conservation_status: formData.conservation_status,
        residency_status: formData.residency_status,
        description: formData.description,
        habitat: formData.habitat,
        references: formData.references,
        external_links: formData.external_links,
        location_coordinates: formData.location_coordinates,
        status: formData.status,
        taxonomy: formData.taxonomy,
        images,
      };
      const res = await speciesAPI.create(payload);
      const speciesId = res.data?.id;

      // Upload pending image files one-by-one via the existing single-file endpoint
      if (speciesId && (pendingImages.featured || pendingImages.additional.length > 0)) {
        const token = localStorage.getItem('ffdb_admin_token') || sessionStorage.getItem('ffdb_admin_token');
        const uploadHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};

        // Upload featured image first (marked as primary)
        if (pendingImages.featured) {
          try {
            const fd = new FormData();
            fd.append('image', pendingImages.featured);
            fd.append('is_primary', 'true');
            fd.append('image_credit', formData.featured_image_credit || '');
            await fetch(`/api/species/${speciesId}/upload`, {
              method: 'POST',
              headers: uploadHeaders,
              body: fd,
            });
          } catch (imgErr) {
            console.error('Featured image upload error:', imgErr);
          }
        }

        // Upload additional images
        for (const file of pendingImages.additional) {
          try {
            const fd = new FormData();
            fd.append('image', file);
            fd.append('is_primary', 'false');
            await fetch(`/api/species/${speciesId}/upload`, {
              method: 'POST',
              headers: uploadHeaders,
              body: fd,
            });
          } catch (imgErr) {
            console.error('Additional image upload error:', imgErr);
          }
        }
      }

      showToast(`"${formData.scientific_name}" created successfully!`, 'success');
      setTimeout(() => {
        navigate('/admin?tab=species');
      }, 500);
    } catch (err) {
      showToast(err.message || 'Failed to create species', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-enter admin-shell" id="admin-page">
      <Helmet>
        <title>Add New Species - FFDB Admin</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta property="og:site_name" content="FFDB" />
      </Helmet>

      {/* ---- Admin Topbar ---- */}
      <div className="admin-topbar-shell" style={{
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border-color)',
        padding: '0 32px',
        position: 'relative',
        zIndex: 900,
      }}>
        <div className="container admin-topbar-inner" style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '56px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 800, marginRight: '28px', letterSpacing: '-0.3px' }}>
            <span style={{ color: 'var(--accent-primary)' }}>FFDB</span> Admin
          </h1>
          {[
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'species', label: 'Manage Species' },
            { id: 'reports', label: 'Reports' },
            { id: 'team', label: 'Team' },
            { id: 'gbif', label: 'Import from GBIF' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => navigate(`/admin${t.id !== 'dashboard' ? `?tab=${t.id}` : ''}`)}
              onMouseEnter={prefetchAdmin}
              onFocus={prefetchAdmin}
              onTouchStart={prefetchAdmin}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 500,
                background: 'transparent',
                color: 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
                transition: 'var(--transition-fast)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ---- Main Content ---- */}
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 20px' }}>
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: '28px',
            right: '28px',
            padding: '14px 24px',
            background: toast.type === 'error' ? '#dc3545' : 'var(--accent-primary)',
            color: 'white',
            borderRadius: 'var(--radius-sm)',
            fontSize: '14px',
            fontWeight: 600,
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            zIndex: 3000,
            animation: 'fadeInUp 0.3s ease',
          }}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>Add New Species</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          Create a new species entry. Use the form or paste JSON data to quickly populate fields.
        </p>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '28px',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <button
          onClick={() => setActiveTab('form')}
          style={{
            padding: '12px 20px',
            border: 'none',
            background: activeTab === 'form' ? 'transparent' : 'transparent',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
            color: activeTab === 'form' ? 'var(--accent-primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'form' ? '3px solid var(--accent-primary)' : '3px solid transparent',
            transition: 'all 0.2s ease',
          }}
        >
          Form
        </button>
        <button
          onClick={() => setActiveTab('json')}
          style={{
            padding: '12px 20px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
            color: activeTab === 'json' ? 'var(--accent-primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'json' ? '3px solid var(--accent-primary)' : '3px solid transparent',
            transition: 'all 0.2s ease',
          }}
        >
          JSON Import
        </button>
      </div>

      {/* Form Tab */}
      {activeTab === 'form' && (
        <div className="admin-form">
          {/* Core fields */}
          <div className="form-group">
            <label htmlFor="form-scientific-name">Scientific Name *</label>
            <input
              id="form-scientific-name"
              className="form-control"
              value={formData.scientific_name}
              onChange={(e) => updateField('scientific_name', e.target.value)}
              placeholder="e.g. Panthera tigris"
              style={{ fontStyle: 'italic' }}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="form-english-name">English Name</label>
              <input
                id="form-english-name"
                className="form-control"
                value={formData.english_name}
                onChange={(e) => updateField('english_name', e.target.value)}
                placeholder="e.g. Bengal Tiger"
              />
            </div>
            <div className="form-group">
              <label htmlFor="form-bengali-name">Bengali Name (বাংলা)</label>
              <input
                id="form-bengali-name"
                className="form-control"
                value={formData.bengali_name}
                onChange={(e) => updateField('bengali_name', e.target.value)}
                placeholder="e.g. বাঘ"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="form-category">Category *</label>
              <select
                id="form-category"
                className="form-control"
                value={formData.category}
                onChange={(e) => updateField('category', e.target.value)}
              >
                <option value="flora">Flora (Plant)</option>
                <option value="fauna">Fauna (Animal)</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="form-origin">Origin</label>
              <select
                id="form-origin"
                className="form-control"
                value={formData.origin || 'native'}
                onChange={(e) => updateField('origin', e.target.value)}
              >
                <option value="native">Native to Bangladesh</option>
                <option value="exotic">Exotic (Non-native)</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="form-conservation">Conservation Status</label>
              <select
                id="form-conservation"
                className="form-control"
                value={formData.conservation_status}
                onChange={(e) => updateField('conservation_status', e.target.value)}
              >
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
            </div>
            <div className="form-group">
              <label htmlFor="form-residency">Residency Status</label>
              <select
                id="form-residency"
                className="form-control"
                value={formData.residency_status}
                onChange={(e) => updateField('residency_status', e.target.value)}
              >
                <option value="resident">Resident</option>
                <option value="migratory">Migratory</option>
                <option value="summer_visitor">Summer Visitor</option>
                <option value="vagrant">Vagrant</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="form-description">Description</label>
            <textarea
              id="form-description"
              className="form-control"
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="A brief description of the species..."
            />
          </div>

          <div className="form-group">
            <label htmlFor="form-habitat">Habitat</label>
            <input
              id="form-habitat"
              className="form-control"
              value={formData.habitat}
              onChange={(e) => updateField('habitat', e.target.value)}
              placeholder="e.g. Mangrove forests, Sundarbans"
            />
          </div>

          <div className="form-group">
            <label htmlFor="form-references">References (HTML/Text)</label>
            <textarea
              id="form-references"
              className="form-control"
              value={formData.references}
              onChange={(e) => updateField('references', e.target.value)}
              placeholder="Source links, research papers, etc."
              rows={4}
            />
          </div>

          <div className="form-group" style={{ border: '1px solid var(--border-color)', padding: '16px', borderRadius: 'var(--radius)', background: 'var(--bg-secondary)' }}>
            <h3 style={{ fontSize: '14px', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>External Links</h3>
            <div className="form-row" style={{ marginBottom: '12px' }}>
              <div style={{ flex: 1 }}>
                <label>Wikipedia URL</label>
                <input type="url" className="form-control" value={formData.external_links?.wikipedia || ''} onChange={(e) => updateField('external_links', { ...formData.external_links, wikipedia: e.target.value })} placeholder="https://wikipedia.org/wiki/..." />
              </div>
              <div style={{ flex: 1 }}>
                <label>iNaturalist URL</label>
                <input type="url" className="form-control" value={formData.external_links?.inaturalist || ''} onChange={(e) => updateField('external_links', { ...formData.external_links, inaturalist: e.target.value })} placeholder="https://inaturalist.org/taxa/..." />
              </div>
            </div>
            <div className="form-row">
              <div style={{ flex: 1 }}>
                <label>IUCN Redlist URL</label>
                <input type="url" className="form-control" value={formData.external_links?.iucn || ''} onChange={(e) => updateField('external_links', { ...formData.external_links, iucn: e.target.value })} placeholder="https://iucnredlist.org/species/..." />
              </div>
              <div style={{ flex: 1 }}>
                <label>GBIF URL</label>
                <input type="url" className="form-control" value={formData.external_links?.gbif || ''} onChange={(e) => updateField('external_links', { ...formData.external_links, gbif: e.target.value })} placeholder="https://gbif.org/species/..." />
              </div>
              <div style={{ flex: 1 }}>
                <label>EOL URL</label>
                <input type="url" className="form-control" value={formData.external_links?.eol || ''} onChange={(e) => updateField('external_links', { ...formData.external_links, eol: e.target.value })} placeholder="https://eol.org/pages/..." />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="form-featured-image">Featured Image URL</label>
            <input
              id="form-featured-image"
              className="form-control"
              value={formData.featured_image_url || ''}
              onChange={(e) => updateField('featured_image_url', e.target.value)}
              placeholder="https://example.com/featured-image.jpg"
            />
            <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
              You can use a URL or upload a file below.
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="form-featured-image-credit">Featured Image Credit</label>
            <input
              id="form-featured-image-credit"
              className="form-control"
              value={formData.featured_image_credit || ''}
              onChange={(e) => updateField('featured_image_credit', e.target.value)}
              placeholder="e.g. © John Doe, Photo by Jane Smith"
            />
            <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
              Shown on the public species page under the main image.
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="form-additional-images">Additional Image URLs (one per line)</label>
            <textarea
              id="form-additional-images"
              className="form-control"
              value={formData.additional_image_urls || ''}
              onChange={(e) => updateField('additional_image_urls', e.target.value)}
              placeholder="https://example.com/image-2.jpg&#10;https://example.com/image-3.jpg"
            />
            <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
              One URL per line. These become optional gallery images.
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="form-additional-image-credits">Additional Image Credits (one per line)</label>
            <textarea
              id="form-additional-image-credits"
              className="form-control"
              value={formData.additional_image_credits || ''}
              onChange={(e) => updateField('additional_image_credits', e.target.value)}
              placeholder="© Photographer Name&#10;Image via GBIF"
            />
            <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
              Match each line to the corresponding additional image URL above. Leave a line blank if there is no credit.
            </small>
          </div>

          <div className="form-row">
            <div className="form-group" style={{ marginTop: '12px' }}>
              <label>Featured Image File</label>
              <input type="file" className="form-control" accept="image/*" onChange={handleFeaturedFileChange} />
              <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                {pendingImages.featured
                  ? `Selected: ${pendingImages.featured.name}`
                  : 'Optional. Uploaded after you save this species.'}
              </small>
            </div>

            <div className="form-group" style={{ marginTop: '12px' }}>
              <label>Additional Image Files</label>
              <input type="file" className="form-control" accept="image/*" multiple onChange={handleAdditionalFilesChange} />
              <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                {pendingImages.additional.length > 0
                  ? `${pendingImages.additional.length} file(s) selected`
                  : 'Optional gallery images. You can select multiple files.'}
              </small>
            </div>
          </div>

          {/* Taxonomy section */}
          <div
            style={{
              borderTop: '1px solid var(--border-color)',
              paddingTop: '20px',
              marginTop: '8px',
              marginBottom: '20px',
            }}
          >
            <label
              style={{
                display: 'block',
                fontWeight: 700,
                fontSize: '14px',
                marginBottom: '16px',
                color: 'var(--text-primary)',
              }}
            >
              Taxonomy
            </label>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="form-kingdom">Kingdom</label>
                <input
                  id="form-kingdom"
                  className="form-control"
                  value={formData.taxonomy.kingdom}
                  onChange={(e) => updateTaxonomy('kingdom', e.target.value)}
                  placeholder="e.g. Animalia"
                />
              </div>
              <div className="form-group">
                <label htmlFor="form-phylum">Phylum</label>
                <input
                  id="form-phylum"
                  className="form-control"
                  value={formData.taxonomy.phylum}
                  onChange={(e) => updateTaxonomy('phylum', e.target.value)}
                  placeholder="e.g. Chordata"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="form-class">Class</label>
                <input
                  id="form-class"
                  className="form-control"
                  value={formData.taxonomy.class}
                  onChange={(e) => updateTaxonomy('class', e.target.value)}
                  placeholder="e.g. Mammalia"
                />
              </div>
              <div className="form-group">
                <label htmlFor="form-order">Order</label>
                <input
                  id="form-order"
                  className="form-control"
                  value={formData.taxonomy.order}
                  onChange={(e) => updateTaxonomy('order', e.target.value)}
                  placeholder="e.g. Carnivora"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="form-family">Family</label>
                <input
                  id="form-family"
                  className="form-control"
                  value={formData.taxonomy.family}
                  onChange={(e) => updateTaxonomy('family', e.target.value)}
                  placeholder="e.g. Felidae"
                />
              </div>
              <div className="form-group">
                <label htmlFor="form-genus">Genus</label>
                <input
                  id="form-genus"
                  className="form-control"
                  value={formData.taxonomy.genus}
                  onChange={(e) => updateTaxonomy('genus', e.target.value)}
                  placeholder="e.g. Panthera"
                />
              </div>
            </div>
          </div>

          {/* Location coordinates (JSON) */}
          <div className="form-group">
            <label htmlFor="form-coords">Location Coordinates (JSON)</label>
            <textarea
              id="form-coords"
              className="form-control"
              value={coordsText}
              onChange={(e) => updateCoords(e.target.value)}
              placeholder={`[{"lat": 21.9497, "lng": 89.1833, "label": "Sundarbans"}]`}
              style={{ fontFamily: 'monospace', fontSize: '12px', minHeight: '80px' }}
            />
            <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
              Array of {'{lat, lng, label}'} objects for Leaflet map markers.
            </small>
          </div>

          {/* Status */}
          <div className="form-group">
            <label htmlFor="form-status">Status</label>
            <select
              id="form-status"
              className="form-control"
              value={formData.status}
              onChange={(e) => updateField('status', e.target.value)}
            >
              <option value="draft">Draft</option>
              <option value="pending_review">Pending Review</option>
              <option value="published">Published</option>
            </select>
          </div>

          <small style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginTop: '-4px' }}>
            Tip: only Published species appear on the public site.
          </small>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
            <button className="btn btn-secondary" onClick={() => navigate('/admin?tab=species')}>
              Cancel
            </button>
            <button className="btn btn-primary" id="btn-save-species" onClick={handleSave} disabled={saving}>
              {saving ? 'Creating...' : 'Create Species'}
            </button>
          </div>
        </div>
      )}

      {/* JSON Import Tab */}
      {activeTab === 'json' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>Paste JSON Data</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '16px' }}>
              Paste a complete JSON object with species data. All fields will auto-populate in the form above.
            </p>

            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder="Paste JSON data here..."
              style={{
                width: '100%',
                minHeight: '300px',
                padding: '12px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontFamily: 'monospace',
                fontSize: '12px',
                fontWeight: 400,
                resize: 'vertical',
                marginBottom: '20px',
              }}
            />

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginBottom: '20px', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600, margin: 0 }}>
                  Full JSON Structure Example:
                </p>
                <button
                  onClick={() => {
                    const exampleJson = JSON.stringify(
                      {
                        scientific_name: 'Panthera tigris',
                        english_name: 'Bengal Tiger',
                        bengali_name: 'বাঘ',
                        category: 'fauna',
                        origin: 'native',
                        conservation_status: 'EN',
                        residency_status: 'resident',
                        description: 'The Bengal tiger is a tiger population in the Indian subcontinent.',
                        habitat: 'Sundarbans mangrove forests, deciduous forests',
                        references: '<p>Some reference</p>',
                        featured_image_url: 'https://example.com/tiger-featured.jpg',
                        featured_image_credit: '© John Doe, Wildlife Photographer',
                        additional_image_urls: 'https://example.com/tiger-2.jpg\nhttps://example.com/tiger-3.jpg',
                        additional_image_credits: '© Jane Smith, GBIF\n© Wildlife Agency',
                        location_coordinates: [
                          { lat: 21.9497, lng: 89.1833, label: 'Sundarbans' },
                          { lat: 26.5124, lng: 88.8126, label: 'Bengal Tiger Reserve' },
                        ],
                        status: 'draft',
                        taxonomy: {
                          kingdom: 'Animalia',
                          phylum: 'Chordata',
                          class: 'Mammalia',
                          order: 'Carnivora',
                          family: 'Felidae',
                          genus: 'Panthera',
                        },
                      },
                      null,
                      2
                    );
                    navigator.clipboard.writeText(exampleJson);
                    showToast('Example JSON copied to clipboard!', 'success');
                  }}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    background: 'var(--accent-primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => e.target.style.opacity = '0.9'}
                  onMouseLeave={(e) => e.target.style.opacity = '1'}
                >
                  Copy
                </button>
              </div>
              <pre
                style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '12px',
                  overflow: 'auto',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  lineHeight: 1.5,
                  maxHeight: '400px',
                  margin: 0,
                }}
              >
                {JSON.stringify(
                  {
                    scientific_name: 'Panthera tigris',
                    english_name: 'Bengal Tiger',
                    bengali_name: 'বাঘ',
                    category: 'fauna',
                    origin: 'native',
                    conservation_status: 'EN',
                    residency_status: 'resident',
                    description: 'The Bengal tiger is a tiger population in the Indian subcontinent.',
                    habitat: 'Sundarbans mangrove forests, deciduous forests',
                    references: '<p>Some reference</p>',
                    featured_image_url: 'https://example.com/tiger-featured.jpg',
                    featured_image_credit: '© John Doe, Wildlife Photographer',
                    additional_image_urls: 'https://example.com/tiger-2.jpg\nhttps://example.com/tiger-3.jpg',
                    additional_image_credits: '© Jane Smith, GBIF\n© Wildlife Agency',
                    location_coordinates: [
                      { lat: 21.9497, lng: 89.1833, label: 'Sundarbans' },
                      { lat: 26.5124, lng: 88.8126, label: 'Bengal Tiger Reserve' },
                    ],
                    status: 'draft',
                    taxonomy: {
                      kingdom: 'Animalia',
                      phylum: 'Chordata',
                      class: 'Mammalia',
                      order: 'Carnivora',
                      family: 'Felidae',
                      genus: 'Panthera',
                    },
                  },
                  null,
                  2
                )}
              </pre>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                onClick={handleJsonImport}
                style={{ flex: '1 1 auto', minWidth: '200px' }}
              >
                Import & Auto-Fill Form
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setJsonInput('')}
                style={{ flex: '1 1 auto', minWidth: '100px' }}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
