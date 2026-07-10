-- ============================================================
-- MIGRATION: 20260710000001_extend_retention_90_days.sql
-- Estende il periodo di retention da 30 giorni a 90 giorni.
-- Dà quasi 3 mesi di margine per recuperare dati eliminati.
-- ============================================================

-- Aggiorna la funzione purge_deleted_data con il nuovo default di 90 giorni
CREATE OR REPLACE FUNCTION public.purge_deleted_data(retention_interval INTERVAL DEFAULT '90 days')
RETURNS TABLE (processed_count INTEGER, table_name TEXT, operation_type TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rows_affected INTEGER;
BEGIN
    -- ANONIMIZZAZIONE (non cancellazione fisica) degli atleti soft-deleted
    -- dopo il periodo di retention. Preserva l'integrità referenziale per
    -- la storia delle competizioni pur rispettando il diritto all'oblio GDPR.

    -- Anonimizza Atleti
    UPDATE public.athletes
    SET
        first_name              = '[ANONIMIZZATO]',
        last_name               = '[ANONIMIZZATO]',
        email                   = NULL,
        phone                   = NULL,
        notes                   = NULL,
        responsabili            = NULL,
        medical_certificate_expiry = NULL,
        qr_code                 = NULL,
        discipline_info         = NULL,
        updated_at              = now()
    WHERE deleted_at < (now() - retention_interval)
      AND first_name != '[ANONIMIZZATO]'; -- Non ri-elabora già anonimizzati

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    processed_count := v_rows_affected;
    table_name      := 'athletes';
    operation_type  := 'ANONYMIZED';
    RETURN NEXT;

    -- Anonimizza Profili (Istruttori)
    UPDATE public.profiles
    SET
        full_name  = '[ANONIMIZZATO]',
        email      = NULL,
        phone      = NULL,
        updated_at = now()
    WHERE deleted_at < (now() - retention_interval)
      AND full_name != '[ANONIMIZZATO]';

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    processed_count := v_rows_affected;
    table_name      := 'profiles';
    operation_type  := 'ANONYMIZED';
    RETURN NEXT;

    -- HARD DELETE: Log di audit privacy (retention: 24 mesi per GDPR)
    DELETE FROM public.privacy_audit_logs
    WHERE changed_at < (now() - interval '24 months');

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    processed_count := v_rows_affected;
    table_name      := 'privacy_audit_logs';
    operation_type  := 'PURGED';
    RETURN NEXT;

END;
$$;

COMMENT ON FUNCTION public.purge_deleted_data IS
'Anonimizza i record soft-deleted dopo 90 giorni (aggiornato da 30) e '
'purga i log di audit più vecchi di 24 mesi. '
'NON chiamare direttamente: usa safe_purge_deleted_data() che richiede '
'il token di conferma CONFIRM_PURGE_DATA.';

-- Aggiorna anche il wrapper sicuro per usare il nuovo default
CREATE OR REPLACE FUNCTION public.safe_purge_deleted_data(
    confirmation_token TEXT,
    retention_interval INTERVAL DEFAULT '90 days'
)
RETURNS TABLE (processed_count INTEGER, table_name TEXT, operation_type TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF confirmation_token IS DISTINCT FROM 'CONFIRM_PURGE_DATA' THEN
        RAISE EXCEPTION
            'Token di conferma non valido. Passare: CONFIRM_PURGE_DATA';
    END IF;

    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Accesso negato: solo gli amministratori possono eseguire la purga dei dati.';
    END IF;

    RETURN QUERY SELECT * FROM public.purge_deleted_data(retention_interval);
END;
$$;
