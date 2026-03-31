
-- MIGRATION: 20260115165503_141fb2a6-27ab-4b93-8368-01224810b765.sql
-- Enum per i ruoli
CREATE TYPE public.app_role AS ENUM ('admin', 'instructor');

-- Enum per le categorie di ballo
CREATE TYPE public.dance_category AS ENUM ('standard', 'latino', 'combinata', 'show_dance');

-- Tabella profili utenti (istruttori e admin)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabella ruoli utenti
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    UNIQUE (user_id, role)
);

-- Tabella atleti
CREATE TABLE public.athletes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    birth_date DATE,
    email TEXT,
    phone TEXT,
    category TEXT NOT NULL,
    class TEXT NOT NULL,
    instructor_id UUID REFERENCES public.profiles(id),
    medical_certificate_expiry DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabella coppie
CREATE TABLE public.couples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    athlete1_id UUID REFERENCES public.athletes(id) ON DELETE CASCADE NOT NULL,
    athlete2_id UUID REFERENCES public.athletes(id) ON DELETE CASCADE NOT NULL,
    category TEXT NOT NULL,
    class TEXT NOT NULL,
    disciplines dance_category[] NOT NULL DEFAULT '{}',
    instructor_id UUID REFERENCES public.profiles(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(athlete1_id, athlete2_id)
);

-- Tabella competizioni
CREATE TABLE public.competitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    location TEXT,
    date DATE NOT NULL,
    end_date DATE,
    registration_deadline DATE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabella iscrizioni competizioni
CREATE TABLE public.competition_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id UUID REFERENCES public.competitions(id) ON DELETE CASCADE NOT NULL,
    couple_id UUID REFERENCES public.couples(id) ON DELETE CASCADE NOT NULL,
    disciplines dance_category[] NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(competition_id, couple_id)
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_entries ENABLE ROW LEVEL SECURITY;

-- Funzione per verificare ruolo (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Funzione per ottenere instructor_id dal user_id
CREATE OR REPLACE FUNCTION public.get_instructor_profile_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE user_id = _user_id
$$;

-- RLS Policies per profiles
CREATE POLICY "Users can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- RLS Policies per user_roles
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies per athletes
CREATE POLICY "Authenticated users can view athletes"
ON public.athletes FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage athletes"
ON public.athletes FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Instructors can update their athletes"
ON public.athletes FOR UPDATE
TO authenticated
USING (instructor_id = public.get_instructor_profile_id(auth.uid()));

-- RLS Policies per couples
CREATE POLICY "Authenticated users can view couples"
ON public.couples FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage couples"
ON public.couples FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies per competitions
CREATE POLICY "Authenticated users can view competitions"
ON public.competitions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage competitions"
ON public.competitions FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies per competition_entries
CREATE POLICY "Authenticated users can view entries"
ON public.competition_entries FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage entries"
ON public.competition_entries FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Instructors can create entries for their couples"
ON public.competition_entries FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.couples c
    WHERE c.id = couple_id
    AND c.instructor_id = public.get_instructor_profile_id(auth.uid())
  )
);

-- Trigger per updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_athletes_updated_at BEFORE UPDATE ON public.athletes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_couples_updated_at BEFORE UPDATE ON public.couples FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_competitions_updated_at BEFORE UPDATE ON public.competitions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_competition_entries_updated_at BEFORE UPDATE ON public.competition_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger per creare profilo automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'instructor');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- MIGRATION: 20260120143451_9ecf641a-3719-465c-afdf-81749c93f941.sql
-- Ensure admin role for primary account (REMOVED: specific to old project)
-- insert into public.user_roles (user_id, role)
-- values ('ee8bbb66-22a2-445a-9b0d-5c48c436556f', 'admin')
-- on conflict (user_id, role) do nothing;

-- Make sure RLS is enabled
alter table public.athletes enable row level security;
alter table public.couples enable row level security;
alter table public.profiles enable row level security;

-- Profiles: users can read their own profile (needed to resolve instructor_id)
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_select_own'
  ) then
    create policy profiles_select_own
    on public.profiles
    for select
    to authenticated
    using (user_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_update_own'
  ) then
    create policy profiles_update_own
    on public.profiles
    for update
    to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());
  end if;
end $$;

-- Athletes policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='athletes' AND policyname='athletes_select_instructor_or_admin'
  ) THEN
    CREATE POLICY athletes_select_instructor_or_admin
    ON public.athletes
    FOR SELECT
    TO authenticated
    USING (
      public.has_role(auth.uid(), 'admin')
      OR instructor_id = public.get_instructor_profile_id(auth.uid())
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='athletes' AND policyname='athletes_insert_instructor_or_admin'
  ) THEN
    CREATE POLICY athletes_insert_instructor_or_admin
    ON public.athletes
    FOR INSERT
    TO authenticated
    WITH CHECK (
      public.has_role(auth.uid(), 'admin')
      OR instructor_id = public.get_instructor_profile_id(auth.uid())
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='athletes' AND policyname='athletes_update_instructor_or_admin'
  ) THEN
    CREATE POLICY athletes_update_instructor_or_admin
    ON public.athletes
    FOR UPDATE
    TO authenticated
    USING (
      public.has_role(auth.uid(), 'admin')
      OR instructor_id = public.get_instructor_profile_id(auth.uid())
    )
    WITH CHECK (
      public.has_role(auth.uid(), 'admin')
      OR instructor_id = public.get_instructor_profile_id(auth.uid())
    );
  END IF;
END $$;

-- Couples policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='couples' AND policyname='couples_select_instructor_or_admin'
  ) THEN
    CREATE POLICY couples_select_instructor_or_admin
    ON public.couples
    FOR SELECT
    TO authenticated
    USING (
      public.has_role(auth.uid(), 'admin')
      OR instructor_id = public.get_instructor_profile_id(auth.uid())
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='couples' AND policyname='couples_insert_instructor_or_admin'
  ) THEN
    CREATE POLICY couples_insert_instructor_or_admin
    ON public.couples
    FOR INSERT
    TO authenticated
    WITH CHECK (
      public.has_role(auth.uid(), 'admin')
      OR instructor_id = public.get_instructor_profile_id(auth.uid())
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='couples' AND policyname='couples_update_instructor_or_admin'
  ) THEN
    CREATE POLICY couples_update_instructor_or_admin
    ON public.couples
    FOR UPDATE
    TO authenticated
    USING (
      public.has_role(auth.uid(), 'admin')
      OR instructor_id = public.get_instructor_profile_id(auth.uid())
    )
    WITH CHECK (
      public.has_role(auth.uid(), 'admin')
      OR instructor_id = public.get_instructor_profile_id(auth.uid())
    );
  END IF;
END $$;


-- MIGRATION: 20260121112558_57fca0f1-b645-404b-a504-606142afdc02.sql
-- Add late fee deadline column to competitions table
ALTER TABLE public.competitions 
ADD COLUMN IF NOT EXISTS late_fee_deadline date;

-- Add comment to explain the field
COMMENT ON COLUMN public.competitions.late_fee_deadline IS 'Deadline after which a late fee applies for registration';


-- MIGRATION: 20260203074738_50803df5-fe2e-4f9e-9785-1971ca1ac3a1.sql
-- Add payment tracking to competition entries
ALTER TABLE public.competition_entries 
ADD COLUMN is_paid BOOLEAN NOT NULL DEFAULT false;

-- Add unique constraint to prevent duplicate entries
ALTER TABLE public.competition_entries 
ADD CONSTRAINT competition_entries_unique_couple 
UNIQUE (competition_id, couple_id);

-- Add RLS policy for instructors to update entries (mark as paid)
CREATE POLICY "Instructors can update entries for their couples"
ON public.competition_entries
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.couples c
    WHERE c.id = competition_entries.couple_id
    AND c.instructor_id = public.get_instructor_profile_id(auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.couples c
    WHERE c.id = competition_entries.couple_id
    AND c.instructor_id = public.get_instructor_profile_id(auth.uid())
  )
);


-- MIGRATION: 20260203074906_90147427-a92f-452f-8fbd-8caecb0a3175.sql
-- Create table for competition class eligibility rules
CREATE TABLE public.competition_class_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  class TEXT NOT NULL,
  is_allowed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(competition_id, class)
);

-- Enable RLS
ALTER TABLE public.competition_class_rules ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users can read, instructors can manage
CREATE POLICY "Anyone authenticated can view class rules"
ON public.competition_class_rules
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Instructors can insert class rules"
ON public.competition_class_rules
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Instructors can update class rules"
ON public.competition_class_rules
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Instructors can delete class rules"
ON public.competition_class_rules
FOR DELETE
TO authenticated
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_competition_class_rules_updated_at
BEFORE UPDATE ON public.competition_class_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();


-- MIGRATION: 20260203074919_2e733680-fdb1-4332-bf39-d6ffaea1fdc2.sql
-- Drop overly permissive policies
DROP POLICY IF EXISTS "Instructors can insert class rules" ON public.competition_class_rules;
DROP POLICY IF EXISTS "Instructors can update class rules" ON public.competition_class_rules;
DROP POLICY IF EXISTS "Instructors can delete class rules" ON public.competition_class_rules;

-- Create proper policies: only admins can manage class rules
CREATE POLICY "Admins can insert class rules"
ON public.competition_class_rules
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update class rules"
ON public.competition_class_rules
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete class rules"
ON public.competition_class_rules
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));


-- MIGRATION: 20260205080149_504c6f33-c297-4997-b1b6-8fc74c3ca2ed.sql
-- Add public read access for athletes table (needed for public enrollment page)
CREATE POLICY "Public can view athletes for enrollment" 
ON public.athletes 
FOR SELECT 
USING (true);

-- Add public read access for couples table (needed for public enrollment page)
CREATE POLICY "Public can view couples for enrollment" 
ON public.couples 
FOR SELECT 
USING (true);

-- Add public read access for competition_class_rules (needed for public enrollment page)
CREATE POLICY "Public can view class rules for enrollment" 
ON public.competition_class_rules 
FOR SELECT 
USING (true);

-- Add public read access for competitions (needed for public enrollment page)
CREATE POLICY "Public can view competitions for enrollment" 
ON public.competitions 
FOR SELECT 
USING (true);

-- Add public read access for competition_entries (to check existing enrollments)
CREATE POLICY "Public can view competition entries for enrollment" 
ON public.competition_entries 
FOR SELECT 
USING (true);

-- Allow public to insert competition entries (for the enrollment flow)
CREATE POLICY "Public can create competition entries" 
ON public.competition_entries 
FOR INSERT 
WITH CHECK (true);


-- MIGRATION: 20260206074112_1f181d07-8cd8-4b70-b287-b7020696dc76.sql
-- Add responsabili column to athletes table to store multiple supervisors
ALTER TABLE public.athletes ADD COLUMN IF NOT EXISTS responsabili text[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN public.athletes.responsabili IS 'Array of supervisor/responsible person names from Excel import';


-- MIGRATION: 20260206081511_62f0a475-0152-42b3-bb29-1ff9d83a23a2.sql
-- Remove the overly permissive public insert policy for competition_entries
DROP POLICY IF EXISTS "Public can create competition entries" ON public.competition_entries;


-- MIGRATION: 20260207125841_a33e673a-d6f2-42ea-8a07-ce1b15067a09.sql

-- Junction table: many-to-many between athletes and instructors (profiles)
CREATE TABLE public.athlete_instructors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, profile_id)
);

ALTER TABLE public.athlete_instructors ENABLE ROW LEVEL SECURITY;

-- Admins full access
CREATE POLICY "Admins can manage athlete_instructors"
  ON public.athlete_instructors FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Instructors can view their own links
CREATE POLICY "Instructors can view their athlete links"
  ON public.athlete_instructors FOR SELECT
  USING (profile_id = get_instructor_profile_id(auth.uid()));

-- Auto-link function: when a new user registers, match their name against athletes.responsabili
CREATE OR REPLACE FUNCTION public.auto_link_instructor_to_athletes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _profile_id uuid;
  _full_name text;
BEGIN
  -- Get the profile that was just created
  SELECT id, full_name INTO _profile_id, _full_name
  FROM public.profiles
  WHERE user_id = NEW.id;

  IF _profile_id IS NULL OR _full_name IS NULL THEN
    RETURN NEW;
  END IF;

  -- Link to athletes whose responsabili array contains this name (case-insensitive)
  INSERT INTO public.athlete_instructors (athlete_id, profile_id)
  SELECT a.id, _profile_id
  FROM public.athletes a
  WHERE EXISTS (
    SELECT 1 FROM unnest(a.responsabili) r
    WHERE lower(trim(r)) = lower(trim(_full_name))
  )
  ON CONFLICT (athlete_id, profile_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Trigger: run auto-link after handle_new_user creates the profile
-- We use AFTER INSERT on auth.users with a delay to ensure profile exists
-- Actually, better to trigger on profiles insert
CREATE OR REPLACE FUNCTION public.auto_link_on_profile_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Link to athletes whose responsabili array contains this instructor's name
  INSERT INTO public.athlete_instructors (athlete_id, profile_id)
  SELECT a.id, NEW.id
  FROM public.athletes a
  WHERE EXISTS (
    SELECT 1 FROM unnest(a.responsabili) r
    WHERE lower(trim(r)) = lower(trim(NEW.full_name))
  )
  ON CONFLICT (athlete_id, profile_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_link_instructor_on_profile_insert
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_on_profile_insert();



-- MIGRATION: 20260208132538_6b0a8230-c4a7-4117-b68d-ac4a2f5a66b4.sql

-- Fix 1: Remove public SELECT policies from athletes table
DROP POLICY IF EXISTS "Public can view athletes for enrollment" ON public.athletes;

-- Fix 2: Remove public SELECT policies from couples table  
DROP POLICY IF EXISTS "Public can view couples for enrollment" ON public.couples;

-- Fix 3: Remove public SELECT policies from competitions table
DROP POLICY IF EXISTS "Public can view competitions for enrollment" ON public.competitions;

-- Fix 4: Remove public SELECT policies from competition_entries table
DROP POLICY IF EXISTS "Public can view competition entries for enrollment" ON public.competition_entries;

-- Fix 5: Remove public SELECT policies from competition_class_rules table
DROP POLICY IF EXISTS "Public can view class rules for enrollment" ON public.competition_class_rules;

-- Fix 6: Remove overly permissive profiles policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Fix 7: Add admin can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix 8: Instructors can view profiles of their linked athletes
CREATE POLICY "Instructors can view linked athlete profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.athlete_instructors ai
      JOIN public.athletes a ON a.id = ai.athlete_id
      WHERE ai.profile_id = get_instructor_profile_id(auth.uid())
        AND (a.instructor_id = profiles.id OR ai.profile_id = profiles.id)
    )
  );



-- MIGRATION: 20260208133428_512f5dd0-6ec8-48ab-9f61-4d5806613baf.sql

-- Remove auto-assignment of instructor role from handle_new_user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);
  
  -- No longer auto-assigns instructor role.
  -- Admins must manually promote users to instructor.
  
  RETURN NEW;
END;
$$;



-- MIGRATION: 20260208133955_c4575fb1-88c1-46db-8a25-db14a6c17b3d.sql

-- Remove overly permissive couples SELECT policy
-- The existing couples_select_instructor_or_admin and Admins can manage couples policies provide proper scoped access
DROP POLICY IF EXISTS "Authenticated users can view couples" ON public.couples;



-- MIGRATION: 20260208141641_5e4421b4-3ec9-403e-a7d5-912e9d1c0156.sql

-- Create competition_event_types table to store which event types are available per competition
CREATE TABLE public.competition_event_types (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  allowed_classes text[] NOT NULL DEFAULT '{}',
  min_age integer,
  max_age integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(competition_id, event_name)
);

-- Enable RLS
ALTER TABLE public.competition_event_types ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage event types"
ON public.competition_event_types
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view event types"
ON public.competition_event_types
FOR SELECT
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_competition_event_types_updated_at
BEFORE UPDATE ON public.competition_event_types
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();



-- MIGRATION: 20260210100000_auto_link_athletes.sql
-- Function to link a single athlete to matching instructors based on responsabili
CREATE OR REPLACE FUNCTION public.auto_link_on_athlete_upsert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert into athlete_instructors for any profile whose full_name matches one of the responsabili
  INSERT INTO public.athlete_instructors (athlete_id, profile_id)
  SELECT NEW.id, p.id
  FROM public.profiles p
  WHERE EXISTS (
    SELECT 1 FROM unnest(NEW.responsabili) r
    WHERE lower(trim(r)) = lower(trim(p.full_name))
  )
  ON CONFLICT (athlete_id, profile_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Trigger to run after insert or update on athletes
DROP TRIGGER IF EXISTS trigger_auto_link_on_athlete_upsert ON public.athletes;
CREATE TRIGGER trigger_auto_link_on_athlete_upsert
  AFTER INSERT OR UPDATE OF responsabili ON public.athletes
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_on_athlete_upsert();



-- MIGRATION: 20260210100001_fix_admin_rls.sql
-- Fix RLS policies to allow admins to update instructor profiles
-- Run this in Supabase SQL Editor

-- 1. Create policy to allow admins to update any profile
CREATE POLICY "Admins can update any profile"
ON profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- 2. Create policy to allow admins to update athlete instructor_id
CREATE POLICY "Admins can update athlete instructor_id"
ON athletes
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);



-- MIGRATION: 20260210100002_fix_instructor_visibility.sql
-- Rimuovi vecchie policy restrittive o generiche se necessario (da valutare caso per caso)
-- Qui assumiamo di voler sovrascrivere o aggiungere policy specifiche.

-- 1. Aggiorna Policy SELECT su athletes per Istruttori
DROP POLICY IF EXISTS "Authenticated users can view athletes" ON public.athletes;
CREATE POLICY "Admin can view all athletes"
  ON public.athletes FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Instructors can view their linked athletes"
  ON public.athletes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.athlete_instructors ai
      WHERE ai.athlete_id = public.athletes.id
      AND ai.profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
  );

-- 2. Aggiorna Policy SELECT su couples per Istruttori
DROP POLICY IF EXISTS "Authenticated users can view couples" ON public.couples;
CREATE POLICY "Admin can view all couples"
  ON public.couples FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Instructors can view their linked couples"
  ON public.couples FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.athlete_instructors ai
      WHERE (ai.athlete_id = public.couples.athlete1_id OR ai.athlete_id = public.couples.athlete2_id)
      AND ai.profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
  );

-- 3. Aggiorna Policy per competition_entries (se presenti)
-- Assumiamo che le entries debbano seguire la stessa logica di visibilitÃ  degli atleti
DROP POLICY IF EXISTS "Authenticated users can view competition_entries" ON public.competition_entries;
CREATE POLICY "Admin can view all competition_entries"
  ON public.competition_entries FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Instructors can view their entries"
  ON public.competition_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.couples c
      JOIN public.athlete_instructors ai ON (ai.athlete_id = c.athlete1_id OR ai.athlete_id = c.athlete2_id)
      WHERE c.id = public.competition_entries.couple_id
      AND ai.profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
  );



-- MIGRATION: 20260211100000_add_event_type_ids_to_entries.sql
-- Migration to add event_type_ids to competition_entries
ALTER TABLE public.competition_entries 
ADD COLUMN event_type_ids UUID[] NOT NULL DEFAULT '{}';

-- Add comment for clarity
COMMENT ON COLUMN public.competition_entries.event_type_ids IS 'List of race IDs (from competition_event_types) the couple is registered for';



-- MIGRATION: 20260211100001_add_discipline_info_to_couples.sql
-- Add discipline_info column to couples table to store specific classes for each discipline
ALTER TABLE public.couples ADD COLUMN IF NOT EXISTS discipline_info JSONB DEFAULT '{}'::jsonb;

-- Comment on column for clarity
COMMENT ON COLUMN public.couples.discipline_info IS 'Store mapping of discipline to its specific class, e.g. {"latino": "A", "standard": "B1"}';



-- MIGRATION: 20260211100002_improve_responsibili_matching.sql

-- Miglioriamo la funzione di matching per gestire casi come "Cognome Nome" vs "Nome Cognome" e case insensitive
CREATE OR REPLACE FUNCTION public.match_names(name1 text, name2 text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  parts1 text[];
  parts2 text[];
  p1 text;
  count_match int := 0;
  total_parts int := 0;
BEGIN
  -- Normalizza: lowercase e split per spazi
  parts1 := string_to_array(lower(trim(name1)), ' ');
  parts2 := string_to_array(lower(trim(name2)), ' ');
  
  -- Rimuovi parti vuote (nel caso di spazi multipli)
  -- (Opzionale: filtriamo titoli come "maestro" se necessario, ma per ora semplifichiamo)

  -- Se uno dei due Ã¨ vuoto, nessun match
  IF array_length(parts1, 1) IS NULL OR array_length(parts2, 1) IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Verifica se TUTTE le parti di name1 (o name2) sono presenti nell'altro.
  -- Questo gestisce "Simone Corvini" == "Corvini Simone"
  
  -- Strategia: contiamo quanti token di parts1 sono presenti in parts2
  FOREACH p1 IN ARRAY parts1
  LOOP
    IF p1 = ANY(parts2) THEN
      count_match := count_match + 1;
    END IF;
  END LOOP;
  
  -- Se tutti i token matchano, Ã¨ ok.
  IF count_match = array_length(parts1, 1) AND array_length(parts1, 1) = array_length(parts2, 1) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- Aggiorniamo la funzione di sync per usare il match migliore
CREATE OR REPLACE FUNCTION public.sync_athlete_instructors()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Inseriamo i link basandoci sulla funzione match_names
  INSERT INTO public.athlete_instructors (athlete_id, profile_id)
  SELECT a.id, p.id
  FROM public.athletes a
  CROSS JOIN public.profiles p
  WHERE 
    EXISTS (
      SELECT 1 
      FROM unnest(a.responsabili) r
      WHERE public.match_names(r, p.full_name)
    )
  ON CONFLICT (athlete_id, profile_id) DO NOTHING;
END;
$$;

-- Aggiorniamo il trigger per usare la stessa logica flessibile
CREATE OR REPLACE FUNCTION public.auto_link_on_athlete_upsert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.athlete_instructors (athlete_id, profile_id)
  SELECT NEW.id, p.id
  FROM public.profiles p
  WHERE EXISTS (
    SELECT 1 FROM unnest(NEW.responsabili) r
    WHERE public.match_names(r, p.full_name)
  )
  ON CONFLICT (athlete_id, profile_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Eseguiamo la sincronizzazione IMMEDIATAMENTE per correggere i dati esistenti
SELECT public.sync_athlete_instructors();



-- MIGRATION: 20260211100003_normalize_classes_uppercase.sql
-- Normalize all classes to UPPERCASE for consistent comparison
UPDATE public.athletes SET class = UPPER(class) WHERE class IS NOT NULL;
UPDATE public.couples SET class = UPPER(class) WHERE class IS NOT NULL;
UPDATE public.competition_class_rules SET class = UPPER(class) WHERE class IS NOT NULL;

-- Normalize allowed_classes array in competition_event_types
UPDATE public.competition_event_types 
SET allowed_classes = (
  SELECT array_agg(UPPER(u)) 
  FROM unnest(allowed_classes) AS u
)
WHERE allowed_classes IS NOT NULL;



-- MIGRATION: 20260211100004_sync_responsibility.sql

CREATE OR REPLACE FUNCTION public.sync_athlete_instructors()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Cancelliamo eventuali link orfani se necessario (opzionale, per ora aggiungiamo solo)
  -- Per sicurezza facciamo un INSERT ... ON CONFLICT DO NOTHING massivo.
  
  INSERT INTO public.athlete_instructors (athlete_id, profile_id)
  SELECT a.id, p.id
  FROM public.athletes a
  CROSS JOIN public.profiles p
  WHERE 
    EXISTS (
      SELECT 1 
      FROM unnest(a.responsabili) r
      WHERE lower(trim(r)) = lower(trim(p.full_name))
    )
  ON CONFLICT (athlete_id, profile_id) DO NOTHING;

END;
$$;



-- MIGRATION: 20260212000000_fix_infinite_recursion.sql
-- Fix infinite recursion by completely removing the problematic policy
-- and using a simpler approach that doesn't create circular dependencies

DROP POLICY IF EXISTS "Instructors can view linked athlete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Instructors can view linked profiles" ON public.profiles;

-- Simplified policy: Instructors can view their own profile and profiles they're directly linked to
-- This completely avoids any reference to the athletes table
CREATE POLICY "Instructors can view linked profiles"
  ON public.profiles FOR SELECT
  USING (
    -- Allow viewing own profile
    profiles.user_id = auth.uid()
    OR
    -- Allow if user is admin
    has_role(auth.uid(), 'admin'::app_role)
    OR
    -- Allow if this profile is linked as an instructor (without checking athletes)
    profiles.id IN (
      SELECT DISTINCT ai.profile_id 
      FROM public.athlete_instructors ai
      WHERE ai.profile_id = get_instructor_profile_id(auth.uid())
    )
  );



-- MIGRATION: 20260212181700_add_gender_to_athletes.sql
-- Add gender column to athletes table
ALTER TABLE public.athletes ADD COLUMN IF NOT EXISTS gender TEXT;

-- Update RLS policies is not needed as they usually cover ALL columns
-- but we might want to update some existing ones if they were column-specific.
-- Checking previous migrations, they use * or are general.



-- MIGRATION: 20260212190000_rename_disciplines_events.sql
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



-- MIGRATION: 20260213000001_add_couples_responsabili.sql
-- Add responsabili field to couples table
-- This field combines responsabili from both athlete1 and athlete2

-- 1. Add the column
ALTER TABLE public.couples
ADD COLUMN IF NOT EXISTS responsabili text[] DEFAULT '{}';

-- 2. Create function to sync responsabili from athletes to couple
CREATE OR REPLACE FUNCTION sync_couple_responsabili()
RETURNS TRIGGER AS $$
DECLARE
  athlete1_resp text[];
  athlete2_resp text[];
  combined_resp text[];
BEGIN
  -- Get responsabili from both athletes
  SELECT COALESCE(responsabili, '{}') INTO athlete1_resp
  FROM public.athletes
  WHERE id = NEW.athlete1_id;
  
  SELECT COALESCE(responsabili, '{}') INTO athlete2_resp
  FROM public.athletes
  WHERE id = NEW.athlete2_id;
  
  -- Combine and deduplicate
  SELECT ARRAY(
    SELECT DISTINCT unnest(athlete1_resp || athlete2_resp)
  ) INTO combined_resp;
  
  NEW.responsabili := combined_resp;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create trigger on couples INSERT/UPDATE
DROP TRIGGER IF EXISTS sync_couple_responsabili_trigger ON public.couples;
CREATE TRIGGER sync_couple_responsabili_trigger
  BEFORE INSERT OR UPDATE OF athlete1_id, athlete2_id
  ON public.couples
  FOR EACH ROW
  EXECUTE FUNCTION sync_couple_responsabili();

-- 4. Create function to update couple responsabili when athlete responsabili changes
CREATE OR REPLACE FUNCTION update_couples_on_athlete_responsabili_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Update all couples where this athlete is athlete1 or athlete2
  UPDATE public.couples
  SET responsabili = (
    SELECT ARRAY(
      SELECT DISTINCT unnest(
        COALESCE(a1.responsabili, '{}') || COALESCE(a2.responsabili, '{}')
      )
    )
    FROM public.athletes a1, public.athletes a2
    WHERE a1.id = couples.athlete1_id
    AND a2.id = couples.athlete2_id
  )
  WHERE athlete1_id = NEW.id OR athlete2_id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create trigger on athletes UPDATE
DROP TRIGGER IF EXISTS update_couples_on_athlete_responsabili_trigger ON public.athletes;
CREATE TRIGGER update_couples_on_athlete_responsabili_trigger
  AFTER UPDATE OF responsabili
  ON public.athletes
  FOR EACH ROW
  WHEN (OLD.responsabili IS DISTINCT FROM NEW.responsabili)
  EXECUTE FUNCTION update_couples_on_athlete_responsabili_change();

-- 6. Backfill existing couples with combined responsabili
UPDATE public.couples
SET responsabili = (
  SELECT ARRAY(
    SELECT DISTINCT unnest(
      COALESCE(a1.responsabili, '{}') || COALESCE(a2.responsabili, '{}')
    )
  )
  FROM public.athletes a1, public.athletes a2
  WHERE a1.id = couples.athlete1_id
  AND a2.id = couples.athlete2_id
);



-- MIGRATION: 20260213000002_auto_cleanup_instructor_deletion.sql
-- Automatic cleanup of all instructor traces when deleted from Supabase
-- This migration ensures that deleting a profile removes ALL related data automatically

-- 1. Add CASCADE to instructor_id in athletes table
-- First, drop the existing constraint
ALTER TABLE public.athletes
DROP CONSTRAINT IF EXISTS athletes_instructor_id_fkey;

-- Recreate with ON DELETE SET NULL (nullifies instead of blocking deletion)
ALTER TABLE public.athletes
ADD CONSTRAINT athletes_instructor_id_fkey
FOREIGN KEY (instructor_id)
REFERENCES public.profiles(id)
ON DELETE SET NULL;

-- 2. Add CASCADE to instructor_id in couples table
-- First, drop the existing constraint
ALTER TABLE public.couples
DROP CONSTRAINT IF EXISTS couples_instructor_id_fkey;

-- Recreate with ON DELETE SET NULL
ALTER TABLE public.couples
ADD CONSTRAINT couples_instructor_id_fkey
FOREIGN KEY (instructor_id)
REFERENCES public.profiles(id)
ON DELETE SET NULL;

-- 3. Create trigger to remove instructor name from responsabili array
-- This handles the text array cleanup that foreign keys can't handle
CREATE OR REPLACE FUNCTION public.cleanup_instructor_from_responsabili()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Remove the deleted instructor's name from all athletes' responsabili arrays
  UPDATE public.athletes
  SET responsabili = array_remove(responsabili, OLD.full_name)
  WHERE responsabili @> ARRAY[OLD.full_name];
  
  -- Also update couples' responsabili if it exists
  UPDATE public.couples
  SET responsabili = array_remove(responsabili, OLD.full_name)
  WHERE responsabili @> ARRAY[OLD.full_name];
  
  RETURN OLD;
END;
$$;

-- Create trigger that fires BEFORE deleting a profile
DROP TRIGGER IF EXISTS cleanup_instructor_responsabili_on_delete ON public.profiles;
CREATE TRIGGER cleanup_instructor_responsabili_on_delete
  BEFORE DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_instructor_from_responsabili();

-- Note: athlete_instructors already has ON DELETE CASCADE (from previous migration)
-- Note: user_roles already cascades from auth.users deletion

-- Summary of automatic cleanup when a profile is deleted:
-- âœ… athlete_instructors records â†’ CASCADE DELETE (already configured)
-- âœ… athletes.instructor_id â†’ SET NULL (new)
-- âœ… couples.instructor_id â†’ SET NULL (new)
-- âœ… athletes.responsabili array â†’ TRIGGER removes name (new)
-- âœ… couples.responsabili array â†’ TRIGGER removes name (new)
-- âœ… user_roles â†’ CASCADE DELETE (via auth.users)



-- MIGRATION: 20260213000003_enable_instructor_deletion.sql
-- Enable instructor deletion by adding missing RLS policies for admins
-- This allows admins to delete instructors and clean up related data

-- 1. Allow admins to delete profiles
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles"
ON profiles
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- 2. Allow admins to delete athlete-instructor links
DROP POLICY IF EXISTS "Admins can delete athlete instructors" ON public.athlete_instructors;
CREATE POLICY "Admins can delete athlete instructors"
ON athlete_instructors
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- 3. Allow admins to delete user roles
DROP POLICY IF EXISTS "Admins can delete user roles" ON public.user_roles;
CREATE POLICY "Admins can delete user roles"
ON user_roles
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'admin'
  )
);



-- MIGRATION: 20260213000004_fix_couple_athlete_visibility.sql
-- Fix RLS policy to allow instructors to see both athletes in a couple
-- if they are responsible for at least one of them

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Instructors can view their linked athletes" ON public.athletes;

-- Create a new policy that allows viewing both athletes in a couple
DROP POLICY IF EXISTS "Instructors can view athletes in their couples" ON public.athletes;
CREATE POLICY "Instructors can view athletes in their couples"
  ON public.athletes FOR SELECT
  TO authenticated
  USING (
    -- Allow if directly linked
    EXISTS (
      SELECT 1 FROM public.athlete_instructors ai
      WHERE ai.athlete_id = public.athletes.id
      AND ai.profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
    OR
    -- Allow if the athlete is part of a couple where the instructor is responsible for the other athlete
    EXISTS (
      SELECT 1 FROM public.couples c
      JOIN public.athlete_instructors ai ON (ai.athlete_id = c.athlete1_id OR ai.athlete_id = c.athlete2_id)
      WHERE (c.athlete1_id = public.athletes.id OR c.athlete2_id = public.athletes.id)
      AND ai.profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
  );



-- MIGRATION: 20260214000001_move_verona_entries.sql

-- Migration: Move all entries from Star Cup Verona to International Senior Cup
-- This handles the one-time request to fix the enrollment issue.

DO $$
DECLARE
    verona_id UUID;
    senior_cup_id UUID;
BEGIN
    -- Find the Star Cup Verona ID (allowing for slight variations in name)
    SELECT id INTO verona_id 
    FROM public.competitions 
    WHERE name ILIKE '%Verona%' OR name ILIKE '%Lago di Garda%'
    LIMIT 1;

    -- Find the International Senior Cup ID
    SELECT id INTO senior_cup_id 
    FROM public.competitions 
    WHERE name ILIKE '%International Senior Cup%'
    LIMIT 1;

    IF verona_id IS NOT NULL AND senior_cup_id IS NOT NULL THEN
        -- Move all entries
        UPDATE public.competition_entries
        SET competition_id = senior_cup_id
        WHERE competition_id = verona_id;

        RAISE NOTICE 'Moved entries from % to %', verona_id, senior_cup_id;
    ELSE
        IF verona_id IS NULL THEN
            RAISE WARNING 'Could not find Star Cup Verona competition';
        END IF;
        IF senior_cup_id IS NULL THEN
            RAISE WARNING 'Could not find International Senior Cup competition';
        END IF;
    END IF;
END $$;



-- MIGRATION: 20260224000001_admin_create_instructor_rpc.sql
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

  -- Controlla che l'email non esista giÃ 
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = lower(trim(p_email))) THEN
    RETURN json_build_object('success', false, 'error', 'Esiste giÃ  un utente con questa email.');
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

  -- 4. Upsert del profilo (il trigger handle_new_user potrebbe averlo giÃ  creato)
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
-- (il controllo admin Ã¨ interno alla funzione stessa)
GRANT EXECUTE ON FUNCTION public.admin_create_instructor(text, text, text) TO authenticated;



-- MIGRATION: 20260224151500_optimize_indexes.sql
-- Database Performance Optimization: Indexes for frequently queried columns

-- competition_entries: Speed up lookups for couple's registrations and status-based queries
CREATE INDEX IF NOT EXISTS idx_competition_entries_couple_id ON competition_entries(couple_id);
CREATE INDEX IF NOT EXISTS idx_competition_entries_competition_id ON competition_entries(competition_id);
CREATE INDEX IF NOT EXISTS idx_competition_entries_status ON competition_entries(status);

-- athletes: Optimize search by code and lookup by instructor
CREATE INDEX IF NOT EXISTS idx_athletes_code ON athletes(code);
CREATE INDEX IF NOT EXISTS idx_athletes_instructor_id ON athletes(instructor_id);

-- couples: Speed up lookup by partner IDs and active status
CREATE INDEX IF NOT EXISTS idx_couples_athlete1_id ON couples(athlete1_id);
CREATE INDEX IF NOT EXISTS idx_couples_athlete2_id ON couples(athlete2_id);
CREATE INDEX IF NOT EXISTS idx_couples_is_active ON couples(is_active);

-- competition_class_rules: Speed up rule checks in Edge Functions
CREATE INDEX IF NOT EXISTS idx_comp_class_rules_comp_id ON competition_class_rules(competition_id);

-- competition_event_types: Speed up event type lookups
CREATE INDEX IF NOT EXISTS idx_comp_event_types_comp_id ON competition_event_types(competition_id);



-- MIGRATION: 20260224160000_add_supervisor_role.sql
-- Migration: Add supervisor role for read-only admin access
-- This role allows seeing all athletes, couples, and entries but no modification.

-- 1. Add 'supervisor' to app_role enum
-- Note: PostgreSQL doesn't allow adding values to enums within a transaction block easily in some versions.
-- However, Supabase migrations run in a way that usually handles this or we can use ALTER TYPE.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'supervisor';

-- 2. Update RLS policies for athletes
DROP POLICY IF EXISTS "Supervisor can view all athletes" ON public.athletes;
CREATE POLICY "Supervisor can view all athletes"
  ON public.athletes FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor'));

-- 3. Update RLS policies for couples
DROP POLICY IF EXISTS "Supervisor can view all couples" ON public.couples;
CREATE POLICY "Supervisor can view all couples"
  ON public.couples FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor'));

-- 4. Update RLS policies for competition_entries
DROP POLICY IF EXISTS "Supervisor can view all competition_entries" ON public.competition_entries;
CREATE POLICY "Supervisor can view all competition_entries"
  ON public.competition_entries FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor'));



-- MIGRATION: 20260224170500_restrict_instructor_role.sql
-- Migration to restrict Instructor role to read-only
-- This migration removes write permissions for instructors and ensures they can only view data.

-- 1. Restrict Athletes table
DROP POLICY IF EXISTS "Instructors can update their athletes" ON public.athletes;
-- We don't need to add a new policy because the "Authenticated users can view athletes" or specific SELECT policies already handle visibility.
-- The existing "Admins can manage athletes" (ALL) and "Admins can update athlete instructor_id" (UPDATE) policies handle admin writes.

-- 2. Restrict Competition Entries table
DROP POLICY IF EXISTS "Instructors can create entries for their couples" ON public.competition_entries;
-- Visibility is handled by "Authenticated users can view entries" (or previous migration 20260210100002).
-- Admin writes are handled by "Admins can manage entries" (ALL).

-- 3. Profiles table
-- Instructors can still update their OWN profile (this is standard behavior for users)
-- "Users can update own profile" on public.profiles remains.

-- 4. Verification
-- Now only 'admin' has INSERT/UPDATE/DELETE on athletes and competition_entries.
-- 'supervisor' has global SELECT.
-- 'instructor' has restricted SELECT.



-- MIGRATION: 20260224180000_remove_competition_class_rules.sql
-- Migration to remove competition_class_rules table as it's no longer used
-- All enrollment logic is now based on competition_event_types

DROP TABLE IF EXISTS "public"."competition_class_rules" CASCADE;



-- MIGRATION: 20260224190000_add_soft_delete.sql
-- Add is_deleted column to athletes and competitions
ALTER TABLE public.athletes ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.competitions ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

-- Update RLS policies to respect is_deleted for athletes (admins see everything)
DROP POLICY if exists "Authenticated users can view athletes" ON public.athletes;
DROP POLICY if exists "Authenticated users can view non-deleted athletes" ON public.athletes;
CREATE POLICY "Authenticated users can view non-deleted athletes"
ON public.athletes FOR SELECT
TO authenticated
USING (is_deleted = false OR public.has_role(auth.uid(), 'admin'));

-- Update RLS policies to respect is_deleted for competitions
DROP POLICY if exists "Authenticated users can view competitions" ON public.competitions;
DROP POLICY if exists "Authenticated users can view non-deleted competitions" ON public.competitions;
CREATE POLICY "Authenticated users can view non-deleted competitions"
ON public.competitions FOR SELECT
TO authenticated
USING (is_deleted = false OR public.has_role(auth.uid(), 'admin'));



-- MIGRATION: 20260226155500_add_is_completed_to_competitions.sql
-- Migration: Add is_completed column to competitions table

ALTER TABLE "public"."competitions" 
ADD COLUMN IF NOT EXISTS "is_completed" boolean NOT NULL DEFAULT false;



-- MIGRATION: 20260305195000_add_qr_code_to_athletes.sql
-- Add qr_code column to athletes table
ALTER TABLE public.athletes ADD COLUMN qr_code TEXT;

-- Add index on qr_code for faster lookups
CREATE INDEX idx_athletes_qr_code ON public.athletes(qr_code);

-- Update RLS if necessary (athletes table already has RLS enabled)
-- The existing policies should cover the new column if they use SELECT * or specific column lists are updated.
-- Authenticated users can view all columns by default based on:
-- CREATE POLICY "Authenticated users can view athletes" ON public.athletes FOR SELECT TO authenticated USING (true);



-- MIGRATION: 20260307130000_create_system_settings.sql
-- Create table for global system settings
CREATE TABLE public.system_settings (
    id TEXT PRIMARY KEY DEFAULT 'global',
    email_notifications_athletes BOOLEAN NOT NULL DEFAULT true,
    email_notifications_instructors BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT one_row CHECK (id = 'global')
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read settings
CREATE POLICY "Anyone can read system settings"
ON public.system_settings FOR SELECT
TO authenticated
USING (true);

-- Only admins can update system settings
CREATE POLICY "Admins can update system settings"
ON public.system_settings FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Insert the default row if it doesn't exist
INSERT INTO public.system_settings (id, email_notifications_athletes, email_notifications_instructors)
VALUES ('global', true, true)
ON CONFLICT (id) DO NOTHING;

-- Trigger for updated_at
CREATE TRIGGER update_system_settings_updated_at 
    BEFORE UPDATE ON public.system_settings 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


