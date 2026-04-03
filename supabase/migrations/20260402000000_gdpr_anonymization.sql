-- GDPR Refinement: Anonymization and Log Retention
-- This migration updates the physical deletion logic to anonymization
-- and implements a 24-month retention policy for audit logs.

-- 1. UPDATE PURGE FUNCTION FOR ANONYMIZATION
DROP FUNCTION IF EXISTS public.purge_deleted_data(INTERVAL);
CREATE OR REPLACE FUNCTION public.purge_deleted_data(retention_interval INTERVAL DEFAULT '30 days')
RETURNS TABLE (processed_count INTEGER, table_name TEXT, operation_type TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rows_affected INTEGER;
BEGIN
    -- This function now performs ANONYMIZATION instead of DELETE for athletes/profiles.
    -- This preserves referential integrity for competition history while complying with the "Right to be Forgotten".
    
    -- Anonymize Athletes
    UPDATE public.athletes
    SET 
        first_name = '[ANONIMIZZATO]',
        last_name = '[ANONIMIZZATO]',
        email = NULL,
        phone = NULL,
        notes = NULL,
        responsabili = NULL,
        medical_certificate_expiry = NULL,
        qr_code = NULL,
        discipline_info = NULL, -- Clear sensitive notes if any
        updated_at = now()
    WHERE deleted_at < (now() - retention_interval)
      AND first_name != '[ANONIMIZZATO]'; -- Don't re-process already anonymized
    
    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    processed_count := v_rows_affected;
    table_name := 'athletes';
    operation_type := 'ANONYMIZED';
    RETURN NEXT;

    -- Anonymize Profiles (Instructors)
    UPDATE public.profiles
    SET 
        full_name = '[ANONIMIZZATO]',
        email = NULL,
        phone = NULL,
        updated_at = now()
    WHERE deleted_at < (now() - retention_interval)
      AND full_name != '[ANONIMIZZATO]';
    
    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    processed_count := v_rows_affected;
    table_name := 'profiles';
    operation_type := 'ANONYMIZED';
    RETURN NEXT;

    -- HARD DELETE: Privacy Audit Logs (Retention policy: 24 months)
    DELETE FROM public.privacy_audit_logs
    WHERE changed_at < (now() - interval '24 months');
    
    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    processed_count := v_rows_affected;
    table_name := 'privacy_audit_logs';
    operation_type := 'PURGED';
    RETURN NEXT;

END;
$$;

COMMENT ON FUNCTION public.purge_deleted_data IS 'Performs data anonymization for soft-deleted records and purges old audit logs (>24 months).';
