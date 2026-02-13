
CREATE OR REPLACE FUNCTION public.sync_athlete_instructors()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Cancelliamo eventuali link orfani se necessario (opzionale, per ora aggiungiamo solo)
  -- Per sicurezza facciamo un INSERT ... ON CONFLICT DO NOTHING massivo.
  
  INSERT INTO public.athlete_instructors (athlete_id, profile_id)
  SELECT a.id, p.id
  FROM public.athletes a
  CROSS JOIN public.profiles p
  WHERE 
    EXISTS (
      SELECT 1 
      FROM unnest(a.responsabili) r
      WHERE lower(trim(r)) = lower(trim(p.full_name))
    )
  ON CONFLICT (athlete_id, profile_id) DO NOTHING;

END;
$$;
