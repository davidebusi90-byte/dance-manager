-- GDPR & Privacy Compliance Base Migration
-- This migration adds core tables and functions for consent tracking and audit logging.

-- 1. CONSENT TRACKING
-- Table to store user consent to policies and terms
CREATE TABLE IF NOT EXISTS public.user_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    consent_type TEXT NOT NULL, -- 'privacy_policy', 'terms_of_service', 'marketing', 'third_party_sharing'
    version TEXT NOT NULL, -- Version of the policy at the time of consent
    is_accepted BOOLEAN NOT NULL DEFAULT false,
    accepted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    ip_address TEXT, -- Opzionale: utile per dimostrazione legale (ma attenzione a GDPR minimizzazione)
    user_agent TEXT,
    UNIQUE (profile_id, consent_type, version)
);

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

-- Consent RLS: Users can view their own consents, admins can view all.
CREATE POLICY "Users can view own consents" ON public.user_consents
    FOR SELECT TO authenticated
    USING (profile_id = public.get_instructor_profile_id(auth.uid()));

CREATE POLICY "Admins can view all consents" ON public.user_consents
    FOR SELECT TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

-- 2. PRIVACY AUDIT LOGGING
-- Table to store modifications to sensitive PII
CREATE TABLE IF NOT EXISTS public.privacy_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    old_data JSONB,
    new_data JSONB,
    changed_by UUID REFERENCES auth.users(id), -- Actor who performed the change
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index for performance on searches
CREATE INDEX idx_privacy_audit_logs_record ON public.privacy_audit_logs (table_name, record_id);
CREATE INDEX idx_privacy_audit_logs_actor ON public.privacy_audit_logs (changed_by);

ALTER TABLE public.privacy_audit_logs ENABLE ROW LEVEL SECURITY;

-- Audit RLS: ONLY admins can view audit logs.
CREATE POLICY "Admins can view audit logs" ON public.privacy_audit_logs
    FOR SELECT TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

-- 3. TRIGGER FUNCTION FOR AUDITING
CREATE OR REPLACE FUNCTION public.log_privacy_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old_data JSONB := NULL;
    v_new_data JSONB := NULL;
    v_changed_by UUID := auth.uid(); -- Get executing user from context
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        
        -- Don't log if sensitive data didn't change (optional: we can filter specific columns)
        -- For now, we log the whole row if any change happens to simplify audit trails.
        INSERT INTO public.privacy_audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
        VALUES (TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, OLD.id, TG_OP, v_old_data, v_new_data, v_changed_by);
        
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO public.privacy_audit_logs (table_name, record_id, action, new_data, changed_by)
        VALUES (TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, NEW.id, TG_OP, to_jsonb(NEW), v_changed_by);
        
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO public.privacy_audit_logs (table_name, record_id, action, old_data, changed_by)
        VALUES (TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, OLD.id, TG_OP, to_jsonb(OLD), v_changed_by);
    END IF;
    
    RETURN NULL;
END;
$$;

-- 4. ATTACH TRIGGERS TO SENSITIVE TABLES
-- Using AFTER triggers so we log only successful transactions.
DROP TRIGGER IF EXISTS audit_athletes_privacy ON public.athletes;
CREATE TRIGGER audit_athletes_privacy
AFTER INSERT OR UPDATE OR DELETE ON public.athletes
FOR EACH ROW EXECUTE FUNCTION public.log_privacy_changes();

DROP TRIGGER IF EXISTS audit_profiles_privacy ON public.profiles;
CREATE TRIGGER audit_profiles_privacy
AFTER INSERT OR UPDATE OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.log_privacy_changes();

COMMENT ON TABLE public.user_consents IS 'Stores user acceptance of privacy policies and terms of service.';
COMMENT ON TABLE public.privacy_audit_logs IS 'Audit trail for PII changes, strictly accessible by Admins only.';
