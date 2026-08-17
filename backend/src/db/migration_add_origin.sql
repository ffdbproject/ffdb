-- ============================================================
-- FFDB Migration: Add `origin` field to species table
-- Run this on cPanel PostgreSQL if species table already exists
-- ============================================================

-- Add the origin column if it doesn't exist
ALTER TABLE species
ADD COLUMN IF NOT EXISTS origin VARCHAR(20) DEFAULT 'native'
CHECK (origin IN ('native', 'exotic'));

-- Create index for efficient filtering by origin
CREATE INDEX IF NOT EXISTS idx_species_origin ON species (origin);

-- Set all existing species to 'native' by default
UPDATE species SET origin = 'native' WHERE origin IS NULL;

-- Make the column NOT NULL after setting defaults
ALTER TABLE species 
ALTER COLUMN origin SET NOT NULL;

-- Display success message
SELECT 'Migration completed: origin field added to species table' AS status;
