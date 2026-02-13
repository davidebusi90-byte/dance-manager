-- Migration to add event_type_ids to competition_entries
ALTER TABLE public.competition_entries 
ADD COLUMN event_type_ids UUID[] NOT NULL DEFAULT '{}';

-- Add comment for clarity
COMMENT ON COLUMN public.competition_entries.event_type_ids IS 'List of race IDs (from competition_event_types) the couple is registered for';
