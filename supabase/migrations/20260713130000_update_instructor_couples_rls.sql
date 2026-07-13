-- Migration: Update Couples and Competition Entries RLS policies for Instructors
-- Created: 2026-07-13

-- 1. Create helper function to check if an instructor has access to a couple
CREATE OR REPLACE FUNCTION public.instructor_can_access_couple(_instructor_user_id uuid, _couple_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _instructor_profile_id uuid;
  _instructor_name text;
BEGIN
  -- Get the instructor profile ID and full name
  SELECT id, full_name INTO _instructor_profile_id, _instructor_name
  FROM public.profiles
  WHERE user_id = _instructor_user_id;

  IF _instructor_profile_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.couples c
    WHERE c.id = _couple_id
    AND (
        -- Directly assigned via instructor_id
        c.instructor_id = _instructor_profile_id
        OR
        -- Linked to athlete1
        EXISTS (
            SELECT 1 FROM public.athlete_instructors ai
            WHERE ai.athlete_id = c.athlete1_id
            AND ai.profile_id = _instructor_profile_id
        )
        OR
        -- Linked to athlete2
        EXISTS (
            SELECT 1 FROM public.athlete_instructors ai
            WHERE ai.athlete_id = c.athlete2_id
            AND ai.profile_id = _instructor_profile_id
        )
        OR
        -- Instructor's name matches any name in couple's responsabili array (fuzzy check)
        EXISTS (
            SELECT 1 FROM unnest(c.responsabili) r
            WHERE public.match_names(r, _instructor_name)
        )
    )
  );
END;
$$;

-- 2. Drop existing Instructor policy on couples
DROP POLICY IF EXISTS "Instructor_couples_select" ON public.couples;

-- 3. Create updated Instructor policy on couples
CREATE POLICY "Instructor_couples_select" ON public.couples
AS PERMISSIVE FOR SELECT TO authenticated
USING (
    is_active = true 
    AND public.has_role(auth.uid(), 'instructor')
    AND public.instructor_can_access_couple(auth.uid(), id)
);

COMMENT ON POLICY "Instructor_couples_select" ON public.couples IS 'Allow instructors to select active couples they are linked to (via instructor_id, athlete links, or responsabili name match)';

-- 4. Drop existing Instructor policies on competition_entries
DROP POLICY IF EXISTS "Instructors can view their entries" ON public.competition_entries;
DROP POLICY IF EXISTS "Instructors can create entries for their couples" ON public.competition_entries;
DROP POLICY IF EXISTS "Instructors can update entries for their couples" ON public.competition_entries;

-- 5. Create updated Instructor policies on competition_entries using the helper function
CREATE POLICY "Instructors can view their entries"
ON public.competition_entries FOR SELECT
TO authenticated
USING (
    public.has_role(auth.uid(), 'instructor')
    AND public.instructor_can_access_couple(auth.uid(), couple_id)
);

CREATE POLICY "Instructors can create entries for their couples"
ON public.competition_entries FOR INSERT
TO authenticated
WITH CHECK (
    public.has_role(auth.uid(), 'instructor')
    AND public.instructor_can_access_couple(auth.uid(), couple_id)
);

CREATE POLICY "Instructors can update entries for their couples"
ON public.competition_entries FOR UPDATE
TO authenticated
USING (
    public.has_role(auth.uid(), 'instructor')
    AND public.instructor_can_access_couple(auth.uid(), couple_id)
)
WITH CHECK (
    public.has_role(auth.uid(), 'instructor')
    AND public.instructor_can_access_couple(auth.uid(), couple_id)
);
