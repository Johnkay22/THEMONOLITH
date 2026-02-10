do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'monolith_history'
      and column_name = 'owner_id'
  ) then
    update public.monolith_history
    set content = 'Who Will Forever Be Known, as the First..?'
    where active = true
      and trim(content) = 'WHO WILL BE FIRST?'
      and valuation = 1.00
      and owner_id is null;
  else
    update public.monolith_history
    set content = 'Who Will Forever Be Known, as the First..?'
    where active = true
      and trim(content) = 'WHO WILL BE FIRST?'
      and valuation = 1.00;
  end if;
end
$$;
