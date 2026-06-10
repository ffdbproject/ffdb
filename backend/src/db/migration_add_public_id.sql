-- ============================================================
-- MIGRATION: Add public_id to species table
-- Purpose: Implement publish-only public URLs
-- Description:
--   - Adds public_id BIGINT column to species table
--   - Creates species_public_id_seq sequence for assigning IDs at publish time
--   - Backfills public_id for all existing PUBLISHED species
--   - Draft/pending species keep public_id as NULL until published
-- ============================================================

-- Create sequence for public-facing species IDs
CREATE SEQUENCE IF NOT EXISTS species_public_id_seq
  INCREMENT BY 1
  MINVALUE 1
  NO MAXVALUE
  START WITH 1
  CACHE 1;

-- Add public_id column if it doesn't exist
ALTER TABLE species
ADD COLUMN IF NOT EXISTS public_id BIGINT UNIQUE;

-- Create index on public_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_species_public_id ON species (public_id);

-- Backfill public_id for existing PUBLISHED species
-- This assigns sequential IDs to all published species
UPDATE species
SET public_id = NEXTVAL('species_public_id_seq')
WHERE status = 'published' AND public_id IS NULL;

-- Note: Draft and pending_review species will have public_id = NULL
-- When they are published, public_id will be assigned via application logic
