import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import '../styles/pages/report-problem.css';

function ReportProblemPage() {
  const siteOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const pageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Report a Problem - FFDB',
    url: `${siteOrigin}/report-problem`,
    description: 'Report any issues or problems you encounter on the Flora and Fauna Database of Bangladesh.',
  };

  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    species_id: '',
    email: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Build payload
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
      };

      if (formData.species_id.trim()) {
        payload.species_id = parseInt(formData.species_id, 10);
      }

      if (formData.email.trim()) {
        payload.email = formData.email.trim();
      }

      // Submit report
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to submit report');
      }

      // Success
      setSuccess(true);
      setFormData({
        title: '',
        description: '',
        species_id: '',
        email: '',
      });

      // Redirect to home after 2 seconds
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err) {
      console.error('[ReportProblem] Submit error:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-enter container" id="report-problem-page" style={{ paddingTop: '40px', paddingBottom: '80px' }}>
      <Helmet>
        <title>Report a Problem - FFDB</title>
        <meta name="description" content="Report any issues or problems you encounter on the Flora and Fauna Database of Bangladesh." />
        <meta property="og:title" content="Report a Problem - FFDB" />
        <meta property="og:description" content="Report any issues you encounter on the Flora and Fauna Database of Bangladesh." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${siteOrigin}/report-problem`} />
        <meta property="og:site_name" content="FFDB" />
        <meta property="og:image" content={`${siteOrigin}/og-fallback.png`} />
        <meta property="og:image:alt" content="Flora and Fauna Database of Bangladesh" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Report a Problem - FFDB" />
        <meta name="twitter:description" content="Report any issues you encounter on the Flora and Fauna Database of Bangladesh." />
        <link rel="canonical" href={`${siteOrigin}/report-problem`} />
        <script type="application/ld+json">{JSON.stringify(pageJsonLd)}</script>
      </Helmet>

      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '6px' }}>Report a Problem</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '15px', marginBottom: '24px', lineHeight: 1.6 }}>Help us improve the database by reporting any issues you encounter</p>

        <div className="report-form-wrapper">
          {success ? (
            <div className="success-message">
              <div className="success-icon">✓</div>
              <h2>Thank You!</h2>
              <p>We appreciate your feedback and will review your report shortly.</p>
              <p className="success-subtext">Redirecting to home...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="report-form">
              {error && <div className="error-message">{error}</div>}

              <div className="form-section">
                <h2 className="form-section-title">Report Details</h2>

                <div className="form-group">
                  <label htmlFor="title">Problem Title <span className="required">*</span></label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    placeholder="e.g., Image not loading, Incorrect information"
                    required
                    maxLength="255"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="description">Description <span className="required">*</span></label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Please describe the problem in detail. Include what you were doing and what went wrong."
                    required
                    rows="6"
                    maxLength="5000"
                  />
                  <small className="char-count">{formData.description.length}/5000</small>
                </div>
              </div>

              <div className="form-section">
                <h2 className="form-section-title">Additional Information</h2>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="species_id">Related Species <span className="optional">(optional)</span></label>
                    <input
                      type="number"
                      id="species_id"
                      name="species_id"
                      value={formData.species_id}
                      onChange={handleChange}
                      placeholder="e.g., 123"
                      min="1"
                    />
                    <small className="form-hint">Enter the Species ID if the problem is related to a specific species</small>
                  </div>

                  <div className="form-group">
                    <label htmlFor="email">Your Email <span className="optional">(optional)</span></label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="your.email@example.com"
                    />
                    <small className="form-hint">We may contact you if we need more details</small>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? 'Submitting...' : 'Submit Report'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default ReportProblemPage;
