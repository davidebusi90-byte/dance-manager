-- Drop overly permissive policies
DROP POLICY IF EXISTS "Instructors can insert class rules" ON public.competition_class_rules;
DROP POLICY IF EXISTS "Instructors can update class rules" ON public.competition_class_rules;
DROP POLICY IF EXISTS "Instructors can delete class rules" ON public.competition_class_rules;

-- Create proper policies: only admins can manage class rules
CREATE POLICY "Admins can insert class rules"
ON public.competition_class_rules
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update class rules"
ON public.competition_class_rules
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete class rules"
ON public.competition_class_rules
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));