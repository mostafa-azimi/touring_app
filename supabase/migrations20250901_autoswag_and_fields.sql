-- =========================================
-- 20250901_autoswag_and_fields.sql
-- Consolidated patch: columns + view + auto-swag triggers
-- Safe to run multiple times (IF NOT EXISTS / CREATE OR REPLACE)
-- =========================================

-- -------- Guarded column adds (covers v0 variants) --------
alter table public.tours
  add column if not exists status text not null default 'scheduled';

alter table public.tour_swag_allocations
  add column if not exists qty int not null default 1;

alter table public.swag_items
  add column if not exists qty_per_participant int not null default 1;

alter table public.tour_participants
  add column if not exists company text,
  add column if not exists title   text;

alter table public.warehouses
  add column if not exists address2 text,
  add column if not exists phone text,
  add column if not exists contact_person text,
  add column if not exists notes text,
  add column if not exists shiphero_warehouse_id text;

-- Unique index for allocations
do $$
begin
  if not exists (select 1 from pg_indexes where schemaname='public' and indexname='uq_alloc') then
    create unique index uq_alloc on public.tour_swag_allocations (tour_id, participant_id, swag_item_id);
  end if;

  if not exists (select 1 from pg_indexes where schemaname='public' and indexname='uq_warehouses_code') then
    create unique index uq_warehouses_code on public.warehouses(code);
  end if;

  -- team_members.email unique (v0 often creates this, guard it)
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.team_members'::regclass
      and contype = 'u'
      and conname = 'team_members_email_key'
  ) then
    alter table public.team_members add constraint team_members_email_key unique (email);
  end if;
end $$;

-- -------- View for "Swag Totals" in the UI --------
create or replace view public.v_tour_swag_totals as
select
  a.tour_id,
  a.swag_item_id,
  s.name as swag_item_name,
  sum(a.qty) as total_qty
from public.tour_swag_allocations a
join public.swag_items s on s.id = a.swag_item_id
group by a.tour_id, a.swag_item_id, s.name;

-- =========================================
-- Auto-Swag Functions & Triggers
-- =========================================

-- Upsert allocations for ONE participant across ALL swag items (scheduled tours only)
create or replace function public.fn_upsert_allocations_for_participant(p_participant_id uuid)
returns void language plpgsql as $$
declare
  v_tour_id uuid;
begin
  select tour_id into v_tour_id from public.tour_participants where id = p_participant_id;
  if v_tour_id is null then return; end if;

  if exists (select 1 from public.tours t where t.id = v_tour_id and t.status = 'scheduled') then
    insert into public.tour_swag_allocations (tour_id, participant_id, swag_item_id, qty)
    select v_tour_id, p_participant_id, si.id, si.qty_per_participant
    from public.swag_items si
    on conflict (tour_id, participant_id, swag_item_id)
    do update set qty = excluded.qty;
  end if;
end $$;

-- Participant INSERT -> create allocations
create or replace function public.trg_participant_after_insert()
returns trigger language plpgsql as $$
begin
  perform public.fn_upsert_allocations_for_participant(new.id);
  return new;
end $$;

drop trigger if exists t_participant_ai on public.tour_participants;
create trigger t_participant_ai
after insert on public.tour_participants
for each row execute procedure public.trg_participant_after_insert();

-- Participant DELETE -> remove allocations
create or replace function public.trg_participant_after_delete()
returns trigger language plpgsql as $$
begin
  delete from public.tour_swag_allocations where participant_id = old.id;
  return old;
end $$;

drop trigger if exists t_participant_ad on public.tour_participants;
create trigger t_participant_ad
after delete on public.tour_participants
for each row execute procedure public.trg_participant_after_delete();

-- Upsert allocations for ONE swag item across ALL participants of scheduled tours
create or replace function public.fn_upsert_allocations_for_swag_item(p_swag_item_id uuid)
returns void language plpgsql as $$
begin
  insert into public.tour_swag_allocations (tour_id, participant_id, swag_item_id, qty)
  select
    p.tour_id, p.id, p_swag_item_id, si.qty_per_participant
  from public.tour_participants p
  join public.tours t on t.id = p.tour_id and t.status = 'scheduled'
  join public.swag_items si on si.id = p_swag_item_id
  on conflict (tour_id, participant_id, swag_item_id)
  do update set qty = excluded.qty;
end $$;

-- Swag INSERT -> allocate for all scheduled tours' participants
create or replace function public.trg_swag_after_insert()
returns trigger language plpgsql as $$
begin
  perform public.fn_upsert_allocations_for_swag_item(new.id);
  return new;
end $$;

drop trigger if exists t_swag_ai on public.swag_items;
create trigger t_swag_ai
after insert on public.swag_items
for each row execute procedure public.trg_swag_after_insert();

-- Swag UPDATE qty -> refresh allocations qty
create or replace function public.trg_swag_after_update()
returns trigger language plpgsql as $$
begin
  if new.qty_per_participant is distinct from old.qty_per_participant then
    update public.tour_swag_allocations a
      set qty = new.qty_per_participant
    where a.swag_item_id = new.id
      and exists (select 1 from public.tours t where t.id = a.tour_id and t.status = 'scheduled');
  end if;
  return new;
end $$;

drop trigger if exists t_swag_au on public.swag_items;
create trigger t_swag_au
after update on public.swag_items
for each row execute procedure public.trg_swag_after_update();

-- Swag DELETE -> remove related allocations
create or replace function public.trg_swag_after_delete()
returns trigger language plpgsql as $$
begin
  delete from public.tour_swag_allocations where swag_item_id = old.id;
  return old;
end $$;

drop trigger if exists t_swag_ad on public.swag_items;
create trigger t_swag_ad
after delete on public.swag_items
for each row execute procedure public.trg_swag_after_delete();

-- Tour status changes -> drop/rebuild allocations
create or replace function public.trg_tour_after_update()
returns trigger language plpgsql as $$
begin
  if new.status <> 'scheduled' and old.status = 'scheduled' then
    delete from public.tour_swag_allocations where tour_id = new.id;
  elsif new.status = 'scheduled' and old.status <> 'scheduled' then
    insert into public.tour_swag_allocations (tour_id, participant_id, swag_item_id, qty)
    select new.id, p.id, si.id, si.qty_per_participant
    from public.tour_participants p
    cross join public.swag_items si
    where p.tour_id = new.id
    on conflict (tour_id, participant_id, swag_item_id)
    do update set qty = excluded.qty;
  end if;
  return new;
end $$;

drop trigger if exists t_tour_au on public.tours;
create trigger t_tour_au
after update on public.tours
for each row execute procedure public.trg_tour_after_update();
