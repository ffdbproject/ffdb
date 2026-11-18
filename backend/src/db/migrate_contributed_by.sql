-- Migration: Add contributed_by column to species table
ALTER TABLE species ADD COLUMN IF NOT EXISTS contributed_by TEXT;
