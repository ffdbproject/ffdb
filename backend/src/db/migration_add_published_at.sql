-- Add the timestamp used to order public species by publication time.
ALTER TABLE species
ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- Existing published records have no historical publication event. The
-- current updated_at is the safest available approximation for those rows.
UPDATE species
SET published_at = updated_at
WHERE status = 'published' AND published_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_species_published_at
  ON species (published_at DESC);
