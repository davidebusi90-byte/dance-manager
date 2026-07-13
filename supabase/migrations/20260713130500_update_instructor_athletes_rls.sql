-- Migration: Update Athletes RLS policy for Instructors to allow viewing both members of visible couples
-- Created: 2026-07-13

-- 1. Drop existing Instructor policy on athletes
DROP POLICY IF EXISTS "Instructor_athletes_select" ON public.athletes;

-- 2. Create updated Instructor policy on athletes
CREATE POLICY "Instructor_athletes_select" ON public.athletes
AS PERMISSIVE FOR SELECT TO authenticated
USING (
    is_deleted = false 
    AND public.has_role(auth.uid(), 'instructor')
    AND (
        -- Directly linked to athlete
        EXISTS (
            SELECT 1 FROM public.athlete_instructors ai
            WHERE ai.athlete_id = public.athletes.id
            AND ai.profile_id = public.get_instructor_profile_id(auth.uid())
        )
        OR
        -- Linked via a couple the instructor has access to
        EXISTS (
            SELECT 1 FROM public.couples c
            WHERE (c.athlete1_id = public.athletes.id OR c.athlete2_id = public.athletes.id)
            AND c.is_active = true
            AND public.instructor_can_access_couple(auth.uid(), c.id)
        )
    )
);

COMMENT ON POLICY "Instructor_athletes_select" ON public.athletes IS 'Allow instructors to select athletes they are linked to directly or via a couple they have access to';
