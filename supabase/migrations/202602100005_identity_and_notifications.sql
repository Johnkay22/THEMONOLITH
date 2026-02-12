alter table public.monolith_history
add column if not exists source_type text not null default 'solo';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'monolith_history_source_type_check'
  ) then
    alter table public.monolith_history
      add constraint monolith_history_source_type_check
      check (source_type in ('solo', 'syndicate'));
  end if;
end
$$;

alter table public.monolith_history
add column if not exists source_syndicate_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'monolith_history_source_syndicate_fk'
  ) then
    alter table public.monolith_history
      add constraint monolith_history_source_syndicate_fk
      foreign key (source_syndicate_id)
      references public.syndicates(id)
      on delete set null;
  end if;
end
$$;

alter table public.monolith_history
add column if not exists author_name text,
add column if not exists author_email text,
add column if not exists funded_by_count integer,
add column if not exists funded_in_days integer;

update public.monolith_history
set source_type = 'solo'
where source_type is null;

create index if not exists monolith_history_source_syndicate_idx
on public.monolith_history (source_syndicate_id);

alter table public.syndicates
add column if not exists creator_name text,
add column if not exists creator_email text,
add column if not exists notify_on_funded boolean not null default false,
add column if not exists notify_on_every_contribution boolean not null default false,
add column if not exists won_at timestamptz;

alter table public.contributions
add column if not exists contributor_name text,
add column if not exists contributor_email text,
add column if not exists notify_on_funded boolean not null default false;

alter table public.contributions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'contributions'
      and policyname = 'Service role can manage contributions'
  ) then
    create policy "Service role can manage contributions"
      on public.contributions
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end
$$;

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  recipient_email text not null,
  kind text not null check (kind in ('solo_displaced', 'syndicate_funded', 'syndicate_contribution')),
  created_at timestamptz not null default now()
);

alter table public.notification_events enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notification_events'
      and policyname = 'Service role can manage notification events'
  ) then
    create policy "Service role can manage notification events"
      on public.notification_events
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end
$$;
