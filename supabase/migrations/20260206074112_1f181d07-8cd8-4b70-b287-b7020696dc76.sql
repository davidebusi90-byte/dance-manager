-- Add responsabili column to athletes table to store multiple supervisors
ALTER TABLE public.athletes ADD COLUMN IF NOT EXISTS responsabili text[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN public.athletes.responsabili IS 'Array of supervisor/responsible person names from Excel import';