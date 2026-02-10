alter table public.monolith_history enable row level security;
alter table public.syndicates enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'monolith_history'
      and policyname = 'Public can read monolith history'
  ) then
    create policy "Public can read monolith history"
      on public.monolith_history
      for select
      using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'syndicates'
      and policyname = 'Public can read syndicates'
  ) then
    create policy "Public can read syndicates"
      on public.syndicates
      for select
      using (true);
  end if;
end
$$;

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'monolith_history'
  ) then
    execute 'alter publication supabase_realtime add table public.monolith_history';
  end if;
end
$$;

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'syndicates'
  ) then
    execute 'alter publication supabase_realtime add table public.syndicates';
  end if;
end
$$;
