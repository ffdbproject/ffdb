-- ============================================================
-- SAFE FIX: public_id sequence + backfill + future-proofing
-- Purpose:
--   1) Ensure sequence increments by 1 (no 101/201 jumps)
--   2) Rebuild published public_id values as 1..N
--   3) Sync sequence to continue from MAX(public_id)+1
--   4) Enforce uniqueness for non-NULL public_id values
-- ============================================================

BEGIN;

-- Optional lock to avoid concurrent publish updates while fixing IDs
LOCK TABLE species IN SHARE ROW EXCLUSIVE MODE;

-- Ensure public_id column exists
ALTER TABLE species
ADD COLUMN IF NOT EXISTS public_id BIGINT;

-- Ensure sequence exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    WHERE c.relkind = 'S'
      AND c.relname = 'species_public_id_seq'
  ) THEN
    CREATE SEQUENCE species_public_id_seq
      INCREMENT BY 1
      MINVALUE 1
      NO MAXVALUE
      START WITH 1
      CACHE 1;
  END IF;
END $$;

-- Always force safe sequence settings
ALTER SEQUENCE species_public_id_seq
  INCREMENT BY 1
  MINVALUE 1
  NO MAXVALUE
  CACHE 1;

-- Tie ownership to species.public_id (safe if already owned)
ALTER SEQUENCE species_public_id_seq OWNED BY species.public_id;

-- Re-number ONLY published rows as contiguous 1..N by internal id
WITH numbered_published AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS next_public_id
  FROM species
  WHERE status = 'published'
)
UPDATE species s
SET public_id = np.next_public_id
FROM numbered_published np
WHERE s.id = np.id;

-- Keep non-published rows without public_id
UPDATE species
SET public_id = NULL
WHERE status <> 'published';

-- Sync sequence so next nextval() returns MAX(public_id)+1
SELECT setval(
  'species_public_id_seq',
  COALESCE((SELECT MAX(public_id) FROM species WHERE public_id IS NOT NULL), 1),
  true
);

-- Unique only for non-NULL values (published rows)
CREATE UNIQUE INDEX IF NOT EXISTS idx_species_public_id_unique_not_null
ON species(public_id)
WHERE public_id IS NOT NULL;

COMMIT;

-- ============================================================
-- OPTIONAL: grant sequence permissions to your app DB user
-- Replace YOUR_DB_USER and run separately if needed:
-- GRANT USAGE, SELECT, UPDATE ON SEQUENCE species_public_id_seq TO "YOUR_DB_USER";
-- ============================================================

-- ============================================================
-- VERIFY AFTER RUN:
-- 1) Published IDs should be contiguous:
--    SELECT id, public_id, status FROM species WHERE status='published' ORDER BY public_id;
--
-- 2) Sequence settings:
--    SELECT increment_by, cache_size FROM pg_sequences
--    WHERE schemaname='public' AND sequencename='species_public_id_seq';
-- ============================================================
