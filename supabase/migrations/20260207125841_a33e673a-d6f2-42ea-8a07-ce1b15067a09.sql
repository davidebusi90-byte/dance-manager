
-- Junction table: many-to-many between athletes and instructors (profiles)
CREATE TABLE public.athlete_instructors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, profile_id)
);

ALTER TABLE public.athlete_instructors ENABLE ROW LEVEL SECURITY;

-- Admins full access
CREATE POLICY "Admins can manage athlete_instructors"
  ON public.athlete_instructors FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Instructors can view their own links
CREATE POLICY "Instructors can view their athlete links"
  ON public.athlete_instructors FOR SELECT
  USING (profile_id = get_instructor_profile_id(auth.uid()));

-- Auto-link function: when a new user registers, match their name against athletes.responsabili
CREATE OR REPLACE FUNCTION public.auto_link_instructor_to_athletes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _profile_id uuid;
  _full_name text;
BEGIN
  -- Get the profile that was just created
  SELECT id, full_name INTO _profile_id, _full_name
  FROM public.profiles
  WHERE user_id = NEW.id;

  IF _profile_id IS NULL OR _full_name IS NULL THEN
    RETURN NEW;
  END IF;

  -- Link to athletes whose responsabili array contains this name (case-insensitive)
  INSERT INTO public.athlete_instructors (athlete_id, profile_id)
  SELECT a.id, _profile_id
  FROM public.athletes a
  WHERE EXISTS (
    SELECT 1 FROM unnest(a.responsabili) r
    WHERE lower(trim(r)) = lower(trim(_full_name))
  )
  ON CONFLICT (athlete_id, profile_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Trigger: run auto-link after handle_new_user creates the profile
-- We use AFTER INSERT on auth.users with a delay to ensure profile exists
-- Actually, better to trigger on profiles insert
CREATE OR REPLACE FUNCTION public.auto_link_on_profile_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Link to athletes whose responsabili array contains this instructor's name
  INSERT INTO public.athlete_instructors (athlete_id, profile_id)
  SELECT a.id, NEW.id
  FROM public.athletes a
  WHERE EXISTS (
    SELECT 1 FROM unnest(a.responsabili) r
    WHERE lower(trim(r)) = lower(trim(NEW.full_name))
  )
  ON CONFLICT (athlete_id, profile_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_link_instructor_on_profile_insert
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_on_profile_insert();
