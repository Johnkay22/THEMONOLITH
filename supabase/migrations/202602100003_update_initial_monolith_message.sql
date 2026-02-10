update public.monolith_history
set content = 'Who Will Forever Be Known, as the First..?'
where active = true
  and content = 'WHO WILL BE FIRST?'
  and valuation = 1.00
  and owner_id is null;
