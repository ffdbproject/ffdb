import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import '../styles/pages/report-problem.css';

function ReportProblemPage() {
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
    <>
      <Helmet>
        <title>Report a Problem - FFDB</title>
        <meta name="description" content="Report any issues or problems you encounter on the Flora and Fauna Database of Bangladesh." />
      </Helmet>

      <div className="report-problem-container">
        <div className="report-problem-card">
          <h1>Report a Problem</h1>
          <p className="report-subtitle">
            Help us improve the database by reporting any issues you encounter.
          </p>

          {success ? (
            <div className="success-message">
              <p>✓ Thank you for reporting the problem!</p>
              <p className="success-subtext">We will review it shortly and take action.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="report-form">
              {error && <div className="error-message">{error}</div>}

              <div className="form-group">
                <label htmlFor="title">Problem Title *</label>
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
                <label htmlFor="description">Description *</label>
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

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="species_id">Related Species (optional)</label>
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
                  <label htmlFor="email">Your Email (optional)</label>
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
    </>
  );
}

export default ReportProblemPage;
