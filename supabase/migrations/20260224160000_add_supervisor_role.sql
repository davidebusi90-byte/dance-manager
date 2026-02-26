-- Migration: Add supervisor role for read-only admin access
-- This role allows seeing all athletes, couples, and entries but no modification.

-- 1. Add 'supervisor' to app_role enum
-- Note: PostgreSQL doesn't allow adding values to enums within a transaction block easily in some versions.
-- However, Supabase migrations run in a way that usually handles this or we can use ALTER TYPE.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'supervisor';

-- 2. Update RLS policies for athletes
DROP POLICY IF EXISTS "Supervisor can view all athletes" ON public.athletes;
CREATE POLICY "Supervisor can view all athletes"
  ON public.athletes FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor'));

-- 3. Update RLS policies for couples
DROP POLICY IF EXISTS "Supervisor can view all couples" ON public.couples;
CREATE POLICY "Supervisor can view all couples"
  ON public.couples FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor'));

-- 4. Update RLS policies for competition_entries
DROP POLICY IF EXISTS "Supervisor can view all competition_entries" ON public.competition_entries;
CREATE POLICY "Supervisor can view all competition_entries"
  ON public.competition_entries FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor'));
