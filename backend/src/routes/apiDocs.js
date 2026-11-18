// ============================================================
// FFDB - Flora and Fauna Database of Bangladesh
// API Documentation Routes
// ============================================================

const express = require('express');
const router = express.Router();

function buildServerUrl(req) {
  if (process.env.NODE_ENV === 'production') {
    return `${req.protocol}://${req.get('host')}`;
  }

  return process.env.API_SERVER_URL || 'http://localhost:5000';
}

router.get('/openapi.json', (req, res) => {
  const serverUrl = buildServerUrl(req);

  res.json({
    openapi: '3.1.0',
    info: {
      title: 'FFDB API',
      version: '1.1.0',
      description: 'Public API for the Flora and Fauna Database of Bangladesh. Species responses include global and Bangladesh conservation assessments, assessment years, and optional taxonomic authority metadata.',
    },
    servers: [
      { url: serverUrl },
    ],
    paths: {
      '/api/public/data-dump': {
        get: {
          summary: 'Bulk download published dataset',
          description: 'Unauthenticated bulk download for researchers. JSON and CSV formats include Bengali names, taxonomy authority metadata, global and Bangladesh conservation statuses with assessment years, residency, images, references, links, and publication timestamps.',
          parameters: [
            { name: 'format', in: 'query', schema: { type: 'string', enum: ['json', 'csv'], default: 'json' } },
          ],
          responses: {
            200: { description: 'Complete species dataset download' },
          },
        },
      },
      '/api/health': {
        get: {
          summary: 'Health check',
          responses: {
            200: { description: 'Service is running' },
          },
        },
      },
      '/api/species': {
        get: {
          summary: 'List species',
          description: 'Returns published species with global conservation status and year, Bangladesh conservation status and year, and taxonomy summary fields when available.',
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
            { name: 'category', in: 'query', schema: { type: 'string', enum: ['flora', 'fauna'] } },
            { name: 'status', in: 'query', schema: { type: 'string', enum: ['draft', 'pending_review', 'published'] } },
            { name: 'conservation_status', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            200: { description: 'Paginated species list' },
          },
        },
        post: {
          summary: 'Create a species record',
          description: 'Admin-only endpoint protected by HttpOnly cookie auth.',
          responses: {
            201: { description: 'Species created' },
          },
        },
      },
      '/api/species/{id}': {
        get: {
          summary: 'Fetch a species by ID',
          description: 'The response includes conservation_status and conservation_status_year for the global assessment, bd_conservation_status and bd_conservation_status_year for the Bangladesh assessment, and taxonomy.taxonomic_authority and taxonomy.authority_year when available.',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: {
            200: { description: 'Species detail' },
            404: { description: 'Species not found' },
          },
        },
      },
      '/api/search': {
        get: {
          summary: 'Search species by name',
          parameters: [
            { name: 'q', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
            { name: 'category', in: 'query', schema: { type: 'string', enum: ['flora', 'fauna'] } },
          ],
          responses: {
            200: { description: 'Search results' },
          },
        },
      },
      '/api/search/suggest': {
        get: {
          summary: 'Search suggestions',
          parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Autocomplete suggestions' },
          },
        },
      },
      '/api/admin/login': {
        post: {
          summary: 'Admin login',
          description: 'Send the admin API key in the request body to receive an HttpOnly session cookie.',
          responses: {
            200: { description: 'Logged in' },
          },
        },
      },
      '/api/admin/gbif/search': {
        get: {
          summary: 'Search GBIF for species',
          parameters: [
            { name: 'q', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 20 } },
          ],
          responses: {
            200: { description: 'GBIF search results' },
          },
        },
      },
      '/api/admin/gbif/species/{gbifKey}': {
        get: {
          summary: 'Fetch detailed GBIF species data',
          parameters: [{ name: 'gbifKey', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'GBIF species payload' },
          },
        },
      },
      '/sitemap.xml': {
        get: {
          summary: 'XML sitemap',
          responses: {
            200: { description: 'Sitemap XML' },
          },
        },
      },
      '/robots.txt': {
        get: {
          summary: 'Crawler rules',
          responses: {
            200: { description: 'Robots text file' },
          },
        },
      },
    },
  });
});

module.exports = router;