// ============================================================
// FFDB - Flora and Fauna Database of Bangladesh
// Contribute Page — Public Species Submission Form
//
// Visitors can submit species data through this form.
// Submissions are saved as "draft" status and must be reviewed
// by an admin before being published.
// ============================================================

import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { speciesAPI } from '../services/api';

const EMPTY_FORM = {
  scientific_name: '',
  english_name: '',
  bengali_name: '',
  category: 'flora',
  description: '',
  habitat: '',
  conservation_status: '',
  taxonomy: { kingdom: '', phylum: '', class: '', order: '', family: '', genus: '' },
};

export default function ContributePage() {
  const [formData, setFormData] = useState({ ...EMPTY_FORM, taxonomy: { ...EMPTY_FORM.taxonomy } });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };
  const updateTaxonomy = (field, value) => {
    setFormData((prev) => ({ ...prev, taxonomy: { ...prev.taxonomy, [field]: value } }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.scientific_name.trim()) {
      setError('Scientific name is required.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await speciesAPI.contribute(formData);
      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData({ ...EMPTY_FORM, taxonomy: { ...EMPTY_FORM.taxonomy } });
    setSubmitted(false);
    setError('');
  };

  // ---- Success state ----
  if (submitted) {
    return (
      <div className="page-enter container" id="contribute-page" style={{ paddingTop: '60px', paddingBottom: '80px' }}>
        <Helmet>
          <title>Contribution Received | FFDB</title>
          <meta name="robots" content="noindex" />
        </Helmet>
        <div style={{
          maxWidth: '520px',
          margin: '0 auto',
          textAlign: 'center',
          padding: '60px 30px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius)',
        }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '10px' }}>Thank You!</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.7, marginBottom: '28px' }}>
            Your species data has been submitted successfully. Our team will review it
            and publish it once verified.
          </p>
          <button className="btn btn-primary" onClick={handleReset}>Submit Another</button>
        </div>
      </div>
    );
  }

  // ---- Form ----
  return (
    <div className="page-enter container" id="contribute-page" style={{ paddingTop: '40px', paddingBottom: '80px' }}>
      <Helmet>
        <title>Contribute Data | FFDB</title>
        <meta name="description" content="Contribute new species data to the Flora and Fauna Database of Bangladesh. Submissions are reviewed by administrators before publishing." />
      </Helmet>
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '6px' }}>
          Contribute Data
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '15px', marginBottom: '8px', lineHeight: 1.6 }}>
          Help us grow the Flora and Fauna Database of Bangladesh by submitting species data.
          Your contribution will be reviewed by our team before publishing. If you want to volunteer directly with FFDB team, email us at <a href="mailto:ffdbproject@gmail.com">ffdbproject@gmail.com</a>.
        </p>

        {/* Info banner */}
        <div style={{
          background: 'var(--accent-subtle)',
          border: '1px solid rgba(13, 124, 102, 0.15)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 16px',
          fontSize: '13px',
          color: 'var(--accent-primary)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '8px',
          lineHeight: 1.5,
          marginBottom: '28px',
        }}>
          <span>All submissions enter as</span>
          <strong>Draft</strong>
          <span>and require admin review before publication.</span>
        </div>

        {/* Error display */}
        {error && (
          <div style={{
            background: 'rgba(220,53,69,0.08)',
            border: '1px solid rgba(220,53,69,0.2)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 16px',
            fontSize: '13px',
            color: '#dc3545',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            {error}
          </div>
        )}

        <form className="admin-form" onSubmit={handleSubmit} style={{ maxWidth: '100%' }}>
          {/* Scientific name */}
          <div className="form-group">
            <label htmlFor="contrib-scientific">Scientific Name *</label>
            <input
              id="contrib-scientific"
              className="form-control"
              value={formData.scientific_name}
              onChange={(e) => updateField('scientific_name', e.target.value)}
              placeholder="e.g. Panthera tigris"
              required
              style={{ fontStyle: 'italic' }}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="contrib-english">English Name</label>
              <input
                id="contrib-english"
                className="form-control"
                value={formData.english_name}
                onChange={(e) => updateField('english_name', e.target.value)}
                placeholder="e.g. Bengal Tiger"
              />
            </div>
            <div className="form-group">
              <label htmlFor="contrib-bengali">Bengali Name (বাংলা)</label>
              <input
                id="contrib-bengali"
                className="form-control"
                value={formData.bengali_name}
                onChange={(e) => updateField('bengali_name', e.target.value)}
                placeholder="e.g. বাঘ"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="contrib-category">Category *</label>
              <select
                id="contrib-category"
                className="form-control"
                value={formData.category}
                onChange={(e) => updateField('category', e.target.value)}
              >
                <option value="flora">Flora (Plant)</option>
                <option value="fauna">Fauna (Animal)</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="contrib-conservation">Conservation Status</label>
              <select
                id="contrib-conservation"
                className="form-control"
                value={formData.conservation_status}
                onChange={(e) => updateField('conservation_status', e.target.value)}
              >
                <option value="">Not Sure / Unknown</option>
                <option value="LC">LC — Least Concern</option>
                <option value="NT">NT — Near Threatened</option>
                <option value="VU">VU — Vulnerable</option>
                <option value="EN">EN — Endangered</option>
                <option value="CR">CR — Critically Endangered</option>
                <option value="EW">EW — Extinct in the Wild</option>
                <option value="EX">EX — Extinct</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="contrib-description">Description</label>
            <textarea
              id="contrib-description"
              className="form-control"
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Describe the species, its characteristics, and significance..."
            />
          </div>

          <div className="form-group">
            <label htmlFor="contrib-habitat">Habitat</label>
            <input
              id="contrib-habitat"
              className="form-control"
              value={formData.habitat}
              onChange={(e) => updateField('habitat', e.target.value)}
              placeholder="e.g. Mangrove forests, wetlands, Sundarbans"
            />
          </div>

          {/* Taxonomy (collapsible) */}
          <details style={{ marginTop: '8px', marginBottom: '20px' }}>
            <summary style={{
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '14px',
              color: 'var(--text-primary)',
              padding: '10px 0',
              borderTop: '1px solid var(--border-color)',
            }}>
              Taxonomy (optional — fill what you know)
            </summary>
            <div style={{ paddingTop: '12px' }}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="contrib-kingdom">Kingdom</label>
                  <input id="contrib-kingdom" className="form-control" value={formData.taxonomy.kingdom} onChange={(e) => updateTaxonomy('kingdom', e.target.value)} placeholder="e.g. Animalia" />
                </div>
                <div className="form-group">
                  <label htmlFor="contrib-phylum">Phylum</label>
                  <input id="contrib-phylum" className="form-control" value={formData.taxonomy.phylum} onChange={(e) => updateTaxonomy('phylum', e.target.value)} placeholder="e.g. Chordata" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="contrib-class">Class</label>
                  <input id="contrib-class" className="form-control" value={formData.taxonomy.class} onChange={(e) => updateTaxonomy('class', e.target.value)} placeholder="e.g. Mammalia" />
                </div>
                <div className="form-group">
                  <label htmlFor="contrib-order">Order</label>
                  <input id="contrib-order" className="form-control" value={formData.taxonomy.order} onChange={(e) => updateTaxonomy('order', e.target.value)} placeholder="e.g. Carnivora" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="contrib-family">Family</label>
                  <input id="contrib-family" className="form-control" value={formData.taxonomy.family} onChange={(e) => updateTaxonomy('family', e.target.value)} placeholder="e.g. Felidae" />
                </div>
                <div className="form-group">
                  <label htmlFor="contrib-genus">Genus</label>
                  <input id="contrib-genus" className="form-control" value={formData.taxonomy.genus} onChange={(e) => updateTaxonomy('genus', e.target.value)} placeholder="e.g. Panthera" />
                </div>
              </div>
            </div>
          </details>

          {/* Submit */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
            <button type="button" className="btn btn-secondary" onClick={handleReset}>
              Clear Form
            </button>
            <button type="submit" className="btn btn-primary" id="btn-submit-contribution" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit for Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
