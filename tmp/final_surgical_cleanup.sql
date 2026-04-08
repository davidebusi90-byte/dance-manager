-- Deep Surgical Cleanup for Jacopo Bombardi and Daria Lazzari

-- 1. Identify IDs for deletion to be precise
DO $$
DECLARE
    athlete_ids UUID[];
BEGIN
    SELECT array_agg(id) INTO athlete_ids FROM athletes 
    WHERE (lower(first_name) = 'jacopo' AND lower(last_name) = 'bombardi')
       OR (lower(first_name) = 'daria' AND lower(last_name) = 'lazzari');

    IF athlete_ids IS NOT NULL THEN
        -- Delete associated couples
        DELETE FROM couples WHERE athlete1_id = ANY(athlete_ids) OR athlete2_id = ANY(athlete_ids);
        
        -- Delete athletes
        DELETE FROM athletes WHERE id = ANY(athlete_ids);
        
        RAISE NOTICE 'Deleted % athletes and associated couples', array_length(athlete_ids, 1);
    ELSE
        RAISE NOTICE 'No athletes found to delete';
    END IF;
END $$;

-- 2. Clear sync logs that might contain their names in message or raw_payload
-- (Matches "bombardi" or "lazzari" case-insensitive)
DELETE FROM sync_logs 
WHERE lower(message) LIKE '%bombardi%' 
   OR lower(message) LIKE '%lazzari%'
   OR raw_payload::text ILIKE '%bombardi%'
   OR raw_payload::text ILIKE '%lazzari%';
