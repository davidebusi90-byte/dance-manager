-- Detailed investigation for Jacopo and Daria
SELECT id, code, first_name, last_name, class, discipline_info, is_deleted, created_at, updated_at 
FROM athletes 
WHERE lower(last_name) IN ('bombardi', 'lazzari');

-- Check for associated couples
SELECT * FROM couples 
WHERE athlete1_id IN (SELECT id FROM athletes WHERE lower(last_name) IN ('bombardi', 'lazzari'))
   OR athlete2_id IN (SELECT id FROM athletes WHERE lower(last_name) IN ('bombardi', 'lazzari'));

-- Check the last sync logs to see what arrived in the raw payload for them
SELECT id, created_at, message FROM sync_logs ORDER BY created_at DESC LIMIT 10;
