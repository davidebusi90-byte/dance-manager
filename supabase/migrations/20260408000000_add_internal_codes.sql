-- 1. Create sequences for internal codes
CREATE SEQUENCE IF NOT EXISTS couple_internal_code_seq START 1000;
CREATE SEQUENCE IF NOT EXISTS entry_internal_code_seq START 5000;

-- 2. Add internal_code to couples
ALTER TABLE public.couples ADD COLUMN IF NOT EXISTS internal_code TEXT UNIQUE;
ALTER TABLE public.couples ALTER COLUMN internal_code SET DEFAULT 'CPL-' || nextval('couple_internal_code_seq')::TEXT;

-- 3. Add internal_code to competition_entries
ALTER TABLE public.competition_entries ADD COLUMN IF NOT EXISTS internal_code TEXT UNIQUE;
ALTER TABLE public.competition_entries ALTER COLUMN internal_code SET DEFAULT 'REG-' || nextval('entry_internal_code_seq')::TEXT;

-- 4. Ensure soft delete columns exist on athletes (already added in some migrations but verifying)
ALTER TABLE public.athletes ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE public.athletes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- 5. Ensure soft delete columns exist on couples
ALTER TABLE public.couples ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE public.couples ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- 6. Trigger to automatically sync is_deleted from athletes to couples
-- If an athlete is deleted, the couple they belong to should also be considered deleted/inactive
CREATE OR REPLACE FUNCTION public.sync_couple_deletion()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.is_deleted = true) THEN
        UPDATE public.couples 
        SET is_deleted = true, 
            deleted_at = now(),
            is_active = false
        WHERE athlete1_id = NEW.id OR athlete2_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_athlete_deletion_to_couple ON public.athletes;
CREATE TRIGGER trg_sync_athlete_deletion_to_couple
AFTER UPDATE OF is_deleted ON public.athletes
FOR EACH ROW
WHEN (NEW.is_deleted = true AND OLD.is_deleted = false)
EXECUTE FUNCTION public.sync_couple_deletion();

-- 7. Initialize codes for existing records if any
-- Update couples that don't have a code yet
UPDATE public.couples SET internal_code = 'CPL-' || nextval('couple_internal_code_seq')::TEXT WHERE internal_code IS NULL;
-- Update entries that don't have a code yet
UPDATE public.competition_entries SET internal_code = 'REG-' || nextval('entry_internal_code_seq')::TEXT WHERE internal_code IS NULL;
