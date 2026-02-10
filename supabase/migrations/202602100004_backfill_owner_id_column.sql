alter table public.monolith_history
add column if not exists owner_id uuid;
