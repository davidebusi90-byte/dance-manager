
-- Migration: Move all entries from Star Cup Verona to International Senior Cup
-- This handles the one-time request to fix the enrollment issue.

DO $$
DECLARE
    verona_id UUID;
    senior_cup_id UUID;
BEGIN
    -- Find the Star Cup Verona ID (allowing for slight variations in name)
    SELECT id INTO verona_id 
    FROM public.competitions 
    WHERE name ILIKE '%Verona%' OR name ILIKE '%Lago di Garda%'
    LIMIT 1;

    -- Find the International Senior Cup ID
    SELECT id INTO senior_cup_id 
    FROM public.competitions 
    WHERE name ILIKE '%International Senior Cup%'
    LIMIT 1;

    IF verona_id IS NOT NULL AND senior_cup_id IS NOT NULL THEN
        -- Move all entries
        UPDATE public.competition_entries
        SET competition_id = senior_cup_id
        WHERE competition_id = verona_id;

        RAISE NOTICE 'Moved entries from % to %', verona_id, senior_cup_id;
    ELSE
        IF verona_id IS NULL THEN
            RAISE WARNING 'Could not find Star Cup Verona competition';
        END IF;
        IF senior_cup_id IS NULL THEN
            RAISE WARNING 'Could not find International Senior Cup competition';
        END IF;
    END IF;
END $$;
