-- Add payment tracking to competition entries
ALTER TABLE public.competition_entries 
ADD COLUMN is_paid BOOLEAN NOT NULL DEFAULT false;

-- Add unique constraint to prevent duplicate entries
ALTER TABLE public.competition_entries 
ADD CONSTRAINT competition_entries_unique_couple 
UNIQUE (competition_id, couple_id);

-- Add RLS policy for instructors to update entries (mark as paid)
CREATE POLICY "Instructors can update entries for their couples"
ON public.competition_entries
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.couples c
    WHERE c.id = competition_entries.couple_id
    AND c.instructor_id = public.get_instructor_profile_id(auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.couples c
    WHERE c.id = competition_entries.couple_id
    AND c.instructor_id = public.get_instructor_profile_id(auth.uid())
  )
);