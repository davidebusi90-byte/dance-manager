-- Add responsabili field to couples table
-- This field combines responsabili from both athlete1 and athlete2

-- 1. Add the column
ALTER TABLE public.couples
ADD COLUMN IF NOT EXISTS responsabili text[] DEFAULT '{}';

-- 2. Create function to sync responsabili from athletes to couple
CREATE OR REPLACE FUNCTION sync_couple_responsabili()
RETURNS TRIGGER AS $$
DECLARE
  athlete1_resp text[];
  athlete2_resp text[];
  combined_resp text[];
BEGIN
  -- Get responsabili from both athletes
  SELECT COALESCE(responsabili, '{}') INTO athlete1_resp
  FROM public.athletes
  WHERE id = NEW.athlete1_id;
  
  SELECT COALESCE(responsabili, '{}') INTO athlete2_resp
  FROM public.athletes
  WHERE id = NEW.athlete2_id;
  
  -- Combine and deduplicate
  SELECT ARRAY(
    SELECT DISTINCT unnest(athlete1_resp || athlete2_resp)
  ) INTO combined_resp;
  
  NEW.responsabili := combined_resp;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create trigger on couples INSERT/UPDATE
DROP TRIGGER IF EXISTS sync_couple_responsabili_trigger ON public.couples;
CREATE TRIGGER sync_couple_responsabili_trigger
  BEFORE INSERT OR UPDATE OF athlete1_id, athlete2_id
  ON public.couples
  FOR EACH ROW
  EXECUTE FUNCTION sync_couple_responsabili();

-- 4. Create function to update couple responsabili when athlete responsabili changes
CREATE OR REPLACE FUNCTION update_couples_on_athlete_responsabili_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Update all couples where this athlete is athlete1 or athlete2
  UPDATE public.couples
  SET responsabili = (
    SELECT ARRAY(
      SELECT DISTINCT unnest(
        COALESCE(a1.responsabili, '{}') || COALESCE(a2.responsabili, '{}')
      )
    )
    FROM public.athletes a1, public.athletes a2
    WHERE a1.id = couples.athlete1_id
    AND a2.id = couples.athlete2_id
  )
  WHERE athlete1_id = NEW.id OR athlete2_id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create trigger on athletes UPDATE
DROP TRIGGER IF EXISTS update_couples_on_athlete_responsabili_trigger ON public.athletes;
CREATE TRIGGER update_couples_on_athlete_responsabili_trigger
  AFTER UPDATE OF responsabili
  ON public.athletes
  FOR EACH ROW
  WHEN (OLD.responsabili IS DISTINCT FROM NEW.responsabili)
  EXECUTE FUNCTION update_couples_on_athlete_responsabili_change();

-- 6. Backfill existing couples with combined responsabili
UPDATE public.couples
SET responsabili = (
  SELECT ARRAY(
    SELECT DISTINCT unnest(
      COALESCE(a1.responsabili, '{}') || COALESCE(a2.responsabili, '{}')
    )
  )
  FROM public.athletes a1, public.athletes a2
  WHERE a1.id = couples.athlete1_id
  AND a2.id = couples.athlete2_id
);
