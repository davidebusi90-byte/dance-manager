
-- Fix 1: Remove public SELECT policies from athletes table
DROP POLICY IF EXISTS "Public can view athletes for enrollment" ON public.athletes;

-- Fix 2: Remove public SELECT policies from couples table  
DROP POLICY IF EXISTS "Public can view couples for enrollment" ON public.couples;

-- Fix 3: Remove public SELECT policies from competitions table
DROP POLICY IF EXISTS "Public can view competitions for enrollment" ON public.competitions;

-- Fix 4: Remove public SELECT policies from competition_entries table
DROP POLICY IF EXISTS "Public can view competition entries for enrollment" ON public.competition_entries;

-- Fix 5: Remove public SELECT policies from competition_class_rules table
DROP POLICY IF EXISTS "Public can view class rules for enrollment" ON public.competition_class_rules;

-- Fix 6: Remove overly permissive profiles policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Fix 7: Add admin can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix 8: Instructors can view profiles of their linked athletes
CREATE POLICY "Instructors can view linked athlete profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.athlete_instructors ai
      JOIN public.athletes a ON a.id = ai.athlete_id
      WHERE ai.profile_id = get_instructor_profile_id(auth.uid())
        AND (a.instructor_id = profiles.id OR ai.profile_id = profiles.id)
    )
  );
