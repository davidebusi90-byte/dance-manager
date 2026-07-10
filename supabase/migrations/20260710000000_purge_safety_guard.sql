-- ============================================================
-- MIGRATION: 20260710000000_purge_safety_guard.sql
-- Aggiunge un safety guard alla funzione purge_deleted_data.
-- La funzione originale viene protetta da un token di conferma
-- obbligatorio per prevenire esecuzioni accidentali.
-- ============================================================

-- 1. Crea la funzione wrapper con token di conferma obbligatorio
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
    -- Verifica che il token di conferma sia corretto
    IF confirmation_token IS DISTINCT FROM 'CONFIRM_PURGE_DATA' THEN
        RAISE EXCEPTION
            'Token di conferma non valido. Per procedere con l''anonimizzazione, '
            'passare il token: CONFIRM_PURGE_DATA. '
            'ATTENZIONE: questa operazione modifica i dati in modo irreversibile.';
    END IF;

    -- Solo gli admin possono eseguire questa funzione
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Accesso negato: solo gli amministratori possono eseguire la purga dei dati.';
    END IF;

    -- Delega alla funzione originale
    RETURN QUERY SELECT * FROM public.purge_deleted_data(retention_interval);
END;
$$;

COMMENT ON FUNCTION public.safe_purge_deleted_data IS
'Wrapper sicuro per purge_deleted_data. Richiede il token CONFIRM_PURGE_DATA '
'e che il chiamante sia admin. Usa questo al posto di purge_deleted_data diretta.';

-- 2. Revoca il permesso di esecuzione diretta di purge_deleted_data
--    agli utenti autenticati (forza l'uso di safe_purge_deleted_data)
REVOKE EXECUTE ON FUNCTION public.purge_deleted_data(INTERVAL) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purge_deleted_data(INTERVAL) FROM authenticated;

-- 3. Concede l'esecuzione SOLO della funzione sicura agli admin
--    (tramite SECURITY DEFINER la funzione gira già con i privilegi del definer)
GRANT EXECUTE ON FUNCTION public.safe_purge_deleted_data(TEXT, INTERVAL) TO authenticated;

-- 4. Registra questa modifica nell'audit log
DO $$
BEGIN
    INSERT INTO public.privacy_audit_logs (
        table_name, record_id, action, new_data, changed_by
    ) VALUES (
        'system.functions',
        gen_random_uuid(),
        'SECURITY_UPDATE',
        jsonb_build_object(
            'description', 'Aggiunto safety guard a purge_deleted_data',
            'migration',    '20260710000000_purge_safety_guard',
            'applied_at',   now()
        ),
        NULL  -- Applicato via migration, non da utente
    );
EXCEPTION WHEN OTHERS THEN
    -- Non blocca la migration se privacy_audit_logs non è disponibile
    NULL;
END $$;
