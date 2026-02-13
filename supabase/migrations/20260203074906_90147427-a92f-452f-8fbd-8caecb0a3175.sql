-- Create table for competition class eligibility rules
CREATE TABLE public.competition_class_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  class TEXT NOT NULL,
  is_allowed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(competition_id, class)
);

-- Enable RLS
ALTER TABLE public.competition_class_rules ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users can read, instructors can manage
CREATE POLICY "Anyone authenticated can view class rules"
ON public.competition_class_rules
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Instructors can insert class rules"
ON public.competition_class_rules
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Instructors can update class rules"
ON public.competition_class_rules
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Instructors can delete class rules"
ON public.competition_class_rules
FOR DELETE
TO authenticated
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_competition_class_rules_updated_at
BEFORE UPDATE ON public.competition_class_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();