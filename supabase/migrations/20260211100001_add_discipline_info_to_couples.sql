-- Add discipline_info column to couples table to store specific classes for each discipline
ALTER TABLE public.couples ADD COLUMN IF NOT EXISTS discipline_info JSONB DEFAULT '{}'::jsonb;

-- Comment on column for clarity
COMMENT ON COLUMN public.couples.discipline_info IS 'Store mapping of discipline to its specific class, e.g. {"latino": "A", "standard": "B1"}';
