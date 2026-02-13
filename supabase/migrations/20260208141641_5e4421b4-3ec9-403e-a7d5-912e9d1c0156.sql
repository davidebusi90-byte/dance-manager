
-- Create competition_event_types table to store which event types are available per competition
CREATE TABLE public.competition_event_types (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  allowed_classes text[] NOT NULL DEFAULT '{}',
  min_age integer,
  max_age integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(competition_id, event_name)
);

-- Enable RLS
ALTER TABLE public.competition_event_types ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage event types"
ON public.competition_event_types
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view event types"
ON public.competition_event_types
FOR SELECT
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_competition_event_types_updated_at
BEFORE UPDATE ON public.competition_event_types
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
