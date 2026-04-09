-- Add raw_payload column to sync_logs to archive API submissions
ALTER TABLE public.sync_logs ADD COLUMN IF NOT EXISTS raw_payload JSONB;

-- Comment for documentation
COMMENT ON COLUMN public.sync_logs.raw_payload IS 'Stores the raw JSON athletes array from the API sync for archival and recovery.';

-- Update RLS if necessary (currently select is allowed for authenticated)
-- No changes needed if we want admins to see it via the UI, 
-- but we should ensure only admins can see the raw_payload specifically if needed.
-- For now, keep it simple as the UI handles role checks.
