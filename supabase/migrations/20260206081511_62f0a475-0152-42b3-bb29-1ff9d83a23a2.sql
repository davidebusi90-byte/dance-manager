-- Remove the overly permissive public insert policy for competition_entries
DROP POLICY IF EXISTS "Public can create competition entries" ON public.competition_entries;