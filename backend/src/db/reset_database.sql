-- ============================================================
-- COMPLETE DATABASE RESET
-- Deletes all species data and resets sequences
-- ============================================================

BEGIN;

-- Delete all reports (referencing species)
DELETE FROM reports;

-- Delete all images (referencing species)
DELETE FROM images;

-- Delete all taxonomy (referencing species)
DELETE FROM taxonomy;

-- Delete all species
DELETE FROM species;

-- Delete all team members
DELETE FROM team_members;

-- Reset the main species ID sequence to start from 1
SELECT setval('species_id_seq', 1, false);

-- Reset the public_id sequence to start from 1
SELECT setval('species_public_id_seq', 1, false);

COMMIT;

-- Verify reset (shows all counts should be 0)
SELECT COUNT(*) as total_species FROM species;
SELECT COUNT(*) as total_taxonomy FROM taxonomy;
SELECT COUNT(*) as total_images FROM images;
SELECT COUNT(*) as total_reports FROM reports;
SELECT COUNT(*) as total_team_members FROM team_members;
