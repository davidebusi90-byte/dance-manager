-- Consolidated and Secure RLS Policies for Dance Manager
-- This migration standardizes access for Admins, Supervisors, and Instructors
-- while strictly respecting the soft-delete (is_deleted) flag.

-- 1. CLEANUP: Remove all old/conflicting policies for athletes and couples
-- This ensures we start from a clean state.
DO $$ 
BEGIN
    -- Athletes
    DROP POLICY IF EXISTS "Admin can view all athletes" ON public.athletes;
    DROP POLICY IF EXISTS "Instructors can view their linked athletes" ON public.athletes;
    DROP POLICY IF EXISTS "Instructors can view athletes in their couples" ON public.athletes;
    DROP POLICY IF EXISTS "Supervisor can view all athletes" ON public.athletes;
    DROP POLICY IF EXISTS "Authenticated users can view non-deleted athletes" ON public.athletes;
    DROP POLICY IF EXISTS "Authenticated users can view athletes" ON public.athletes;
    DROP POLICY IF EXISTS "Admins can manage athletes" ON public.athletes;
    DROP POLICY IF EXISTS "Instructors can update their athletes" ON public.athletes;
    DROP POLICY IF EXISTS "athletes_select_instructor_or_admin" ON public.athletes;
    DROP POLICY IF EXISTS "athletes_insert_instructor_or_admin" ON public.athletes;
    DROP POLICY IF EXISTS "athletes_update_instructor_or_admin" ON public.athletes;
    
    -- Couples
    DROP POLICY IF EXISTS "Admin can view all couples" ON public.couples;
    DROP POLICY IF EXISTS "Instructors can view their linked couples" ON public.couples;
    DROP POLICY IF EXISTS "Supervisor can view all couples" ON public.couples;
    DROP POLICY IF EXISTS "Authenticated users can view non-deleted couples" ON public.couples;
    DROP POLICY IF EXISTS "Authenticated users can view couples" ON public.couples;
    DROP POLICY IF EXISTS "Admins can manage couples" ON public.couples;
    DROP POLICY IF EXISTS "couples_select_instructor_or_admin" ON public.couples;
    DROP POLICY IF EXISTS "couples_insert_instructor_or_admin" ON public.couples;
    DROP POLICY IF EXISTS "couples_update_instructor_or_admin" ON public.couples;
END $$;

-- 2. NEW CONSOLIDATED POLICIES FOR ATHLETES

-- 2a. ADMIN: Full access to everything (including deleted)
CREATE POLICY "Admin_athletes_all" ON public.athletes
AS PERMISSIVE FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 2b. SUPERVISOR: View all non-deleted athletes
CREATE POLICY "Supervisor_athletes_select" ON public.athletes
AS PERMISSIVE FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'supervisor') AND is_deleted = false);

-- 2c. INSTRUCTOR: View only linked athletes (non-deleted)
-- Linked means: directly assigned OR part of an active couple assigned to this instructor
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
        -- Linked via a couple
        EXISTS (
            SELECT 1 FROM public.couples c
            WHERE (c.athlete1_id = public.athletes.id OR c.athlete2_id = public.athletes.id)
            AND c.instructor_id = public.get_instructor_profile_id(auth.uid())
            AND c.is_active = true
        )
    )
);

-- 3. NEW CONSOLIDATED POLICIES FOR COUPLES

-- 3a. ADMIN: Full access
CREATE POLICY "Admin_couples_all" ON public.couples
AS PERMISSIVE FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 3b. SUPERVISOR: View all active couples (and active status true)
-- Note: couples doesn't currently have is_deleted, it uses is_active.
CREATE POLICY "Supervisor_couples_select" ON public.couples
AS PERMISSIVE FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'supervisor') AND is_active = true);

-- 3c. INSTRUCTOR: View only linked active couples
CREATE POLICY "Instructor_couples_select" ON public.couples
AS PERMISSIVE FOR SELECT TO authenticated
USING (
    is_active = true 
    AND public.has_role(auth.uid(), 'instructor')
    AND instructor_id = public.get_instructor_profile_id(auth.uid())
);

-- 4. VERIFICATION: Ensure RLS is active
ALTER TABLE public.athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couples ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.athletes IS 'Athletes table with consolidated RLS for Admin, Supervisor and Instructor';
COMMENT ON TABLE public.couples IS 'Couples table with consolidated RLS for Admin, Supervisor and Instructor';
