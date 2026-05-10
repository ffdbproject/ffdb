// ============================================================
// FFDB - Flora and Fauna Database of Bangladesh
// Admin Dashboard — Step 8
//
// Full admin UI with:
//   • Stats overview (total, flora/fauna, status breakdown)
//   • Species management table with status filters + workflow actions
//   • GBIF data sourcing (search → preview → import as draft)
//   • Species create/edit form (all fields + taxonomy)
//   • Draft → Pending Review → Published workflow
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { speciesAPI, gbifAPI, authAPI, teamAPI } from '../services/api';
import SafeImage from '../components/SafeImage';

// ---- Status workflow helpers ----
const STATUS_FLOW = {
  draft: { next: 'pending_review', label: 'Submit for Review' },
  pending_review: { next: 'published', label: 'Approve and Publish' },
  published: { next: null, label: 'Published' },
};
const STATUS_LABELS = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  published: 'Published',
};
const STATUS_COLORS = {
  draft: '#6c757d',
  pending_review: '#f9a825',
  published: '#2d8a4e',
};

// ---- Empty form template ----
const EMPTY_FORM = {
  scientific_name: '',
  english_name: '',
  bengali_name: '',
  category: 'flora',
  origin: 'native',
  description: '',
  habitat: '',
  conservation_status: '',
  location_coordinates: [],
  featured_image_url: '',
  featured_image_credit: '',
  additional_image_urls: '',
  additional_image_credits: '',
  status: 'published',
  taxonomy: { kingdom: '', phylum: '', class: '', order: '', family: '', genus: '' },
};

// ============================================================
//  MAIN ADMIN PAGE
// ============================================================
export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('dashboard');

  // Admin Auth Config
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    authAPI.checkAuth()
      .then(() => setIsAuthenticated(true))
      .catch(() => setIsAuthenticated(false))
      .finally(() => setAuthLoading(false));
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    const key = e.target.apiKey.value;
    try {
      await authAPI.login(key);
      setIsAuthenticated(true);
      window.location.reload();
    } catch (err) {
      alert(err.message || 'Login failed');
    }
  };

  const handleLogout = async () => {
    try {
      await authAPI.logout();
      setIsAuthenticated(false);
    } catch (err) {
      alert('Logout failed');
    }
  };

  if (authLoading) {
    return <div style={{ padding: '100px', textAlign: 'center' }}>Loading...</div>;
  }

  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'species', label: 'Manage Species' },
    { id: 'reports', label: 'Reports' },
    { id: 'team', label: 'Team' },
    { id: 'gbif', label: 'Import from GBIF' },
  ];

  if (!isAuthenticated) {
    return (
      <div className="container" style={{ paddingTop: '100px', maxWidth: '400px' }}>
        <Helmet>
          <title>Admin Login | FFDB</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <div style={{ background: 'var(--bg-secondary)', padding: '30px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)' }}>
          <h2 style={{ marginBottom: '20px' }}>Admin Login</h2>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>API Key</label>
              <input type="password" name="apiKey" required style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-color)' }} placeholder="Enter admin API key" />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Login</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter admin-shell" id="admin-page">
      <Helmet>
        <title>Admin Dashboard | FFDB</title>
        <meta name="robots" content="noindex, nofollow" />
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
          {tabs.map((t) => (
            <button
              key={t.id}
              id={`admin-tab-${t.id}`}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: activeTab === t.id ? 700 : 500,
                background: activeTab === t.id ? 'var(--accent-subtle)' : 'transparent',
                color: activeTab === t.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                transition: 'var(--transition-fast)',
              }}
            >
              {t.label}
            </button>
          ))}
          <button
            onClick={handleLogout}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 500,
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: 'none',
              cursor: 'pointer',
              marginLeft: 'auto',
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* ---- Tab Content ---- */}
      <div className="container" style={{ paddingTop: '32px', paddingBottom: '80px' }}>
        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'species'   && <SpeciesManagerTab />}
        {activeTab === 'reports'   && <ReportsManagerTab />}
        {activeTab === 'team'      && <TeamManagerTab />}
        {activeTab === 'gbif'      && <GBIFImportTab />}
      </div>
    </div>
  );
}

// ============================================================
//  DASHBOARD TAB — Stats overview
// ============================================================
function DashboardTab() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    speciesAPI.getStats()
      .then((res) => setStats(res.data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;

  const cards = stats ? [
    { label: 'Total Species', value: stats.total, color: 'var(--accent-primary)' },
    { label: 'Flora', value: stats.flora_count, color: 'var(--flora-color)' },
    { label: 'Fauna', value: stats.fauna_count, color: 'var(--fauna-color)' },
    { label: 'Published', value: stats.published_count, color: '#2d8a4e' },
    { label: 'Pending Review', value: stats.pending_count, color: '#f9a825' },
    { label: 'Drafts', value: stats.draft_count, color: '#6c757d' },
  ] : [];

  return (
    <div>
      <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '6px' }}>Dashboard Overview</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '28px' }}>
        Flora and Fauna Database of Bangladesh — Admin Panel
      </p>

      {!stats ? (
        <div className="empty-state">
          <div className="empty-state-icon">Error</div>
          <h3>Could not load statistics</h3>
          <p>Make sure the backend API is running.</p>
        </div>
      ) : (
        <div className="stats-grid">
          {cards.map((c) => (
            <div className="stat-card" key={c.label} style={{ borderTop: `3px solid ${c.color}` }}>
              <h3>{c.label}</h3>
              <div className="value" style={{ color: c.color }}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Quick-start info */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius)',
        padding: '28px',
        marginTop: '12px',
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '14px' }}>Workflow Guide</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          {[
            { step: '1', title: 'Import from GBIF', desc: 'Search the global database and import species data.' },
            { step: '2', title: 'Edit & Enrich', desc: 'Add Bengali names, habitat info, and local coordinates.' },
            { step: '3', title: 'Review & Publish', desc: 'Submit for review, then approve to publish live.' },
          ].map((s) => (
            <div key={s.step} style={{
              padding: '20px',
              background: 'var(--bg-primary)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
            }}>
              <div style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                background: 'var(--accent-gradient)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '13px',
                marginBottom: '10px',
              }}>{s.step}</div>
              <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>{s.title}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
//  SPECIES MANAGER TAB — Table + Create/Edit
// ============================================================
function SpeciesManagerTab() {
  const [species, setSpecies] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);

  // Modal state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [pendingImages, setPendingImages] = useState({ featured: null, additional: [] });
  const [dbImagesBackup, setDbImagesBackup] = useState([]);

  // Toast state
  const [toast, setToast] = useState(null);
  const [enrichingId, setEnrichingId] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Fetch species list
  const fetchSpecies = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (statusFilter)   params.status = statusFilter;
      if (categoryFilter) params.category = categoryFilter;
      const res = await speciesAPI.getAll(params);
      const rows = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.data)
          ? res.data.data
          : [];
      setSpecies(rows);
      setPagination(res.pagination || res.data?.pagination || {});
    } catch {
      showToast('Failed to load species', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, categoryFilter]);

  useEffect(() => { fetchSpecies(); }, [fetchSpecies]);

  // ---- Status workflow action ----
  const advanceStatus = async (id, currentStatus) => {
    const flow = STATUS_FLOW[currentStatus];
    if (!flow?.next) return;
    try {
      await speciesAPI.update(id, { status: flow.next });
      showToast(`Status updated to "${STATUS_LABELS[flow.next]}"`);
      fetchSpecies();
    } catch {
      showToast('Failed to update status', 'error');
    }
  };

  // ---- Revert to draft ----
  const revertToDraft = async (id) => {
    try {
      await speciesAPI.update(id, { status: 'draft' });
      showToast('Reverted to Draft');
      fetchSpecies();
    } catch {
      showToast('Failed to revert status', 'error');
    }
  };

  // ---- Delete ----
  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await speciesAPI.delete(id);
      showToast(`"${name}" deleted`);
      fetchSpecies();
    } catch {
      showToast('Failed to delete', 'error');
    }
  };

  // ---- Open create form ----
  const openCreate = () => {
    setEditingId(null);
    setFormData({ ...EMPTY_FORM, taxonomy: { ...EMPTY_FORM.taxonomy } });
    setDbImagesBackup([]);
    setPendingImages({ featured: null, additional: [] });
    setShowForm(true);
  };

  // ---- Open edit form ----
  const openEdit = async (id) => {
    try {
      const res = await speciesAPI.getById(id);
      const s = res.data;
      const featuredImage = (s.images || []).find((img) => img.is_primary);
      const additionalImages = (s.images || []).filter((img) => !img.is_primary);
      setFormData({
        scientific_name: s.scientific_name || '',
        english_name: s.english_name || '',
        bengali_name: s.bengali_name || '',
        category: s.category || 'flora',
        origin: s.origin || 'native',
        description: s.description || '',
        habitat: s.habitat || null,
        conservation_status: s.conservation_status || '',
        location_coordinates: s.location_coordinates || [],
        featured_image_url: featuredImage?.image_url || '',
        featured_image_credit: featuredImage?.image_credit || '',
        additional_image_urls: additionalImages.map((img) => img.image_url).join('\n'),
        additional_image_credits: additionalImages.map((img) => img.image_credit || '').join('\n'),
        status: s.status || 'draft',
        taxonomy: {
          kingdom: s.taxonomy?.kingdom || '',
          phylum: s.taxonomy?.phylum || '',
          class: s.taxonomy?.class || '',
          order: s.taxonomy?.order || '',
          family: s.taxonomy?.family || '',
          genus: s.taxonomy?.genus || '',
        },
      });
      setEditingId(id);
      setDbImagesBackup(s.images || []);
      setPendingImages({ featured: null, additional: [] });
      setShowForm(true);
    } catch {
      showToast('Failed to load species data', 'error');
    }
  };

  // ---- Save (create or update) ----
  const handleSave = async () => {
    if (!formData.scientific_name.trim()) {
      showToast('Scientific name is required', 'error');
      return;
    }

    const featuredImageUrl = formData.featured_image_url?.trim();
    const featuredImageCredit = formData.featured_image_credit?.trim();
    const additionalImageUrls = (formData.additional_image_urls || '')
      .split(/\r?\n|,/) 
      .map((url) => url.trim())
      .filter(Boolean);
    const additionalImageCredits = (formData.additional_image_credits || '')
      .split(/\r?\n/)
      .map((credit) => credit.trim());
    // Only rebuild images if the user changed the URL fields or featured credit
    // Otherwise preserve existing DB images with their credits
    let images = [];
    const originalAdditionalUrls = dbImagesBackup
      .filter((img) => !img.is_primary)
      .map((img) => img.image_url)
      .join('\n');

    const originalAdditionalCredits = dbImagesBackup
      .filter((img) => !img.is_primary)
      .map((img) => img.image_credit || '')
      .join('\n');

    const urlsChanged = formData.additional_image_urls !== originalAdditionalUrls;
    const creditsChanged = formData.additional_image_credits !== originalAdditionalCredits;

    if (editingId && !urlsChanged && !creditsChanged && pendingImages.featured === null && pendingImages.additional.length === 0) {
      // No changes to URLs or uploads - use DB images as-is, only update featured credit
      const dbImages = dbImagesBackup.filter((img) => Boolean(img.image_url));
      images = dbImages.map((img) => ({
        image_url: img.image_url,
        image_credit: img.is_primary ? (featuredImageCredit || img.image_credit || null) : img.image_credit,
        is_primary: img.is_primary,
      }));
    } else {
      // User changed URLs or uploaded files - rebuild images array
      const uniqueUrls = [...new Set([
        ...(featuredImageUrl ? [featuredImageUrl] : []),
        ...additionalImageUrls,
      ])];

      images = uniqueUrls.map((imageUrl, idx) => ({
        image_url: imageUrl,
        image_credit: idx === 0
          ? featuredImageCredit || null
          : (additionalImageCredits[idx - 1] || null),
        is_primary: idx === 0,
      }));
    }

    const payload = {
      scientific_name: formData.scientific_name,
      english_name: formData.english_name,
      bengali_name: formData.bengali_name,
      category: formData.category,
      origin: formData.origin || 'native',
      description: formData.description,
      habitat: formData.habitat,
      conservation_status: formData.conservation_status,
      location_coordinates: formData.location_coordinates,
      status: formData.status,
      taxonomy: formData.taxonomy,
      images,
    };

    try {
      let speciesIdForUploads = editingId;

      if (editingId) {
        await speciesAPI.update(editingId, payload);
        showToast('Species updated successfully');
      } else {
        const created = await speciesAPI.create(payload);
        speciesIdForUploads = created?.data?.id;
        showToast('Species created successfully');
      }

      if (speciesIdForUploads && (pendingImages.featured || pendingImages.additional.length > 0)) {
        try {
          if (pendingImages.featured) {
              await speciesAPI.uploadImage(speciesIdForUploads, pendingImages.featured, true, featuredImageCredit);
          }

          if (pendingImages.additional.length > 0) {
            for (const file of pendingImages.additional) {
              await speciesAPI.uploadImage(speciesIdForUploads, file, false);
            }
          }

          showToast('Images uploaded successfully');
        } catch (uploadErr) {
          showToast(uploadErr.message || 'Species saved, but one or more image uploads failed.', 'error');
        }
      }

      setShowForm(false);
      setPendingImages({ featured: null, additional: [] });
      fetchSpecies();
    } catch (err) {
      showToast(err.message || 'Failed to save', 'error');
    }
  };

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredSpecies = normalizedSearch
    ? species.filter((s) => {
      const candidate = [
        s.scientific_name,
        s.english_name,
        s.bengali_name,
        s.family,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return candidate.includes(normalizedSearch);
    })
    : species;

  return (
    <div>
      {/* Toast notification */}
      {toast && <Toast message={toast.message} type={toast.type} />}

      {/* Header row */}
      <div className="admin-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>Species Manager</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            {pagination.totalRecords ?? '—'} total records
          </p>
        </div>
        <button className="btn btn-primary" id="btn-create-species" onClick={openCreate}>
          <span>+</span> Add New Species
        </button>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <select
          className="filter-select"
          id="filter-status"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="pending_review">Pending Review</option>
          <option value="published">Published</option>
        </select>
        <select
          className="filter-select"
          id="filter-category"
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Categories</option>
          <option value="flora">Flora</option>
          <option value="fauna">Fauna</option>
        </select>
        <input
          className="filter-select"
          type="search"
          id="filter-search"
          placeholder="Quick search by name or family"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ minWidth: '240px' }}
        />
      </div>

      {/* Species Table */}
      {loading ? <LoadingSpinner /> : filteredSpecies.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">No Result</div>
          <h3>No species found</h3>
          <p>Try adjusting your filters or add a new species.</p>
        </div>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" id="species-table">
              <thead>
                <tr>
                  <th>Species</th>
                  <th>Category</th>
                  <th>Family</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSpecies.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>{s.english_name || s.scientific_name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>{s.scientific_name}</div>
                      {s.bengali_name && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.bengali_name}</div>}
                    </td>
                    <td>
                      <span className={`species-card-category ${s.category}`} style={{ position: 'static' }}>
                        {s.category}
                      </span>
                    </td>
                    <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{s.family || '—'}</td>
                    <td>
                      <StatusBadge status={s.status} />
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {s.updated_at ? new Date(s.updated_at).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <div className="actions">
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(s.id)} title="Edit">
                          Edit
                        </button>
                        {STATUS_FLOW[s.status]?.next && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => advanceStatus(s.id, s.status)}
                            title={STATUS_FLOW[s.status].label}
                          >
                            {STATUS_FLOW[s.status].label}
                          </button>
                        )}
                        {s.status !== 'draft' && (
                          <button className="btn btn-secondary btn-sm" onClick={() => revertToDraft(s.id)} title="Revert to Draft">
                            Draft
                          </button>
                        )}
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.id, s.scientific_name)} title="Delete">
                          Delete
                        </button>
                        <button
                          className="btn btn-info btn-sm"
                          onClick={async () => {
                            if (!window.confirm(`Enrich "${s.scientific_name}" with external data?`)) return;
                            setEnrichingId(s.id);
                            showToast('Starting enrichment...', 'success');
                            try {
                              const res = await speciesAPI.enrich(s.id);
                              console.log('Enrich response:', res);
                              const addedImages = res.data?.images_added ?? 0;
                              const addedCoords = res.data?.coords_added ?? 0;
                              showToast(`Enriched: +${addedImages} images, +${addedCoords} coords`, 'success');
                              await fetchSpecies();
                              // Auto-open edit form to show enriched data with credits
                              setTimeout(() => openEdit(s.id), 300);
                            } catch (err) {
                              console.error('Enrich failed:', err);
                              showToast(err.message || 'Enrichment failed — check server logs', 'error');
                            } finally {
                              setEnrichingId(null);
                            }
                          }}
                          title="Enrich from Wikipedia/GBIF"
                          disabled={enrichingId === s.id}
                        >
                          {enrichingId === s.id ? 'Enriching…' : 'Enrich'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="pagination">
              <button disabled={!pagination.hasPreviousPage} onClick={() => setPage(page - 1)}>Prev</button>
              {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
                const p = i + 1;
                return (
                  <button key={p} className={page === p ? 'active' : ''} onClick={() => setPage(p)}>
                    {p}
                  </button>
                );
              })}
              <button disabled={!pagination.hasNextPage} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          )}
        </>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <SpeciesFormModal
          formData={formData}
          setFormData={setFormData}
          pendingImages={pendingImages}
          setPendingImages={setPendingImages}
          editingId={editingId}
          onSave={handleSave}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

// ============================================================
//  GBIF IMPORT TAB — Search GBIF + Preview + Import as Draft
// ============================================================
function GBIFImportTab() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [totalResults, setTotalResults] = useState(0);

  // Preview / import state
  const [preview, setPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Search GBIF
  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!query.trim() || query.trim().length < 2) return;
    setSearching(true);
    setResults([]);
    setPreview(null);
    try {
      const res = await gbifAPI.search(query, 15);
      setResults(res.data || []);
      setTotalResults(res.totalResults || 0);
    } catch {
      showToast('GBIF search failed', 'error');
    } finally {
      setSearching(false);
    }
  };

  // Fetch detailed GBIF species and show preview
  const handlePreview = async (gbifKey) => {
    setImporting(true);
    try {
      const res = await gbifAPI.getSpecies(gbifKey);
      setPreview(res.data);
    } catch {
      showToast('Could not fetch GBIF details', 'error');
    } finally {
      setImporting(false);
    }
  };

  // Import into FFDB as draft
  const handleImport = async () => {
    if (!preview) return;
    setImporting(true);
    try {
      const payload = {
        scientific_name: preview.scientific_name,
        english_name: preview.english_name,
        bengali_name: preview.bengali_name,
        category: preview.category || 'flora',
        description: preview.description,
        habitat: preview.habitat || '',
        conservation_status: preview.conservation_status,
        status: 'draft',
        taxonomy: preview.taxonomy,
        images: preview.gbif_images?.map((img, idx) => ({
          image_url: img.url,
          image_credit: [img.creator, img.rightsHolder, img.license, img.source]
            .filter(Boolean)
            .join(' · '),
          is_primary: idx === 0,
        })) || [],
      };
      await speciesAPI.create(payload);
      showToast(`"${preview.scientific_name}" imported as draft!`);
      setPreview(null);
    } catch (err) {
      showToast(err.message || 'Import failed', 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} />}

      <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '6px' }}>Import from GBIF</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>
        Search the <a href="https://www.gbif.org" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>Global Biodiversity Information Facility</a> and import species data into FFDB as a draft.
      </p>

      {/* Search bar */}
      <form onSubmit={handleSearch} style={{ marginBottom: '28px' }}>
        <div className="search-bar-wrap" style={{ maxWidth: '600px' }}>
          <input
            type="text"
            id="gbif-search-input"
            placeholder="Search GBIF (e.g. Panthera tigris, Mangifera indica)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="search-bar-btn" disabled={searching}>
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      {/* Layout: results + preview side by side */}
      <div className="gbif-layout" style={{ display: 'grid', gridTemplateColumns: preview ? '1fr 1fr' : '1fr', gap: '28px', alignItems: 'start' }}>
        {/* Results list */}
        {results.length > 0 && (
          <div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Showing {results.length} of {totalResults.toLocaleString()} results
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {results.map((r) => (
                <button
                  key={r.gbif_key}
                  onClick={() => handlePreview(r.gbif_key)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px 18px',
                    background: preview?.gbif_key === r.gbif_key ? 'var(--accent-subtle)' : 'var(--bg-card)',
                    border: `1px solid ${preview?.gbif_key === r.gbif_key ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'var(--transition-fast)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px', fontStyle: 'italic' }}>{r.scientific_name}</div>
                    {r.english_name && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{r.english_name}</div>}
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {[r.family, r.order, r.kingdom].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
                    {r.status}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search empty state */}
        {!searching && results.length === 0 && query && (
          <div className="empty-state" style={{ padding: '60px 20px' }}>
            <div className="empty-state-icon">No Result</div>
            <h3>No results</h3>
            <p>Try a different search term.</p>
          </div>
        )}

        {/* Preview panel */}
        {preview && (
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius)',
            padding: '28px',
            position: 'sticky',
            top: '160px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: 700, fontStyle: 'italic', marginBottom: '4px' }}>
                  {preview.scientific_name}
                </h3>
                {preview.english_name && (
                  <div style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>{preview.english_name}</div>
                )}
                {preview.bengali_name && (
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>{preview.bengali_name}</div>
                )}
              </div>
              {preview.category && (
                <span className={`species-card-category ${preview.category}`} style={{ position: 'static' }}>
                  {preview.category}
                </span>
              )}
            </div>

            {/* Taxonomy */}
            {preview.taxonomy && (
              <table className="taxonomy-table" style={{ marginBottom: '16px' }}>
                <tbody>
                  {Object.entries(preview.taxonomy).map(([key, val]) => val ? (
                    <tr key={key}>
                      <td>{key}</td>
                      <td>{val}</td>
                    </tr>
                  ) : null)}
                </tbody>
              </table>
            )}

            {/* Description */}
            {preview.description && (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px', maxHeight: '120px', overflow: 'auto' }}>
                {preview.description.substring(0, 500)}{preview.description.length > 500 ? '…' : ''}
              </p>
            )}

            {/* Conservation status */}
            {preview.conservation_status && (
              <div style={{ marginBottom: '16px', fontSize: '13px' }}>
                <strong>Conservation Status: </strong>
                <span className={`conservation-badge ${preview.conservation_status.toLowerCase()}`}>
                  {preview.conservation_status}
                </span>
              </div>
            )}

            {/* GBIF images preview */}
            {preview.gbif_images?.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  GBIF Images ({preview.gbif_images.length})
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {preview.gbif_images.slice(0, 4).map((img, i) => (
                    <SafeImage
                      key={i}
                      src={img.url}
                      alt=""
                      style={{
                        width: '80px',
                        height: '60px',
                        objectFit: 'cover',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                      }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Import button */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                className="btn btn-primary"
                id="btn-gbif-import"
                onClick={handleImport}
                disabled={importing}
                style={{ flex: 1 }}
              >
                {importing ? 'Importing...' : 'Import as Draft'}
              </button>
              <button className="btn btn-secondary" onClick={() => setPreview(null)}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
//  REPORTS MANAGER TAB — View and manage user reports
// ============================================================
function ReportsManagerTab() {
  const [reports, setReports] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Fetch reports list
  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (statusFilter) params.status = statusFilter;
      
      const [reportsRes, statsRes] = await Promise.all([
        fetch(`/api/reports/admin?${new URLSearchParams(params)}`).then(r => r.json()),
        fetch('/api/reports/admin/stats').then(r => r.json())
      ]);

      setReports(reportsRes.data || []);
      setPagination(reportsRes.pagination || {});
      if (statsRes.data) setStats(statsRes.data);
    } catch (err) {
      console.error('Failed to fetch reports:', err);
      showToast('Failed to load reports', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const updateStatus = async (reportId, newStatus) => {
    try {
      await fetch(`/api/reports/admin/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      showToast('Report status updated');
      fetchReports();
    } catch (err) {
      showToast('Failed to update status', 'error');
    }
  };

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} />}

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>User Reports</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
          Problems and issues reported by users. Track and resolve each issue.
        </p>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="stats-grid" style={{ marginBottom: '24px' }}>
          <div className="stat-card" style={{ borderTop: '3px solid #f9a825' }}>
            <h3>Open</h3>
            <div className="value" style={{ color: '#f9a825' }}>{stats.open_count}</div>
          </div>
          <div className="stat-card" style={{ borderTop: '3px solid #0066cc' }}>
            <h3>In Progress</h3>
            <div className="value" style={{ color: '#0066cc' }}>{stats.in_progress_count}</div>
          </div>
          <div className="stat-card" style={{ borderTop: '3px solid #2d8a4e' }}>
            <h3>Resolved</h3>
            <div className="value" style={{ color: '#2d8a4e' }}>{stats.resolved_count}</div>
          </div>
          <div className="stat-card" style={{ borderTop: '3px solid #666' }}>
            <h3>Total</h3>
            <div className="value" style={{ color: '#666' }}>{stats.total}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filters-bar">
        <select
          className="filter-select"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {/* Reports Table */}
      {loading ? <LoadingSpinner /> : reports.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">No Report</div>
          <h3>No reports found</h3>
          <p>There are no problem reports yet.</p>
        </div>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Species</th>
                  <th>Status</th>
                  <th>Reported</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                        {report.title}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                        {report.description.substring(0, 60)}
                        {report.description.length > 60 ? '...' : ''}
                      </div>
                      {report.email && (
                        <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                          {report.email}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: '13px' }}>
                      {report.scientific_name ? (
                        <div>
                          <div style={{ fontStyle: 'italic' }}>{report.scientific_name}</div>
                          {report.english_name && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {report.english_name}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <select
                        value={report.status}
                        onChange={(e) => updateStatus(report.id, e.target.value)}
                        style={{
                          padding: '6px 8px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-color)',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          background: 'var(--bg-primary)',
                          color: report.status === 'open' ? '#f9a825' : report.status === 'in_progress' ? '#0066cc' : '#2d8a4e',
                        }}
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {report.created_at ? new Date(report.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          const fullDesc = `Title: ${report.title}\n\nDescription:\n${report.description}\n\nSpecies: ${report.scientific_name || 'N/A'}\nEmail: ${report.email || 'N/A'}`;
                          alert(fullDesc);
                        }}
                        title="View full details"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="pagination">
              <button disabled={!pagination.hasPreviousPage} onClick={() => setPage(page - 1)}>Prev</button>
              {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
                const p = i + 1;
                return (
                  <button key={p} className={page === p ? 'active' : ''} onClick={() => setPage(p)}>
                    {p}
                  </button>
                );
              })}
              <button disabled={!pagination.hasNextPage} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TeamManagerTab() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: '',
    role: '',
    bio: '',
    image_url: '',
    sort_order: 0,
    is_active: true,
  });
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await teamAPI.getAdmin();
      setMembers(res.data || []);
    } catch (err) {
      showToast(err.message || 'Failed to load team', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const resetForm = () => {
    setEditingId(null);
    setForm({ name: '', role: '', bio: '', image_url: '', sort_order: 0, is_active: true });
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.role.trim()) {
      showToast('Name and role are required', 'error');
      return;
    }

    const payload = {
      name: form.name,
      role: form.role,
      bio: form.bio,
      image_url: form.image_url,
      sort_order: Number(form.sort_order) || 0,
      is_active: Boolean(form.is_active),
    };

    try {
      if (editingId) {
        await teamAPI.update(editingId, payload);
        showToast('Team member updated');
      } else {
        await teamAPI.create(payload);
        showToast('Team member added');
      }

      resetForm();
      fetchMembers();
    } catch (err) {
      showToast(err.message || 'Failed to save team member', 'error');
    }
  };

  const startEdit = (member) => {
    setEditingId(member.id);
    setForm({
      name: member.name || '',
      role: member.role || '',
      bio: member.bio || '',
      image_url: member.image_url || '',
      sort_order: member.sort_order || 0,
      is_active: member.is_active !== false,
    });
  };

  const removeMember = async (member) => {
    if (!window.confirm(`Delete team member "${member.name}"?`)) return;
    try {
      await teamAPI.delete(member.id);
      showToast('Team member deleted');
      fetchMembers();
    } catch (err) {
      showToast(err.message || 'Failed to delete', 'error');
    }
  };

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} />}

      <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '6px' }}>Team Manager</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>
        Add team members and roles shown on the Team page.
      </p>

      <div className="admin-form" style={{ marginBottom: '20px' }}>
        <div className="form-row">
          <div className="form-group">
            <label>Name *</label>
            <input className="form-control" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Role *</label>
            <input className="form-control" value={form.role} onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))} placeholder="e.g. Project Lead" />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Image URL</label>
            <input className="form-control" value={form.image_url} onChange={(e) => setForm((prev) => ({ ...prev, image_url: e.target.value }))} placeholder="https://example.com/photo.jpg" />
          </div>
          <div className="form-group">
            <label>Sort Order</label>
            <input className="form-control" type="number" value={form.sort_order} onChange={(e) => setForm((prev) => ({ ...prev, sort_order: e.target.value }))} />
          </div>
        </div>

        <div className="form-group">
          <label>Bio</label>
          <textarea className="form-control" value={form.bio} onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))} placeholder="Short bio (optional)" />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <input
            id="team-is-active"
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
          />
          <label htmlFor="team-is-active" style={{ margin: 0 }}>Show on Team page</label>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-primary" onClick={handleSubmit}>
            {editingId ? 'Update Team Member' : 'Add Team Member'}
          </button>
          {editingId && (
            <button className="btn btn-secondary" onClick={resetForm}>
              Cancel Edit
            </button>
          )}
        </div>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Order</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{member.name}</div>
                    {member.bio && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{member.bio}</div>}
                  </td>
                  <td>{member.role}</td>
                  <td>{member.sort_order ?? 0}</td>
                  <td>{member.is_active ? 'Active' : 'Hidden'}</td>
                  <td>
                    <div className="actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => startEdit(member)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => removeMember(member)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================
//  SPECIES FORM MODAL — Create or Edit
// ============================================================
function SpeciesFormModal({ formData, setFormData, pendingImages, setPendingImages, editingId, onSave, onClose }) {
  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };
  const updateTaxonomy = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      taxonomy: { ...prev.taxonomy, [field]: value },
    }));
  };

  // Handle coordinates JSON
  const [enriching, setEnriching] = useState(false);
  const [coordsText, setCoordsText] = useState(
    formData.location_coordinates?.length
      ? JSON.stringify(formData.location_coordinates, null, 2)
      : ''
  );
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

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 2000, padding: '20px',
      }}
    >
      <div
        className="admin-form"
        style={{
          maxHeight: '90vh', overflowY: 'auto', width: '100%', maxWidth: '900px',
          animation: 'fadeInUp 0.25s ease',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 700 }}>
            {editingId ? 'Edit Species' : 'New Species'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--text-muted)' }}>
            X
          </button>
        </div>

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
        <div style={{
          borderTop: '1px solid var(--border-color)',
          paddingTop: '20px',
          marginTop: '8px',
          marginBottom: '20px',
        }}>
          <label style={{
            display: 'block', fontWeight: 700, fontSize: '14px',
            marginBottom: '16px', color: 'var(--text-primary)',
          }}>
            Taxonomy
          </label>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="form-kingdom">Kingdom</label>
              <input id="form-kingdom" className="form-control" value={formData.taxonomy.kingdom} onChange={(e) => updateTaxonomy('kingdom', e.target.value)} placeholder="e.g. Animalia" />
            </div>
            <div className="form-group">
              <label htmlFor="form-phylum">Phylum</label>
              <input id="form-phylum" className="form-control" value={formData.taxonomy.phylum} onChange={(e) => updateTaxonomy('phylum', e.target.value)} placeholder="e.g. Chordata" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="form-class">Class</label>
              <input id="form-class" className="form-control" value={formData.taxonomy.class} onChange={(e) => updateTaxonomy('class', e.target.value)} placeholder="e.g. Mammalia" />
            </div>
            <div className="form-group">
              <label htmlFor="form-order">Order</label>
              <input id="form-order" className="form-control" value={formData.taxonomy.order} onChange={(e) => updateTaxonomy('order', e.target.value)} placeholder="e.g. Carnivora" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="form-family">Family</label>
              <input id="form-family" className="form-control" value={formData.taxonomy.family} onChange={(e) => updateTaxonomy('family', e.target.value)} placeholder="e.g. Felidae" />
            </div>
            <div className="form-group">
              <label htmlFor="form-genus">Genus</label>
              <input id="form-genus" className="form-control" value={formData.taxonomy.genus} onChange={(e) => updateTaxonomy('genus', e.target.value)} placeholder="e.g. Panthera" />
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
        <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          {editingId && (
            <button
              className="btn btn-info"
              onClick={async () => {
                if (!window.confirm('Fetch external data for this species and populate missing fields?')) return;
                try {
                  setEnriching(true);
                  await speciesAPI.enrich(editingId);
                  const res = await speciesAPI.getById(editingId);
                  const s = res.data || {};
                  setFormData((prev) => ({
                    ...prev,
                    description: s.description || prev.description,
                    habitat: s.habitat || prev.habitat,
                    location_coordinates: s.location_coordinates || prev.location_coordinates,
                    conservation_status: s.conservation_status || prev.conservation_status,
                    taxonomy: s.taxonomy || prev.taxonomy,
                  }));

                  const images = s.images || [];
                  const primary = images.find((img) => img.is_primary) || images[0];
                  const additional = images.filter((img) => !img.is_primary).map((i) => i.image_url);
                  setFormData((prev) => ({
                    ...prev,
                    featured_image_url: primary?.image_url || prev.featured_image_url,
                    featured_image_credit: primary?.image_credit || prev.featured_image_credit,
                    additional_image_urls: additional.length ? additional.join('\n') : prev.additional_image_urls,
                  }));

                  try { window.dispatchEvent(new CustomEvent('ffdb:show-toast', { detail: { message: 'Enrichment applied', type: 'success' } })); } catch (e) {}
                } catch (err) {
                  console.error('Enrich modal error', err);
                  try { window.dispatchEvent(new CustomEvent('ffdb:show-toast', { detail: { message: err.message || 'Enrichment failed', type: 'error' } })); } catch (e) { alert(err.message || 'Enrichment failed'); }
                } finally {
                  setEnriching(false);
                }
              }}
              disabled={enriching}
              style={{ marginRight: '8px' }}
            >
              {enriching ? 'Enriching…' : 'Enrich'}
            </button>
          )}
          <button className="btn btn-primary" id="btn-save-species" onClick={onSave}>
            {editingId ? 'Save Changes' : 'Create Species'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
//  SHARED UI COMPONENTS
// ============================================================

function StatusBadge({ status }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      padding: '4px 10px',
      borderRadius: '50px',
      fontSize: '11px',
      fontWeight: 700,
      color: STATUS_COLORS[status] || '#666',
      background: `${STATUS_COLORS[status] || '#666'}14`,
      border: `1px solid ${STATUS_COLORS[status] || '#666'}33`,
      textTransform: 'capitalize',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: STATUS_COLORS[status] }} />
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function Toast({ message, type }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: '28px',
      right: '28px',
      padding: '14px 24px',
      background: type === 'error' ? '#dc3545' : 'var(--accent-primary)',
      color: 'white',
      borderRadius: 'var(--radius-sm)',
      fontSize: '14px',
      fontWeight: 600,
      boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      zIndex: 3000,
      animation: 'fadeInUp 0.3s ease',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    }}>
      {message}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="loading">
      <div className="spinner" />
      <span className="loading-text">Loading...</span>
    </div>
  );
}
