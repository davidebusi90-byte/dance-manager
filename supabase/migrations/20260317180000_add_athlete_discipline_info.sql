-- Migration to add discipline_info column to athletes table
ALTER TABLE public.athletes ADD COLUMN IF NOT EXISTS discipline_info JSONB DEFAULT '{}'::jsonb;

-- Comment for clarity
COMMENT ON COLUMN public.athletes.discipline_info IS 'Store mapping of discipline to its specific class for the individual athlete, e.g. {"latino": "A", "standard": "B1"}';
