-- Add late fee deadline column to competitions table
ALTER TABLE public.competitions 
ADD COLUMN IF NOT EXISTS late_fee_deadline date;

-- Add comment to explain the field
COMMENT ON COLUMN public.competitions.late_fee_deadline IS 'Deadline after which a late fee applies for registration';