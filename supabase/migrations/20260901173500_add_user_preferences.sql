-- Aggiunta colonna preferences alla tabella profiles per memorizzare dashboard custom e impostazioni utente
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;
