-- =============================================================
-- admin_create_instructor
-- Crea un nuovo utente istruttore direttamente nel DB.
-- Da chiamare solo da utenti con ruolo 'admin' (SECURITY DEFINER).
-- Richiede l'estensione pgcrypto per l'hashing della password.
-- =============================================================

-- Abilita pgcrypto nello schema extensions (default Supabase)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.admin_create_instructor(
  p_email    text,
  p_password text,
  p_full_name text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id       uuid := gen_random_uuid();
  v_encrypted_pw  text;
  v_now           timestamptz := now();
BEGIN
  -- 0. Verifica che chi chiama sia admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Accesso negato: solo gli admin possono creare istruttori.');
  END IF;

  -- Valida input
  IF p_email IS NULL OR p_email = '' THEN
    RETURN json_build_object('success', false, 'error', 'Email obbligatoria.');
  END IF;
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RETURN json_build_object('success', false, 'error', 'Password troppo corta (min 6 caratteri).');
  END IF;
  IF p_full_name IS NULL OR p_full_name = '' THEN
    RETURN json_build_object('success', false, 'error', 'Nome completo obbligatorio.');
  END IF;

  -- Controlla che l'email non esista già
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = lower(trim(p_email))) THEN
    RETURN json_build_object('success', false, 'error', 'Esiste già un utente con questa email.');
  END IF;

  -- 1. Hash della password
  v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf'));

  -- 2. Inserimento in auth.users
  INSERT INTO auth.users (
    id, instance_id, aud, role,
    email, encrypted_password,
    email_confirmed_at,
    created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin,
    confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    lower(trim(p_email)),
    v_encrypted_pw,
    v_now,
    v_now, v_now,
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name),
    false,
    '', '', '', ''
  );

  -- 3. Inserimento in auth.identities
  INSERT INTO auth.identities (
    id, user_id, provider_id, provider,
    identity_data,
    created_at, updated_at, last_sign_in_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    lower(trim(p_email)),
    'email',
    jsonb_build_object('sub', v_user_id::text, 'email', lower(trim(p_email))),
    v_now, v_now, v_now
  );

  -- 4. Upsert del profilo (il trigger handle_new_user potrebbe averlo già creato)
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (v_user_id, p_full_name, lower(trim(p_email)))
  ON CONFLICT (user_id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        email     = EXCLUDED.email;

  -- 5. Assegna ruolo instructor
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'instructor')
  ON CONFLICT DO NOTHING;

  RETURN json_build_object(
    'success',   true,
    'user_id',   v_user_id,
    'email',     lower(trim(p_email)),
    'full_name', p_full_name
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Permetti agli utenti autenticati di chiamare la funzione
-- (il controllo admin è interno alla funzione stessa)
GRANT EXECUTE ON FUNCTION public.admin_create_instructor(text, text, text) TO authenticated;
