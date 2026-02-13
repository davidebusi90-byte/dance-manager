-- Fix infinite recursion by completely removing the problematic policy
-- and using a simpler approach that doesn't create circular dependencies

DROP POLICY IF EXISTS "Instructors can view linked athlete profiles" ON public.profiles;

-- Simplified policy: Instructors can view their own profile and profiles they're directly linked to
-- This completely avoids any reference to the athletes table
CREATE POLICY "Instructors can view linked profiles"
  ON public.profiles FOR SELECT
  USING (
    -- Allow viewing own profile
    profiles.user_id = auth.uid()
    OR
    -- Allow if user is admin
    has_role(auth.uid(), 'admin'::app_role)
    OR
    -- Allow if this profile is linked as an instructor (without checking athletes)
    profiles.id IN (
      SELECT DISTINCT ai.profile_id 
      FROM public.athlete_instructors ai
      WHERE ai.profile_id = get_instructor_profile_id(auth.uid())
    )
  );
