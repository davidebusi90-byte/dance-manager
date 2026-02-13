-- Normalize all classes to UPPERCASE for consistent comparison
UPDATE public.athletes SET class = UPPER(class) WHERE class IS NOT NULL;
UPDATE public.couples SET class = UPPER(class) WHERE class IS NOT NULL;
UPDATE public.competition_class_rules SET class = UPPER(class) WHERE class IS NOT NULL;

-- Normalize allowed_classes array in competition_event_types
UPDATE public.competition_event_types 
SET allowed_classes = (
  SELECT array_agg(UPPER(u)) 
  FROM unnest(allowed_classes) AS u
)
WHERE allowed_classes IS NOT NULL;
