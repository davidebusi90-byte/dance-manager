-- Sync discipline_info from couples to individual athletes
-- This ensures the athletes table is the source of truth for all components

-- 1. First, ensure the column exists
ALTER TABLE public.athletes ADD COLUMN IF NOT EXISTS discipline_info JSONB DEFAULT '{}'::jsonb;

-- 2. Update athletes by merging discipline_info from all couples they belong to
-- We use a temporary aggregation to pick the "best" class if an athlete is in multiple couples with different classes (rare)
WITH athlete_classes AS (
    SELECT 
        athlete_id,
        jsonb_object_agg(discipline, class) as merged_info
    FROM (
        -- Unnest all discipline_info from couples for each athlete
        SELECT 
            athlete1_id as athlete_id,
            key as discipline,
            value#>>'{}' as class
        FROM public.couples, jsonb_each(discipline_info)
        WHERE discipline_info IS NOT NULL
        UNION ALL
        SELECT 
            athlete2_id as athlete_id,
            key as discipline,
            value#>>'{}' as class
        FROM public.couples, jsonb_each(discipline_info)
        WHERE discipline_info IS NOT NULL
    ) sub
    GROUP BY athlete_id
)
UPDATE public.athletes a
SET discipline_info = ac.merged_info
FROM athlete_classes ac
WHERE a.id = ac.athlete_id;

COMMENT ON COLUMN public.athletes.discipline_info IS 'Aggregated discipline classes synced from couples and updated via API';
