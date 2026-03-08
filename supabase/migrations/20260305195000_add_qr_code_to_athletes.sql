-- Add qr_code column to athletes table
ALTER TABLE public.athletes ADD COLUMN qr_code TEXT;

-- Add index on qr_code for faster lookups
CREATE INDEX idx_athletes_qr_code ON public.athletes(qr_code);

-- Update RLS if necessary (athletes table already has RLS enabled)
-- The existing policies should cover the new column if they use SELECT * or specific column lists are updated.
-- Authenticated users can view all columns by default based on:
-- CREATE POLICY "Authenticated users can view athletes" ON public.athletes FOR SELECT TO authenticated USING (true);
