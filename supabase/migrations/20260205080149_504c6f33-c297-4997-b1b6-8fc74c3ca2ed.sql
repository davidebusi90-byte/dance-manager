-- Add public read access for athletes table (needed for public enrollment page)
CREATE POLICY "Public can view athletes for enrollment" 
ON public.athletes 
FOR SELECT 
USING (true);

-- Add public read access for couples table (needed for public enrollment page)
CREATE POLICY "Public can view couples for enrollment" 
ON public.couples 
FOR SELECT 
USING (true);

-- Add public read access for competition_class_rules (needed for public enrollment page)
CREATE POLICY "Public can view class rules for enrollment" 
ON public.competition_class_rules 
FOR SELECT 
USING (true);

-- Add public read access for competitions (needed for public enrollment page)
CREATE POLICY "Public can view competitions for enrollment" 
ON public.competitions 
FOR SELECT 
USING (true);

-- Add public read access for competition_entries (to check existing enrollments)
CREATE POLICY "Public can view competition entries for enrollment" 
ON public.competition_entries 
FOR SELECT 
USING (true);

-- Allow public to insert competition entries (for the enrollment flow)
CREATE POLICY "Public can create competition entries" 
ON public.competition_entries 
FOR INSERT 
WITH CHECK (true);