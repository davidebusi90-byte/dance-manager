-- Automatic cleanup of all instructor traces when deleted from Supabase
-- This migration ensures that deleting a profile removes ALL related data automatically

-- 1. Add CASCADE to instructor_id in athletes table
-- First, drop the existing constraint
ALTER TABLE public.athletes
DROP CONSTRAINT IF EXISTS athletes_instructor_id_fkey;

-- Recreate with ON DELETE SET NULL (nullifies instead of blocking deletion)
ALTER TABLE public.athletes
ADD CONSTRAINT athletes_instructor_id_fkey
FOREIGN KEY (instructor_id)
REFERENCES public.profiles(id)
ON DELETE SET NULL;

-- 2. Add CASCADE to instructor_id in couples table
-- First, drop the existing constraint
ALTER TABLE public.couples
DROP CONSTRAINT IF EXISTS couples_instructor_id_fkey;

-- Recreate with ON DELETE SET NULL
ALTER TABLE public.couples
ADD CONSTRAINT couples_instructor_id_fkey
FOREIGN KEY (instructor_id)
REFERENCES public.profiles(id)
ON DELETE SET NULL;

-- 3. Create trigger to remove instructor name from responsabili array
-- This handles the text array cleanup that foreign keys can't handle
CREATE OR REPLACE FUNCTION public.cleanup_instructor_from_responsabili()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Remove the deleted instructor's name from all athletes' responsabili arrays
  UPDATE public.athletes
  SET responsabili = array_remove(responsabili, OLD.full_name)
  WHERE responsabili @> ARRAY[OLD.full_name];
  
  -- Also update couples' responsabili if it exists
  UPDATE public.couples
  SET responsabili = array_remove(responsabili, OLD.full_name)
  WHERE responsabili @> ARRAY[OLD.full_name];
  
  RETURN OLD;
END;
$$;

-- Create trigger that fires BEFORE deleting a profile
DROP TRIGGER IF EXISTS cleanup_instructor_responsabili_on_delete ON public.profiles;
CREATE TRIGGER cleanup_instructor_responsabili_on_delete
  BEFORE DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_instructor_from_responsabili();

-- Note: athlete_instructors already has ON DELETE CASCADE (from previous migration)
-- Note: user_roles already cascades from auth.users deletion

-- Summary of automatic cleanup when a profile is deleted:
-- ✅ athlete_instructors records → CASCADE DELETE (already configured)
-- ✅ athletes.instructor_id → SET NULL (new)
-- ✅ couples.instructor_id → SET NULL (new)
-- ✅ athletes.responsabili array → TRIGGER removes name (new)
-- ✅ couples.responsabili array → TRIGGER removes name (new)
-- ✅ user_roles → CASCADE DELETE (via auth.users)
