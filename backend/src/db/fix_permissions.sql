-- ============================================================
-- FFDB PostgreSQL: Fix Database Permissions
-- Run this in cPanel phpPgAdmin or any SQL client as the database owner/admin.
-- Paste the statements below into the SQL tab and execute them as SQL, not as a search/query preview.
-- ============================================================

GRANT USAGE ON SCHEMA public TO "creativ5_ffdb_userr";

-- Explicit table privileges, including DELETE for species removal.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "creativ5_ffdb_userr";

-- Sequence privileges for serial/identity columns.
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO "creativ5_ffdb_userr";

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "creativ5_ffdb_userr";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO "creativ5_ffdb_userr";
