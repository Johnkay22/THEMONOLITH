create extension if not exists pgcrypto;

create table if not exists public.monolith_history (
  id uuid primary key default gen_random_uuid(),
  content text not null check (char_length(trim(content)) > 0),
  valuation numeric(12,2) not null check (valuation >= 1.00),
  owner_id uuid,
  created_at timestamptz not null default now(),
  active boolean not null default true
);

create unique index if not exists monolith_history_one_active_idx
  on public.monolith_history (active)
  where active = true;

create table if not exists public.syndicates (
  id uuid primary key default gen_random_uuid(),
  proposed_content text not null check (char_length(trim(proposed_content)) > 0),
  total_raised numeric(12,2) not null default 0.00 check (total_raised >= 0.00),
  status text not null default 'active' check (status in ('active', 'won', 'archived')),
  created_at timestamptz not null default now()
);

create index if not exists syndicates_status_idx on public.syndicates (status);
create index if not exists syndicates_total_raised_idx on public.syndicates (total_raised desc);

create table if not exists public.contributions (
  id uuid primary key default gen_random_uuid(),
  syndicate_id uuid not null references public.syndicates(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 1.00),
  stripe_session_id text not null unique,
  created_at timestamptz not null default now()
);

insert into public.monolith_history (content, valuation, active)
select 'Who Will Forever Be Known, as the First..?', 1.00, true
where not exists (
  select 1 from public.monolith_history
);
