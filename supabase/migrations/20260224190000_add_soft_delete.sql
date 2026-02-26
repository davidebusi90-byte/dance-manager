-- Add is_deleted column to athletes and competitions
ALTER TABLE public.athletes ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.competitions ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

-- Update RLS policies to respect is_deleted for athletes (admins see everything)
DROP POLICY if exists "Authenticated users can view athletes" ON public.athletes;
DROP POLICY if exists "Authenticated users can view non-deleted athletes" ON public.athletes;
CREATE POLICY "Authenticated users can view non-deleted athletes"
ON public.athletes FOR SELECT
TO authenticated
USING (is_deleted = false OR public.has_role(auth.uid(), 'admin'));

-- Update RLS policies to respect is_deleted for competitions
DROP POLICY if exists "Authenticated users can view competitions" ON public.competitions;
DROP POLICY if exists "Authenticated users can view non-deleted competitions" ON public.competitions;
CREATE POLICY "Authenticated users can view non-deleted competitions"
ON public.competitions FOR SELECT
TO authenticated
USING (is_deleted = false OR public.has_role(auth.uid(), 'admin'));
