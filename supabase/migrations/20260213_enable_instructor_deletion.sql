-- Enable instructor deletion by adding missing RLS policies for admins
-- This allows admins to delete instructors and clean up related data

-- 1. Allow admins to delete profiles
CREATE POLICY "Admins can delete profiles"
ON profiles
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- 2. Allow admins to delete athlete-instructor links
CREATE POLICY "Admins can delete athlete instructors"
ON athlete_instructors
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- 3. Allow admins to delete user roles
CREATE POLICY "Admins can delete user roles"
ON user_roles
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'admin'
  )
);
