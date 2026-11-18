ALTER TABLE species
  ADD COLUMN IF NOT EXISTS conservation_status_year INTEGER,
  ADD COLUMN IF NOT EXISTS bd_conservation_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS bd_conservation_status_year INTEGER;

ALTER TABLE taxonomy
  ADD COLUMN IF NOT EXISTS taxonomic_authority VARCHAR(255),
  ADD COLUMN IF NOT EXISTS authority_year INTEGER;
