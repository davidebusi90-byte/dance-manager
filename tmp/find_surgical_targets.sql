SELECT id, first_name, last_name, code FROM athletes 
WHERE lower(last_name) LIKE '%bombardi%' 
   OR lower(last_name) LIKE '%lazzari%'
   OR lower(first_name) LIKE '%jacopo%'
   OR lower(first_name) LIKE '%daria%';

SELECT id, athlete1_id, athlete2_id FROM couples
WHERE athlete1_id IN (
    SELECT id FROM athletes 
    WHERE lower(last_name) IN ('bombardi', 'lazzari')
) OR athlete2_id IN (
    SELECT id FROM athletes 
    WHERE lower(last_name) IN ('bombardi', 'lazzari')
);
