-- Data Retention and Right to be Forgotten
-- This migration adds timestamps for deletion and inactivity tracking.

-- 1. ADD TIMESTAMPS
ALTER TABLE public.athletes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

-- 2. PURGE FUNCTION (Technical representation of Right to be Forgotten)
-- This function can be called by an edge function or a cron job (pg_cron).
CREATE OR REPLACE FUNCTION public.purge_deleted_data(retention_interval INTERVAL DEFAULT '30 days')
RETURNS TABLE (deleted_count INTEGER, table_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- This function deletes records that have been marked as deleted longer than the retention interval.
    -- For athletes, this will cascade to entries if ON DELETE CASCADE is set.
    
    WITH deleted_athletes AS (
        DELETE FROM public.athletes
        WHERE deleted_at < (now() - retention_interval)
        RETURNING id
    )
    SELECT count(*), 'athletes' FROM deleted_athletes INTO deleted_count, table_name;
    RETURN NEXT;

    WITH deleted_profiles AS (
        DELETE FROM public.profiles
        WHERE deleted_at < (now() - retention_interval)
        RETURNING id
    )
    SELECT count(*), 'profiles' FROM deleted_profiles INTO deleted_count, table_name;
    RETURN NEXT;

END;
$$;

-- 3. SOFT DELETE TRIGGER (Refinement)
-- Ensure that when is_deleted is set to true, deleted_at is updated.
CREATE OR REPLACE FUNCTION public.handle_soft_delete_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.is_deleted = true AND (OLD.is_deleted = false OR OLD.is_deleted IS NULL)) THEN
        NEW.deleted_at = now();
    ELSIF (NEW.is_deleted = false AND OLD.is_deleted = true) THEN
        NEW.deleted_at = NULL; -- Undo deletion
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach to athletes (is_deleted was already present in migration 20260224190000_add_soft_delete.sql)
DROP TRIGGER IF EXISTS trg_athletes_soft_delete_timestamp ON public.athletes;
CREATE TRIGGER trg_athletes_soft_delete_timestamp
BEFORE UPDATE ON public.athletes
FOR EACH ROW EXECUTE FUNCTION public.handle_soft_delete_timestamp();

COMMENT ON FUNCTION public.purge_deleted_data IS 'Performs physical deletion of records marked for soft-deletion after a retention period.';
