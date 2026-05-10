// ============================================================
// FFDB - Flora and Fauna Database of Bangladesh
// API Service Layer — Centralized HTTP client for the Express backend
// ============================================================

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const ASSET_BASE = import.meta.env.VITE_ASSET_URL || '';

export function resolveAssetUrl(path) {
  if (!path) return '';
  if (path.startsWith('data:') || path.startsWith('blob:')) return path;

  if (path.startsWith('http://') || path.startsWith('https://')) {
    const proxyBase = API_BASE.replace(/\/$/, '');
    return `${proxyBase}/image-proxy?url=${encodeURIComponent(path)}`;
  }

  return `${ASSET_BASE}${path}`;
}

/**
 * Generic fetch wrapper with error handling.
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include', // Important for sending/receiving HttpOnly cookies
    ...options,
  };

  // If we are uploading a file (FormData), we should not set Content-Type to application/json
  if (options.body instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }

    return data;
  } catch (err) {
    console.error(`[API] ${options.method || 'GET'} ${endpoint} failed:`, err.message);
    throw err;
  }
}

// ============================================================
// AUTH API
// ============================================================

export const authAPI = {
  login(apiKey) {
    return request('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ apiKey }),
    });
  },
  logout() {
    return request('/admin/logout', { method: 'POST' });
  },
  checkAuth() {
    return request('/admin/me');
  },
};

// ============================================================
// SPECIES API
// ============================================================

export const speciesAPI = {
  /**
   * Get paginated species list.
  * @param {Object} params - { page, limit, category, status, origin }
   */
  getAll(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/species?${query}`);
  },

  /**
   * Get a single species by ID with full details.
   */
  getById(id) {
    return request(`/species/${id}`);
  },

  /**
   * Create a new species record.
   */
  create(speciesData) {
    return request('/species', {
      method: 'POST',
      body: JSON.stringify(speciesData),
    });
  },

  /**
   * Public contribution endpoint (always stored as draft).
   */
  contribute(speciesData) {
    return request('/species/contribute', {
      method: 'POST',
      body: JSON.stringify(speciesData),
      skipAuth: true,
    });
  },

  /**
   * Update an existing species.
   */
  update(id, speciesData) {
    return request(`/species/${id}`, {
      method: 'PUT',
      body: JSON.stringify(speciesData),
    });
  },

  /**
   * Delete a species.
   */
  delete(id) {
    return request(`/species/${id}/delete`, {
      method: 'POST',
    });
  },

  /**
   * Upload image for a species
   */
  uploadImage(id, file, isPrimary = false, imageCredit = '') {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('is_primary', isPrimary);
    if (imageCredit && imageCredit.trim()) {
      formData.append('image_credit', imageCredit.trim());
    }

    return request(`/species/${id}/upload`, {
      method: 'POST',
      body: formData,
    });
  },

  /**
   * Get dashboard statistics.
   */
  getStats() {
    return request('/species/stats/overview');
  },
  /**
   * Trigger backend enrichment for a species (admin only).
   */
  enrich(id) {
    return request(`/admin/enrich/${id}`, { method: 'POST' });
  },
};

// ============================================================
// SEARCH API
// ============================================================

export const searchAPI = {
  /**
   * Omni-search across all name fields.
   * @param {string} q - Search query
   * @param {Object} params - { page, limit, category }
   */
  search(q, params = {}) {
    const query = new URLSearchParams({ q, ...params }).toString();
    return request(`/search?${query}`);
  },

  /**
   * Autocomplete suggestions for search bar.
   */
  suggest(q) {
    return request(`/search/suggest?q=${encodeURIComponent(q)}`);
  },
};

// ============================================================
// GBIF API (Admin)
// ============================================================

export const gbifAPI = {
  /**
   * Search GBIF species database.
   */
  search(q, limit = 10) {
    return request(`/admin/gbif/search?q=${encodeURIComponent(q)}&limit=${limit}`);
  },

  /**
   * Get detailed species data from GBIF by key.
   */
  getSpecies(gbifKey) {
    return request(`/admin/gbif/species/${gbifKey}`);
  },
};

// ============================================================
// TEAM API
// ============================================================

export const teamAPI = {
  getPublic() {
    return request('/team');
  },
  getAdmin() {
    return request('/admin/team');
  },
  create(payload) {
    return request('/admin/team', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  update(id, payload) {
    return request(`/admin/team/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
  delete(id) {
    return request(`/admin/team/${id}/delete`, {
      method: 'POST',
    });
  },
};
