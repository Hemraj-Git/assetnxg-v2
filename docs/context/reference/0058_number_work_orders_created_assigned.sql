-- A preventive or corrective work order created with someone already assigned
-- (Work Orders -> Create Work Order) was numbered by the browser, from the
-- numbers it could see, and the WO-PM / WO-CR sequences never moved past it.
-- The next "Pending Assignment" job to be assigned then took the same number
-- from the sequence, and the assignment failed with a duplicate-key error.
--
-- Now the app sends such a job as 'PENDING-<id>' with its assignee, and the
-- database numbers it on insert, from the same sequences as an assignment
-- (0021). Rows inserted with a real number (data loads, imports) keep it.

create or replace function public.mint_work_order_number_on_insert()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.wo_number like 'PENDING-%'
     and new.assigned_technician_id is not null
     and new.type in ('Preventive', 'Corrective') then
    new.wo_number := (case when new.type = 'Preventive' then 'WO-PM-' else 'WO-CR-' end) ||
      extract(year from now() at time zone 'Asia/Kolkata')::text || '-' ||
      lpad(nextval(
        (case when new.type = 'Preventive'
          then 'public.work_orders_pm_seq'
          else 'public.work_orders_cr_seq'
        end)::regclass
      )::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_mint_work_order_number_on_insert on public.work_orders;
create trigger trg_mint_work_order_number_on_insert
  before insert on public.work_orders
  for each row execute function public.mint_work_order_number_on_insert();

-- Only ever run by the trigger (see 0032).
revoke execute on function public.mint_work_order_number_on_insert() from public, anon, authenticated;

-- Numbers the browser already handed out may be ahead of the sequences: move
-- each sequence past the highest number in use, so the next one is free.
do $$
declare
  r record;
  v_max bigint;
  v_last bigint;
  v_called boolean;
begin
  for r in select * from (values ('WO-PM-', 'public.work_orders_pm_seq'), ('WO-CR-', 'public.work_orders_cr_seq')) as t(prefix, seq) loop
    select coalesce(max(substring(wo_number from '(\d+)$')::bigint), 0) into v_max
      from public.work_orders where wo_number ~ ('^' || r.prefix || '\d{4}-\d+$');
    execute format('select last_value, is_called from %s', r.seq) into v_last, v_called;
    if v_max >= (case when v_called then v_last + 1 else v_last end) then
      perform setval(r.seq::regclass, v_max, true);
    end if;
  end loop;
end;
$$;
