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