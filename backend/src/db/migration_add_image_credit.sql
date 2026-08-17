-- ============================================================
-- FFDB Migration: Add `image_credit` field to images table
-- Run this on cPanel PostgreSQL if images table already exists
-- ============================================================

-- Add the image_credit column if it doesn't exist
ALTER TABLE images
ADD COLUMN IF NOT EXISTS image_credit VARCHAR(500);

-- Create index for efficient filtering by credit
CREATE INDEX IF NOT EXISTS idx_images_credit ON images (image_credit) WHERE image_credit IS NOT NULL;

-- Display success message
SELECT 'Migration completed: image_credit field added to images table' AS status;
