-- ============================================================
-- FFDB Migration: Add public_id index for fast species lookups
-- 
-- WHY: The species detail page queries by public_id, but there's
-- no index on it. Without this, every detail page does a full
-- table scan as the database grows.
--
-- HOW TO RUN:
--   Option A (phpMyAdmin/pgAdmin on cPanel):
--     1. Open phpPgAdmin or pgAdmin on your cPanel
--     2. Select your FFDB database
--     3. Open the SQL query tool
--     4. Paste this entire file and click "Execute"
--
--   Option B (command line):
--     psql -U your_db_user -d ffdb -f migration_add_public_id_index.sql
-- ============================================================

-- Add index on public_id for fast lookups (partial index, only non-null values)
CREATE INDEX IF NOT EXISTS idx_species_public_id 
    ON species (public_id) 
    WHERE public_id IS NOT NULL;

-- Verify the index was created
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'species' AND indexname = 'idx_species_public_id';
