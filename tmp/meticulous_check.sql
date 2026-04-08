-- Meticulous check of the current state
SELECT count(*) as athletes_total FROM athletes WHERE is_deleted = false;
SELECT count(*) as athletes_with_partner FROM athletes WHERE partner_code IS NOT NULL AND is_deleted = false;
SELECT count(*) as couples_total FROM couples WHERE is_active = true;
