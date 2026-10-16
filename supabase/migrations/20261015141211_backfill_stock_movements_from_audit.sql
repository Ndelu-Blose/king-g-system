-- The stock report reads stock_movements. Older arrivals, transfers, counts,
-- and write-offs were saved only on the audit log, so the report stayed empty.

create or replace function pg_temp.try_jsonb(t text) returns jsonb
language plpgsql immutable as $$
begin
  return t::jsonb;
exception when others then
  return null;
end;
$$;

create or replace function pg_temp.try_timestamptz(t text) returns timestamptz
language plpgsql stable as $$
begin
  return t::timestamptz;
exception when others then
  return null;
end;
$$;

insert into public.stock_movements (
  created_at, type, product_id, product_name, qty, from_location, to_location, reference, reason,
  actor_id, actor_role, balance_before, balance_after, audit_log_id
)
select
  pg_temp.try_timestamptz(a.timestamp),
  case a.action
    when 'goods.received' then 'RECEIPT'
    when 'stock.transferred' then 'TRANSFER'
    when 'stock.count.applied' then 'COUNT'
    else 'ADJUSTMENT'
  end,
  a.entity_id,
  coalesce(p.name, a.entity_id),
  case a.action
    when 'goods.received' then coalesce((pg_temp.try_jsonb(a.after_json) ->> 'receivedQty')::numeric, 0)::int
    when 'stock.transferred' then coalesce((pg_temp.try_jsonb(a.after_json) ->> 'qty')::numeric, 0)::int
    when 'stock.count.applied' then
      coalesce((pg_temp.try_jsonb(a.after_json) ->> 'total')::numeric, 0)::int
      - coalesce((pg_temp.try_jsonb(a.before_json) ->> 'total')::numeric, 0)::int
    when 'stock.written_off' then -1 * coalesce((pg_temp.try_jsonb(a.after_json) ->> 'qty')::numeric, 0)::int
    else coalesce((pg_temp.try_jsonb(a.after_json) ->> 'delta')::numeric, 0)::int
  end,
  case
    when a.action = 'stock.transferred' then pg_temp.try_jsonb(a.after_json) ->> 'from'
    when a.action = 'stock.written_off' then pg_temp.try_jsonb(a.after_json) ->> 'location'
  end,
  case a.action
    when 'goods.received' then pg_temp.try_jsonb(a.after_json) ->> 'location'
    when 'stock.transferred' then pg_temp.try_jsonb(a.after_json) ->> 'to'
  end,
  case when a.action = 'goods.received' then nullif(pg_temp.try_jsonb(a.before_json) ->> 'invoiceNumber', '') end,
  case
    when a.action = 'stock.written_off' and a.reason_code = 'expired' then 'Expired'
    when a.action = 'stock.written_off' and a.reason_code = 'broken' then 'Broken bottle'
    when a.action in ('stock.count.applied', 'stock.adjustment.posted') then a.reason_code
    else a.reason_code
  end,
  a.actor_id,
  a.actor_role,
  pg_temp.try_jsonb(a.before_json),
  pg_temp.try_jsonb(a.after_json),
  a.id
from public.audit_log a
left join public.products p on p.id = a.entity_id
where a.action in (
  'goods.received', 'stock.transferred', 'stock.count.applied', 'stock.adjustment.posted', 'stock.written_off'
)
  and a.entity_id is not null
  and pg_temp.try_timestamptz(a.timestamp) is not null
  and pg_temp.try_jsonb(a.after_json) is not null
  and not exists (
    select 1 from public.stock_movements m where m.audit_log_id = a.id
  );
