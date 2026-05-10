const { pool } = require('../config/db');

let teamTableReady = false;

async function ensureTeamTable() {
  if (teamTableReady) return;

  const existsResult = await pool.query(
    `SELECT 1
       FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'team_members'
      LIMIT 1`
  );

  if (existsResult.rows.length === 0) {
    throw new Error('team_members table is missing. Import backend/src/db/schema.sql on the database first.');
  }

  teamTableReady = true;
}

function normalizeOptionalString(value, maxLen) {
  if (value === undefined || value === null) return null;
  const out = String(value).trim();
  if (!out) return null;
  return maxLen ? out.slice(0, maxLen) : out;
}

async function getPublicTeam(_req, res, next) {
  try {
    await ensureTeamTable();
    const result = await pool.query(
      `SELECT id, name, role, bio, image_url, sort_order
       FROM team_members
       WHERE is_active = TRUE
       ORDER BY sort_order ASC, created_at DESC`
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

async function getAdminTeam(_req, res, next) {
  try {
    await ensureTeamTable();
    const result = await pool.query(
      `SELECT id, name, role, bio, image_url, sort_order, is_active, created_at, updated_at
       FROM team_members
       ORDER BY sort_order ASC, created_at DESC`
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

async function createTeamMember(req, res, next) {
  try {
    await ensureTeamTable();

    const name = normalizeOptionalString(req.body.name, 255);
    const role = normalizeOptionalString(req.body.role, 255);
    const bio = normalizeOptionalString(req.body.bio, 10000);
    const image_url = normalizeOptionalString(req.body.image_url, 500);
    const sort_order = Number.isFinite(Number(req.body.sort_order)) ? Number(req.body.sort_order) : 0;
    const is_active = req.body.is_active === undefined ? true : Boolean(req.body.is_active);

    if (!name || !role) {
      return res.status(400).json({
        success: false,
        message: 'name and role are required',
      });
    }

    try {
      const result = await pool.query(
        `INSERT INTO team_members (name, role, bio, image_url, sort_order, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [name, role, bio, image_url, sort_order, is_active]
      );

      res.status(201).json({
        success: true,
        message: 'Team member added',
        data: result.rows[0],
      });
    } catch (dbErr) {
      console.error('[Team] INSERT failed:', dbErr.message, 'Code:', dbErr.code);
      if (dbErr.code === '42P01') {
        throw new Error('Team members table not found. Database schema may not be initialized.');
      } else if (dbErr.code === '42501' || dbErr.message.includes('permission')) {
        throw new Error('Database permission denied. Admin must run fix_permissions.sql in phpPgAdmin.');
      }
      throw dbErr;
    }
  } catch (err) {
    console.error('[Team] createTeamMember error:', err.message);
    next(err);
  }
}

async function updateTeamMember(req, res, next) {
  try {
    await ensureTeamTable();

    const { id } = req.params;
    if (!/^\d+$/.test(String(id))) {
      return res.status(400).json({ success: false, message: 'Invalid team member id' });
    }

    const existing = await pool.query('SELECT id FROM team_members WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Team member not found' });
    }

    const name = req.body.name === undefined ? undefined : normalizeOptionalString(req.body.name, 255);
    const role = req.body.role === undefined ? undefined : normalizeOptionalString(req.body.role, 255);
    const bio = req.body.bio === undefined ? undefined : normalizeOptionalString(req.body.bio, 10000);
    const image_url = req.body.image_url === undefined ? undefined : normalizeOptionalString(req.body.image_url, 500);
    const sort_order = req.body.sort_order === undefined
      ? undefined
      : (Number.isFinite(Number(req.body.sort_order)) ? Number(req.body.sort_order) : 0);
    const is_active = req.body.is_active === undefined ? undefined : Boolean(req.body.is_active);

    if (name === '') {
      return res.status(400).json({ success: false, message: 'name cannot be empty' });
    }

    if (role === '') {
      return res.status(400).json({ success: false, message: 'role cannot be empty' });
    }

    try {
      const result = await pool.query(
        `UPDATE team_members SET
           name = COALESCE($1, name),
           role = COALESCE($2, role),
           bio = COALESCE($3, bio),
           image_url = COALESCE($4, image_url),
           sort_order = COALESCE($5, sort_order),
           is_active = COALESCE($6, is_active),
           updated_at = NOW()
         WHERE id = $7
         RETURNING *`,
        [
          name === undefined ? null : name,
          role === undefined ? null : role,
          bio === undefined ? null : bio,
          image_url === undefined ? null : image_url,
          sort_order === undefined ? null : sort_order,
          is_active === undefined ? null : is_active,
          id,
        ]
      );

      res.json({
        success: true,
        message: 'Team member updated',
        data: result.rows[0],
      });
    } catch (dbErr) {
      console.error('[Team] UPDATE failed:', dbErr.message, 'Code:', dbErr.code);
      if (dbErr.code === '42501' || dbErr.message.includes('permission')) {
        throw new Error('Database permission denied. Admin must run fix_permissions.sql in phpPgAdmin.');
      }
      throw dbErr;
    }
  } catch (err) {
    console.error('[Team] updateTeamMember error:', err.message);
    next(err);
  }
}

async function deleteTeamMember(req, res, next) {
  try {
    await ensureTeamTable();

    const { id } = req.params;
    if (!/^\d+$/.test(String(id))) {
      return res.status(400).json({ success: false, message: 'Invalid team member id' });
    }

    try {
      const result = await pool.query(
        'DELETE FROM team_members WHERE id = $1 RETURNING id, name',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Team member not found' });
      }

      res.json({
        success: true,
        message: `Deleted team member "${result.rows[0].name}"`,
        data: result.rows[0],
      });
    } catch (dbErr) {
      console.error('[Team] DELETE failed:', dbErr.message, 'Code:', dbErr.code);
      if (dbErr.code === '42501' || dbErr.message.includes('permission')) {
        throw new Error('Database permission denied. Admin must run fix_permissions.sql in phpPgAdmin.');
      }
      throw dbErr;
    }
  } catch (err) {
    console.error('[Team] deleteTeamMember error:', err.message);
    next(err);
  }
}

module.exports = {
  getPublicTeam,
  getAdminTeam,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember,
};
