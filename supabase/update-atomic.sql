-- =====================================================================
--  YANGILANISH: atomik to'lov va bazada saqlanadigan PIN bloklash
--  Supabase → SQL Editor da ishga tushiring. Qayta ishga tushirish xavfsiz.
--  (Avval schema.sql / update-payments.sql ishga tushirilgan bo'lishi kerak.)
-- =====================================================================

-- 1) Buyurtmani to'langan qilish + Pro kunlarini qo'shish: BITTA tranzaksiyada.
--    Qaytaradi: true (bajarildi) yoki false (buyurtma allaqachon to'langan/topilmadi).
create or replace function public.fulfill_order(p_order uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders;
begin
  update public.orders
     set status = 'paid', paid_at = now()
   where id = p_order and status = 'new'
   returning * into o;
  if not found then
    return false;
  end if;
  perform public.extend_pro(o.parent_id, o.plan_days);
  return true;
end;
$$;

-- 2) To'lov qaytarilganda: buyurtmani bekor qilish + Pro kunlarini ayirish (atomik).
create or replace function public.revert_order(p_order uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders;
begin
  update public.orders
     set status = 'cancelled'
   where id = p_order and status = 'paid'
   returning * into o;
  if not found then
    return false;
  end if;
  perform public.extend_pro(o.parent_id, -o.plan_days);
  return true;
end;
$$;

revoke all on function public.fulfill_order(uuid) from public, anon, authenticated;
revoke all on function public.revert_order(uuid)  from public, anon, authenticated;
grant execute on function public.fulfill_order(uuid) to service_role;
grant execute on function public.revert_order(uuid)  to service_role;

-- 3) PIN xato urinishlari (server qayta ishga tushsa ham saqlanadi)
create table if not exists public.pin_attempts (
  parent_id    uuid primary key references public.profiles (id) on delete cascade,
  fail_count   int not null default 0,
  locked_until timestamptz
);
alter table public.pin_attempts enable row level security;

-- Qancha millisekund bloklanganligi (0 = bloklanmagan). Muddati o'tgan bo'lsa, hisob tozalanadi.
create or replace function public.pin_lock_remaining_ms(p_parent uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  until_ts timestamptz;
begin
  select locked_until into until_ts from public.pin_attempts where parent_id = p_parent;
  if until_ts is null then
    return 0;
  end if;
  if until_ts <= now() then
    delete from public.pin_attempts where parent_id = p_parent;
    return 0;
  end if;
  return (extract(epoch from (until_ts - now())) * 1000)::bigint;
end;
$$;

-- Xato urinishni yozadi; 5-xatoda 5 daqiqaga bloklaydi.
create or replace function public.pin_record_failure(p_parent uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.pin_attempts (parent_id, fail_count)
  values (p_parent, 1)
  on conflict (parent_id) do update set fail_count = public.pin_attempts.fail_count + 1;

  update public.pin_attempts
     set locked_until = now() + interval '5 minutes'
   where parent_id = p_parent and fail_count >= 5;
end;
$$;

create or replace function public.pin_clear_failures(p_parent uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.pin_attempts where parent_id = p_parent;
$$;

revoke all on function public.pin_lock_remaining_ms(uuid) from public, anon, authenticated;
revoke all on function public.pin_record_failure(uuid)    from public, anon, authenticated;
revoke all on function public.pin_clear_failures(uuid)    from public, anon, authenticated;
grant execute on function public.pin_lock_remaining_ms(uuid) to service_role;
grant execute on function public.pin_record_failure(uuid)    to service_role;
grant execute on function public.pin_clear_failures(uuid)    to service_role;
