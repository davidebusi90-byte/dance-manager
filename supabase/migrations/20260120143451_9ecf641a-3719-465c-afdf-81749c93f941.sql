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