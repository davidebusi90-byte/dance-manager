-- Aggiunge la colonna per associare una gara alla sua edizione dell'anno precedente
ALTER TABLE public.competitions
ADD COLUMN previous_competition_id UUID REFERENCES public.competitions(id) ON DELETE SET NULL;
