-- Rimuovi vecchie policy restrittive o generiche se necessario (da valutare caso per caso)
-- Qui assumiamo di voler sovrascrivere o aggiungere policy specifiche.

-- 1. Aggiorna Policy SELECT su athletes per Istruttori
DROP POLICY IF EXISTS "Authenticated users can view athletes" ON public.athletes;
CREATE POLICY "Admin can view all athletes"
  ON public.athletes FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Instructors can view their linked athletes"
  ON public.athletes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.athlete_instructors ai
      WHERE ai.athlete_id = public.athletes.id
      AND ai.profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
  );

-- 2. Aggiorna Policy SELECT su couples per Istruttori
DROP POLICY IF EXISTS "Authenticated users can view couples" ON public.couples;
CREATE POLICY "Admin can view all couples"
  ON public.couples FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Instructors can view their linked couples"
  ON public.couples FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.athlete_instructors ai
      WHERE (ai.athlete_id = public.couples.athlete1_id OR ai.athlete_id = public.couples.athlete2_id)
      AND ai.profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
  );

-- 3. Aggiorna Policy per competition_entries (se presenti)
-- Assumiamo che le entries debbano seguire la stessa logica di visibilità degli atleti
DROP POLICY IF EXISTS "Authenticated users can view competition_entries" ON public.competition_entries;
CREATE POLICY "Admin can view all competition_entries"
  ON public.competition_entries FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Instructors can view their entries"
  ON public.competition_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.couples c
      JOIN public.athlete_instructors ai ON (ai.athlete_id = c.athlete1_id OR ai.athlete_id = c.athlete2_id)
      WHERE c.id = public.competition_entries.couple_id
      AND ai.profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
  );
