import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { authAPI } from '../services/api';
import '../styles/pages/admin-pages.css';

export default function AdminLoginPage() {
  const [apiKey, setApiKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!apiKey.trim()) return setError('API key is required to log in.');
    setLoading(true);
    try {
      await authAPI.login(apiKey.trim());
      // On success, navigate to admin dashboard. Server sets HttpOnly cookie.
      navigate('/admin');
    } catch (err) {
      setError(err.message || 'Login failed. Please check your API key.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-page-container">
      <Helmet>
        <title>Admin Authentication - FFDB</title>
      </Helmet>

      <div className="admin-card-wrapper">
        <div className="admin-card">
          <div className="admin-card-header">
            <div className="admin-logo-badge">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </div>
            <h1 className="admin-card-title">Admin Portal Login</h1>
            <p className="admin-card-subtitle">
              Enter your admin or contributor API key to access the dashboard.
            </p>
          </div>

          <form onSubmit={submit}>
            {error && (
              <div className="admin-error-banner">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>{error}</span>
              </div>
            )}

            <div className="admin-form-group">
              <label className="admin-label">Admin API Key</label>
              <div className="admin-input-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  className="admin-input"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Paste or type API key..."
                  autoFocus
                />
                <button
                  type="button"
                  className="admin-input-icon-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? "Hide key" : "Show key"}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="admin-actions-bar" style={{ marginTop: 24 }}>
              <button
                type="button"
                className="back-link-btn"
                onClick={() => navigate('/')}
              >
                ← Back to Home
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ padding: '10px 24px', fontWeight: 600 }}
                disabled={loading}
              >
                {loading ? 'Authenticating...' : 'Sign In'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
