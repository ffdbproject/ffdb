-- ============================================================
-- MIGRATION: Fix broken public_id sequence
-- Purpose: Correct public_id values from 1,101,201,301 to 1,2,3,4
--          and prevent future sequence misalignment
-- ============================================================

-- Step 1: Drop the old broken sequence
DROP SEQUENCE IF EXISTS species_public_id_seq CASCADE;

-- Step 2: Create a new sequence starting correctly at 1
CREATE SEQUENCE species_public_id_seq
  INCREMENT BY 1
  MINVALUE 1
  NO MAXVALUE
  START WITH 1
  CACHE 1;

-- Step 3: Reassign public_id sequentially to all published species
-- This uses ROW_NUMBER to assign 1, 2, 3, 4... in order of species ID
WITH numbered_species AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS seq_num
  FROM species
  WHERE status = 'published'
)
UPDATE species s
SET public_id = ns.seq_num
FROM numbered_species ns
WHERE s.id = ns.id;

-- Step 3b: Ensure future assignments continue from current max(public_id)
-- If no published species exist, next value should still start at 1
SELECT setval(
  'species_public_id_seq',
  COALESCE((SELECT MAX(public_id) FROM species), 1),
  true
);

-- Step 4: Grant permissions to app database user
-- IMPORTANT: Replace "creativ5_ffdb_userr" with your actual database user name
GRANT USAGE, SELECT, UPDATE ON SEQUENCE species_public_id_seq TO "creativ5_ffdb_userr";

-- Step 5: Create unique index on public_id to prevent duplicates
-- This prevents duplicate public_ids from being assigned (only checks non-NULL values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_public_id_when_published 
ON species (public_id) 
WHERE public_id IS NOT NULL;

-- Verification query (run after migration to confirm it worked):
-- SELECT id, public_id, status FROM species WHERE status = 'published' ORDER BY id LIMIT 10;
-- Expected output: id and public_id should be identical (1,1), (2,2), (3,3), (4,4)...
