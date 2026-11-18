const { pool } = require('../config/db');
const sanitizeHtml = require('sanitize-html');

const VALID_STYLES = new Set(['info', 'warning', 'success', 'urgent']);
const NOTICE_HTML_OPTIONS = {
  allowedTags: ['a', 'br', 'em', 'strong', 'u', 'p', 'ul', 'ol', 'li'],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {
    a: ['http', 'https', 'mailto'],
  },
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
  },
};

function serializeNotice(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    message: sanitizeHtml(row.message || '', NOTICE_HTML_OPTIONS),
    style: row.style,
    is_active: row.is_active,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    dismissible: row.dismissible,
    updated_at: row.updated_at,
  };
}

async function getActiveNotice(req, res, next) {
  try {
    const result = await pool.query(`
      SELECT id, title, message, style, is_active, starts_at, ends_at, dismissible, updated_at
      FROM site_notice
      WHERE id = 1
        AND is_active = TRUE
        AND (starts_at IS NULL OR starts_at <= NOW())
        AND (ends_at IS NULL OR ends_at >= NOW())
        AND message <> ''
    `);
    res.json({ success: true, data: serializeNotice(result.rows[0]) });
  } catch (err) {
    next(err);
  }
}

async function getAdminNotice(req, res, next) {
  try {
    const result = await pool.query('SELECT * FROM site_notice WHERE id = 1');
    res.json({ success: true, data: serializeNotice(result.rows[0]) });
  } catch (err) {
    next(err);
  }
}

async function updateNotice(req, res, next) {
  try {
    const {
      title = null,
      message = '',
      style = 'info',
      is_active = false,
      starts_at = null,
      ends_at = null,
      dismissible = true,
    } = req.body;

    if (!VALID_STYLES.has(style)) {
      return res.status(400).json({ success: false, message: 'Invalid notice style' });
    }
    if (typeof message !== 'string' || message.length > 2000) {
      return res.status(400).json({ success: false, message: 'Notice message must be 2000 characters or fewer' });
    }
    if (title !== null && (typeof title !== 'string' || title.length > 255)) {
      return res.status(400).json({ success: false, message: 'Notice title must be 255 characters or fewer' });
    }

    const safeMessage = sanitizeHtml(message.trim(), NOTICE_HTML_OPTIONS);
    const result = await pool.query(`
      INSERT INTO site_notice (id, title, message, style, is_active, starts_at, ends_at, dismissible, updated_at)
      VALUES (1, $1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        message = EXCLUDED.message,
        style = EXCLUDED.style,
        is_active = EXCLUDED.is_active,
        starts_at = EXCLUDED.starts_at,
        ends_at = EXCLUDED.ends_at,
        dismissible = EXCLUDED.dismissible,
        updated_at = NOW()
      RETURNING *
    `, [title || null, safeMessage, style, Boolean(is_active), starts_at || null, ends_at || null, Boolean(dismissible)]);

    res.json({ success: true, data: serializeNotice(result.rows[0]) });
  } catch (err) {
    next(err);
  }
}

module.exports = { getActiveNotice, getAdminNotice, updateNotice };
