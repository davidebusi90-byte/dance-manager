-- Aggiunge le policy mancanti per permettere agli utenti di inserire ed aggiornare il proprio consenso Privacy

CREATE POLICY "Users can insert own consents" ON public.user_consents
    FOR INSERT TO authenticated
    WITH CHECK (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own consents" ON public.user_consents
    FOR UPDATE TO authenticated
    USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));
