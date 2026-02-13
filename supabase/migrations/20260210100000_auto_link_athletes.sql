-- Function to link a single athlete to matching instructors based on responsabili
CREATE OR REPLACE FUNCTION public.auto_link_on_athlete_upsert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert into athlete_instructors for any profile whose full_name matches one of the responsabili
  INSERT INTO public.athlete_instructors (athlete_id, profile_id)
  SELECT NEW.id, p.id
  FROM public.profiles p
  WHERE EXISTS (
    SELECT 1 FROM unnest(NEW.responsabili) r
    WHERE lower(trim(r)) = lower(trim(p.full_name))
  )
  ON CONFLICT (athlete_id, profile_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Trigger to run after insert or update on athletes
DROP TRIGGER IF EXISTS trigger_auto_link_on_athlete_upsert ON public.athletes;
CREATE TRIGGER trigger_auto_link_on_athlete_upsert
  AFTER INSERT OR UPDATE OF responsabili ON public.athletes
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_on_athlete_upsert();
