-- ============================================================
-- FFDB - Flora and Fauna Database of Bangladesh
-- PostgreSQL Database Schema (v1.0)
-- 
-- Requires UTF-8 encoding for Bengali (বাংলা) character support.
-- Run this script against your PostgreSQL database to create
-- all tables, relationships, indexes, and seed the enum types.
-- ============================================================

-- Enable the pgcrypto extension for gen_random_uuid() if needed
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. SPECIES TABLE
-- The core table storing all species records.
-- ============================================================
CREATE TABLE IF NOT EXISTS species (
    id              SERIAL PRIMARY KEY,
    scientific_name VARCHAR(255) NOT NULL,
    english_name    VARCHAR(255),
    bengali_name    VARCHAR(255),             -- বাংলা নাম (UTF-8)
    category        VARCHAR(10)  NOT NULL 
                    CHECK (category IN ('flora', 'fauna')),
    description     TEXT,
    habitat         TEXT,
    origin          VARCHAR(20) DEFAULT 'native'
                    CHECK (origin IN ('native', 'exotic')),  -- Native to Bangladesh or Exotic
    conservation_status VARCHAR(50),          -- e.g., LC, NT, VU, EN, CR, EW, EX
    location_coordinates JSONB DEFAULT '[]',  -- Array of {lat, lng, label?} objects
    status          VARCHAR(20) NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'pending_review', 'published')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT species_scientific_name_key UNIQUE (scientific_name)
);

-- Indexes for SPECIES
-- (Reverted to B-tree due to cPanel shared hosting limitations with pg_trgm)
CREATE INDEX idx_species_scientific_name ON species (scientific_name);
CREATE INDEX idx_species_english_name    ON species (english_name);
CREATE INDEX idx_species_bengali_name    ON species (bengali_name);

-- Standard B-tree indexes for exact matches and sorting
CREATE INDEX idx_species_category        ON species (category);
CREATE INDEX idx_species_status          ON species (status);
CREATE INDEX idx_species_conservation    ON species (conservation_status);
CREATE INDEX idx_species_created_at      ON species (created_at DESC);


-- ============================================================
-- 2. TAXONOMY TABLE
-- Normalized taxonomic classification for each species.
-- One-to-one relationship with species (one taxonomy per species).
-- ============================================================
CREATE TABLE IF NOT EXISTS taxonomy (
    id         SERIAL PRIMARY KEY,
    species_id INTEGER NOT NULL UNIQUE,
    kingdom    VARCHAR(100),
    phylum     VARCHAR(100),
    class      VARCHAR(100),               -- "class" is a reserved word in some
    "order"    VARCHAR(100),               -- "order" is a reserved keyword in SQL
    family     VARCHAR(100),
    genus      VARCHAR(100),

    CONSTRAINT fk_taxonomy_species
        FOREIGN KEY (species_id)
        REFERENCES species (id)
        ON DELETE CASCADE
);

-- Indexes for TAXONOMY
CREATE INDEX idx_taxonomy_species_id ON taxonomy (species_id);
CREATE INDEX idx_taxonomy_family     ON taxonomy (family);
CREATE INDEX idx_taxonomy_genus      ON taxonomy (genus);


-- ============================================================
-- 3. IMAGES TABLE
-- Stores image paths for each species.
-- One species can have many images; one image is marked primary.
-- ============================================================
CREATE TABLE IF NOT EXISTS images (
    id         SERIAL PRIMARY KEY,
    species_id INTEGER NOT NULL,
    image_url  VARCHAR(500) NOT NULL,      -- Local path, e.g., /uploads/species/123/photo1.jpg
    image_credit VARCHAR(500),             -- Photo credit/attribution, e.g., "© John Doe" or "Photo by Jane Smith"
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_images_species
        FOREIGN KEY (species_id)
        REFERENCES species (id)
        ON DELETE CASCADE
);

-- Indexes for IMAGES
CREATE INDEX idx_images_species_id ON images (species_id);
CREATE INDEX idx_images_is_primary ON images (is_primary) WHERE is_primary = TRUE;
CREATE INDEX idx_images_credit ON images (image_credit) WHERE image_credit IS NOT NULL;


-- ============================================================
-- 4. AUTO-UPDATE TRIGGER FOR updated_at
-- Automatically sets updated_at on every UPDATE to species row.
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_species_updated_at
    BEFORE UPDATE ON species
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();


-- ============================================================
-- 5. OPTIONAL: Ensure only ONE primary image per species
-- This partial unique index prevents multiple is_primary=true
-- rows for the same species_id.
-- ============================================================
CREATE UNIQUE INDEX idx_images_one_primary_per_species
    ON images (species_id)
    WHERE is_primary = TRUE;


-- ============================================================
-- 6. TEAM MEMBERS TABLE
-- Stores project team member profiles shown on the public Team page.
-- ============================================================
CREATE TABLE IF NOT EXISTS team_members (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(255) NOT NULL,
    role       VARCHAR(255) NOT NULL,
    bio        TEXT,
    image_url  VARCHAR(500),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_team_members_active_sort
    ON team_members (is_active, sort_order, created_at DESC);


-- ============================================================
-- 6. REPORTS TABLE
-- User-submitted problem reports with tracking and status
-- ============================================================
CREATE TABLE IF NOT EXISTS reports (
    id              SERIAL PRIMARY KEY,
    species_id      INTEGER,                                 -- Optional: relate to specific species
    title           VARCHAR(255) NOT NULL,                   -- Problem title/summary
    description     TEXT NOT NULL,                           -- Detailed problem description
    email           VARCHAR(255),                            -- Optional: user contact email
    status          VARCHAR(20) NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'in_progress', 'resolved')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT reports_species_fk FOREIGN KEY (species_id) REFERENCES species(id) ON DELETE SET NULL
);

-- Indexes for REPORTS
CREATE INDEX idx_reports_status        ON reports (status);
CREATE INDEX idx_reports_species_id    ON reports (species_id);
CREATE INDEX idx_reports_created_at    ON reports (created_at DESC);


-- ============================================================
-- VERIFICATION: List all created tables
-- ============================================================
-- Run after executing:  \dt
-- Expected tables: species, taxonomy, images, reports
