import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { databaseAPI } from '../services/api';
import LoadingSpinner from './_SharedLoading';
import '../styles/pages/admin-pages.css';

export default function ExportDatabasePage() {
  const [format, setFormat] = useState('json');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      if (format === 'json') {
        const res = await databaseAPI.export();
        const jsonStr = JSON.stringify(res.data || res, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `ffdb-export-${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a); a.click(); a.remove();
        showToast('JSON export downloaded successfully');
      } else {
        const blob = await databaseAPI.downloadExport(format);
        const ext = format === 'csv' ? 'csv' : 'xlsx';
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `ffdb-export-${new Date().toISOString().slice(0,10)}.${ext}`;
        document.body.appendChild(a); a.click(); a.remove();
        showToast(`${ext.toUpperCase()} export downloaded successfully`);
      }
    } catch (err) {
      console.error(err);
      showToast('Database export failed. Please check permissions.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-enter admin-shell" style={{ padding: '36px 20px', minHeight: '85vh' }}>
      <Helmet>
        <title>Export Database - FFDB Admin</title>
      </Helmet>

      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {toast && <div className={`toast ${toast.type}`} style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999 }}>{toast.message}</div>}

        <div className="admin-card">
          <div className="admin-card-header" style={{ textAlign: 'left', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div className="admin-logo-badge" style={{ margin: 0, width: 44, height: 44 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
              </div>
              <div>
                <h1 className="admin-card-title" style={{ fontSize: 20, margin: 0 }}>Export Database</h1>
                <p className="admin-card-subtitle" style={{ margin: 0, fontSize: 13 }}>Download complete records of species, taxonomy, images & metadata</p>
              </div>
            </div>
          </div>

          <label className="admin-label" style={{ marginBottom: 12 }}>Select Export Format</label>
          <div className="format-card-grid">
            <div
              className={`format-card ${format === 'json' ? 'active' : ''}`}
              onClick={() => setFormat('json')}
            >
              <div className="format-card-title">JSON</div>
              <div className="format-card-desc">Full nested structure with array objects for backup</div>
            </div>

            <div
              className={`format-card ${format === 'csv' ? 'active' : ''}`}
              onClick={() => setFormat('csv')}
            >
              <div className="format-card-title">CSV</div>
              <div className="format-card-desc">Flattened spreadsheet suitable for statistical tools</div>
            </div>

            <div
              className={`format-card ${format === 'xlsx' ? 'active' : ''}`}
              onClick={() => setFormat('xlsx')}
            >
              <div className="format-card-title">Excel (.xlsx)</div>
              <div className="format-card-desc">Formatted Excel workbook ready for analysis</div>
            </div>
          </div>

          <div style={{ background: 'var(--bg-primary)', padding: 14, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              <strong>Note for Researchers:</strong> A public, unauthenticated data dump API is also accessible at <code>/api/public/data-dump?format=json</code>.
            </div>
          </div>

          {loading && (
            <div style={{ margin: '20px 0', textAlign: 'center' }}>
              <LoadingSpinner />
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>Compiling dataset... Please wait</div>
            </div>
          )}

          <div className="admin-actions-bar">
            <button className="back-link-btn" onClick={() => navigate('/admin')}>
              ← Back to Dashboard
            </button>

            <button className="btn btn-primary" onClick={handleExport} disabled={loading} style={{ padding: '10px 24px', fontWeight: 600 }}>
              {loading ? 'Preparing Export...' : `Download ${format.toUpperCase()} Export`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
