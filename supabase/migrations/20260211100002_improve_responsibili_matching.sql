
-- Miglioriamo la funzione di matching per gestire casi come "Cognome Nome" vs "Nome Cognome" e case insensitive
CREATE OR REPLACE FUNCTION public.match_names(name1 text, name2 text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  parts1 text[];
  parts2 text[];
  p1 text;
  count_match int := 0;
  total_parts int := 0;
BEGIN
  -- Normalizza: lowercase e split per spazi
  parts1 := string_to_array(lower(trim(name1)), ' ');
  parts2 := string_to_array(lower(trim(name2)), ' ');
  
  -- Rimuovi parti vuote (nel caso di spazi multipli)
  -- (Opzionale: filtriamo titoli come "maestro" se necessario, ma per ora semplifichiamo)

  -- Se uno dei due è vuoto, nessun match
  IF array_length(parts1, 1) IS NULL OR array_length(parts2, 1) IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Verifica se TUTTE le parti di name1 (o name2) sono presenti nell'altro.
  -- Questo gestisce "Simone Corvini" == "Corvini Simone"
  
  -- Strategia: contiamo quanti token di parts1 sono presenti in parts2
  FOREACH p1 IN ARRAY parts1
  LOOP
    IF p1 = ANY(parts2) THEN
      count_match := count_match + 1;
    END IF;
  END LOOP;
  
  -- Se tutti i token matchano, è ok.
  IF count_match = array_length(parts1, 1) AND array_length(parts1, 1) = array_length(parts2, 1) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- Aggiorniamo la funzione di sync per usare il match migliore
CREATE OR REPLACE FUNCTION public.sync_athlete_instructors()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Inseriamo i link basandoci sulla funzione match_names
  INSERT INTO public.athlete_instructors (athlete_id, profile_id)
  SELECT a.id, p.id
  FROM public.athletes a
  CROSS JOIN public.profiles p
  WHERE 
    EXISTS (
      SELECT 1 
      FROM unnest(a.responsabili) r
      WHERE public.match_names(r, p.full_name)
    )
  ON CONFLICT (athlete_id, profile_id) DO NOTHING;
END;
$$;

-- Aggiorniamo il trigger per usare la stessa logica flessibile
CREATE OR REPLACE FUNCTION public.auto_link_on_athlete_upsert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.athlete_instructors (athlete_id, profile_id)
  SELECT NEW.id, p.id
  FROM public.profiles p
  WHERE EXISTS (
    SELECT 1 FROM unnest(NEW.responsabili) r
    WHERE public.match_names(r, p.full_name)
  )
  ON CONFLICT (athlete_id, profile_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Eseguiamo la sincronizzazione IMMEDIATAMENTE per correggere i dati esistenti
SELECT public.sync_athlete_instructors();
