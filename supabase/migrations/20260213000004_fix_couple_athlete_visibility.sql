-- Fix RLS policy to allow instructors to see both athletes in a couple
-- if they are responsible for at least one of them

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Instructors can view their linked athletes" ON public.athletes;

-- Create a new policy that allows viewing both athletes in a couple
DROP POLICY IF EXISTS "Instructors can view athletes in their couples" ON public.athletes;
CREATE POLICY "Instructors can view athletes in their couples"
  ON public.athletes FOR SELECT
  TO authenticated
  USING (
    -- Allow if directly linked
    EXISTS (
      SELECT 1 FROM public.athlete_instructors ai
      WHERE ai.athlete_id = public.athletes.id
      AND ai.profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
    OR
    -- Allow if the athlete is part of a couple where the instructor is responsible for the other athlete
    EXISTS (
      SELECT 1 FROM public.couples c
      JOIN public.athlete_instructors ai ON (ai.athlete_id = c.athlete1_id OR ai.athlete_id = c.athlete2_id)
      WHERE (c.athlete1_id = public.athletes.id OR c.athlete2_id = public.athletes.id)
      AND ai.profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
  );
