insert into public.monolith_history (content, valuation, active)
values ('WHO WILL BE FIRST?', 1.00, true)
on conflict do nothing;
