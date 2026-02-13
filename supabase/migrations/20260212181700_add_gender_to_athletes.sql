-- Add gender column to athletes table
ALTER TABLE public.athletes ADD COLUMN IF NOT EXISTS gender TEXT;

-- Update RLS policies is not needed as they usually cover ALL columns
-- but we might want to update some existing ones if they were column-specific.
-- Checking previous migrations, they use * or are general.
