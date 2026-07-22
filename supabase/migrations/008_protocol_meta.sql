-- M03: Protocol meta-structure for category_configs
-- Exec after 001_schema.sql / seed_categories.sql
-- Adds JSONB protocol_meta to category_configs for formal meta-definition

ALTER TABLE category_configs ADD COLUMN IF NOT EXISTS protocol_meta JSONB DEFAULT '{}'::jsonb;

ALTER TABLE protocols ADD COLUMN IF NOT EXISTS funding_mode TEXT DEFAULT 'full_prepay';
