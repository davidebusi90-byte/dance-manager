-- Migration: Allow Supervisor to view all athletes and couples for statistics parity with Admin
-- Created: 2026-09-30

-- Update Supervisor policy for athletes (remove is_deleted check)
DROP POLICY IF EXISTS "Supervisor_athletes_select" ON public.athletes;

CREATE POLICY "Supervisor_athletes_select" ON public.athletes
AS PERMISSIVE FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'supervisor'));

-- Update Supervisor policy for couples (remove is_active check)
DROP POLICY IF EXISTS "Supervisor_couples_select" ON public.couples;

CREATE POLICY "Supervisor_couples_select" ON public.couples
AS PERMISSIVE FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'supervisor'));
