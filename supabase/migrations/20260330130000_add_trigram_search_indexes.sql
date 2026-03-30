-- Performance: trigram indexes for fast ILIKE athlete search
-- pg_trgm allows ILIKE '%pattern%' to use GIN indexes instead of full table scans

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram indexes on athlete search columns
CREATE INDEX IF NOT EXISTS idx_athletes_first_name_trgm  ON athletes USING GIN (first_name  gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_athletes_last_name_trgm   ON athletes USING GIN (last_name   gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_athletes_code_trgm        ON athletes USING GIN (code        gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_athletes_qr_code_trgm     ON athletes USING GIN (qr_code     gin_trgm_ops);
