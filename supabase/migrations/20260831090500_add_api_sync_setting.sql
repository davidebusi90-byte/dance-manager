-- Add auto_api_sync_enabled column to system_settings
ALTER TABLE public.system_settings 
ADD COLUMN auto_api_sync_enabled BOOLEAN NOT NULL DEFAULT true;

-- Update the default row if it exists
UPDATE public.system_settings 
SET auto_api_sync_enabled = true 
WHERE id = 'global';
