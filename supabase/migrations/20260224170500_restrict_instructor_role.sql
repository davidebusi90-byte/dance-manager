-- Migration to restrict Instructor role to read-only
-- This migration removes write permissions for instructors and ensures they can only view data.

-- 1. Restrict Athletes table
DROP POLICY IF EXISTS "Instructors can update their athletes" ON public.athletes;
-- We don't need to add a new policy because the "Authenticated users can view athletes" or specific SELECT policies already handle visibility.
-- The existing "Admins can manage athletes" (ALL) and "Admins can update athlete instructor_id" (UPDATE) policies handle admin writes.

-- 2. Restrict Competition Entries table
DROP POLICY IF EXISTS "Instructors can create entries for their couples" ON public.competition_entries;
-- Visibility is handled by "Authenticated users can view entries" (or previous migration 20260210100002).
-- Admin writes are handled by "Admins can manage entries" (ALL).

-- 3. Profiles table
-- Instructors can still update their OWN profile (this is standard behavior for users)
-- "Users can update own profile" on public.profiles remains.

-- 4. Verification
-- Now only 'admin' has INSERT/UPDATE/DELETE on athletes and competition_entries.
-- 'supervisor' has global SELECT.
-- 'instructor' has restricted SELECT.
