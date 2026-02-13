-- Rename existing events to match new discipline names in UI
-- This ensures that existing configured events remain visible and editable in the Admin Panel

-- 'Standard - ' -> 'Danze Standard - '
-- Length of 'Standard - ' is 11 characters. We take substring from 12.
UPDATE competition_event_types
SET event_name = 'Danze Standard - ' || SUBSTRING(event_name FROM 12)
WHERE event_name LIKE 'Standard - %';

-- 'Latini - ' -> 'Danze Latino Americane - '
-- Length of 'Latini - ' is 9 characters. We take substring from 10.
UPDATE competition_event_types
SET event_name = 'Danze Latino Americane - ' || SUBSTRING(event_name FROM 10)
WHERE event_name LIKE 'Latini - %';
