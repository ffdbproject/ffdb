import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { databaseAPI } from '../services/api';
import LoadingSpinner from './_SharedLoading';
import '../styles/pages/admin-pages.css';

export default function ImportDatabasePage() {
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [toast, setToast] = useState(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleFileSelect = (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['json', 'csv', 'xlsx'].includes(ext)) {
      showToast('Unsupported file type. Please upload .json, .csv, or .xlsx', 'error');
      return;
    }
    setSelectedFile(file);
    setImportResult(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = () => {
    setIsDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const executeImport = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append('file', selectedFile, selectedFile.name);
      const res = await databaseAPI.import(fd);
      setImportResult(res);
      showToast(res.message || 'Database import completed successfully!');
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Import failed. Check file structure.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-enter admin-shell" style={{ padding: '36px 20px', minHeight: '85vh' }}>
      <Helmet>
        <title>Import Database - FFDB Admin</title>
      </Helmet>

      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {toast && <div className={`toast ${toast.type}`} style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999 }}>{toast.message}</div>}

        <div className="admin-card">
          <div className="admin-card-header" style={{ textAlign: 'left', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div className="admin-logo-badge" style={{ margin: 0, width: 44, height: 44 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
              </div>
              <div>
                <h1 className="admin-card-title" style={{ fontSize: 20, margin: 0 }}>Import Database</h1>
                <p className="admin-card-subtitle" style={{ margin: 0, fontSize: 13 }}>Bulk insert species records from JSON, CSV, or XLSX files</p>
              </div>
            </div>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            accept=".json,.csv,.xlsx"
            style={{ display: 'none' }}
            onChange={(e) => handleFileSelect(e.target.files[0])}
          />

          <div
            className={`dropzone ${isDragActive ? 'drag-active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="dropzone-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="12" y1="18" x2="12" y2="12"></line>
                <line x1="9" y1="15" x2="12" y2="12"></line>
                <line x1="15" y1="15" x2="12" y2="12"></line>
              </svg>
            </div>
            <div className="dropzone-text">Click or drag & drop backup file here</div>
            <div className="dropzone-hint">Supports JSON, CSV, or XLSX files up to 10MB</div>
          </div>

          {selectedFile && (
            <div className="file-preview-card">
              <div className="file-preview-info">
                <div>
                  <div className="file-preview-name">{selectedFile.name}</div>
                  <div className="file-preview-meta">{(selectedFile.size / 1024).toFixed(1)} KB • {selectedFile.type || 'Data file'}</div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFile(null);
                  setImportResult(null);
                }}
              >
                Change
              </button>
            </div>
          )}

          {loading && (
            <div style={{ margin: '20px 0', textAlign: 'center' }}>
              <LoadingSpinner />
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>Processing database import... Please do not close page.</div>
            </div>
          )}

          {importResult && (
            <div className="import-result-card">
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--accent-primary)' }}>
                {importResult.message || 'Import Operation Summary'}
              </div>
              <div className="result-grid">
                <div className="result-stat">
                  <div className="result-stat-val">{importResult.inserted ?? importResult.added ?? 0}</div>
                  <div className="result-stat-lbl">Species Inserted</div>
                </div>
                <div className="result-stat">
                  <div className="result-stat-val" style={{ color: 'var(--text-muted)' }}>{importResult.skipped ?? 0}</div>
                  <div className="result-stat-lbl">Skipped (Duplicates)</div>
                </div>
              </div>
            </div>
          )}

          <div className="admin-actions-bar">
            <button className="back-link-btn" onClick={() => navigate('/admin')}>
              ← Back to Dashboard
            </button>

            <button
              className="btn btn-primary"
              onClick={executeImport}
              disabled={!selectedFile || loading}
              style={{ padding: '10px 24px', fontWeight: 600 }}
            >
              {loading ? 'Importing...' : 'Start Database Import'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
