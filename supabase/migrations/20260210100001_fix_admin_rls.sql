-- Fix RLS policies to allow admins to update instructor profiles
-- Run this in Supabase SQL Editor

-- 1. Create policy to allow admins to update any profile
CREATE POLICY "Admins can update any profile"
ON profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- 2. Create policy to allow admins to update athlete instructor_id
CREATE POLICY "Admins can update athlete instructor_id"
ON athletes
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);
