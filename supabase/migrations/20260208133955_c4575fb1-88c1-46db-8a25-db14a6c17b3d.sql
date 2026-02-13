
-- Remove overly permissive couples SELECT policy
-- The existing couples_select_instructor_or_admin and Admins can manage couples policies provide proper scoped access
DROP POLICY IF EXISTS "Authenticated users can view couples" ON public.couples;
