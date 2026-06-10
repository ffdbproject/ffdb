-- ============================================================
-- FFDB Migration: Add residency_status, references, and external_links
-- Run this on your PostgreSQL database before deploying.
-- ============================================================

-- 1. Residency Status
-- Options: resident (default), migratory, summer_visitor, vagrant
ALTER TABLE species ADD COLUMN IF NOT EXISTS residency_status VARCHAR(30) DEFAULT 'resident';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'species_residency_status_check'
  ) THEN
    ALTER TABLE species ADD CONSTRAINT species_residency_status_check
      CHECK (residency_status IN ('resident', 'migratory', 'summer_visitor', 'vagrant'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_species_residency_status ON species (residency_status);


-- 2. References (formatted text for citations/research papers)
ALTER TABLE species ADD COLUMN IF NOT EXISTS "references" TEXT;


-- 3. External Links (JSONB storing resolved URLs per platform)
-- Structure: { "wikipedia": "https://...", "gbif": "https://...", "inaturalist": "https://...", "iucn": "https://...", "eol": "https://..." }
ALTER TABLE species ADD COLUMN IF NOT EXISTS external_links JSONB DEFAULT '{}';
