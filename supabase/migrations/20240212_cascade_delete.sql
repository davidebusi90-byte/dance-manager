-- SQL Migration to add ON DELETE CASCADE to foreign keys

-- 1. Drop existing foreign keys (names might vary, so we try standard naming convention or just use ALTER TABLE)
-- Note: Supabase/Postgres requires knowing the exact constraint name. 
-- Since we don't know the exact names, we can try to drop by column if we were using a migration tool, 
-- but here we will provide the likely commands. The user might need to check constraint names in the dashboard if these fail.

-- Assuming constraint names are auto-generated or standard.
-- We will try to DROP and RE-ADD.

-- For competition_event_types
ALTER TABLE public.competition_event_types
DROP CONSTRAINT IF EXISTS competition_event_types_competition_id_fkey;

ALTER TABLE public.competition_event_types
ADD CONSTRAINT competition_event_types_competition_id_fkey
FOREIGN KEY (competition_id)
REFERENCES public.competitions(id)
ON DELETE CASCADE;

-- For competition_class_rules
ALTER TABLE public.competition_class_rules
DROP CONSTRAINT IF EXISTS competition_class_rules_competition_id_fkey;

ALTER TABLE public.competition_class_rules
ADD CONSTRAINT competition_class_rules_competition_id_fkey
FOREIGN KEY (competition_id)
REFERENCES public.competitions(id)
ON DELETE CASCADE;

-- For competition_entries
ALTER TABLE public.competition_entries
DROP CONSTRAINT IF EXISTS competition_entries_competition_id_fkey;

ALTER TABLE public.competition_entries
ADD CONSTRAINT competition_entries_competition_id_fkey
FOREIGN KEY (competition_id)
REFERENCES public.competitions(id)
ON DELETE CASCADE;

-- For competition_results (if exists)
-- Check if table exists first, but usually good practice to cascade there too.
-- Skipping for now as user didn't explicitly mention results, but entries.

-- Verify:
-- Try deleting a competition with ID '...' and check if related rows in event_types are gone.
