-- ============================================================
-- SQEPify delivery workflow — consolidated migration
-- Run top to bottom in the Supabase SQL editor. Safe to re-run.
-- ============================================================

-- ---------- Step 1: plan_items v2 + plan_item_outcomes ----------
-- Delivery workflow: plan_items v2 + plan_item_outcomes (Step 1)
-- ============================================================
-- plan_items v2
alter table public.plan_items add column if not exists kind text not null default 'training';
do $$ begin
  if not exists (select 1 from pg_constraint where conname='plan_items_kind_chk') then
    alter table public.plan_items add constraint plan_items_kind_chk check (kind in ('training','missing'));
  end if;
end $$;
alter table public.plan_items add column if not exists trainer_id uuid references public.trainers(id) on delete set null;
alter table public.plan_items add column if not exists delivered_at timestamptz;
alter table public.plan_items add column if not exists delivered_by uuid references public.users(id);
alter table public.plan_items add column if not exists assessed_at timestamptz;
alter table public.plan_items add column if not exists assessed_by uuid references public.users(id);
alter table public.plan_items alter column competency_id drop not null;
alter table public.plan_items alter column start_month drop not null;
update public.plan_items set status='delivered' where status='training_done';
update public.plan_items set status='assessed' where status='confirmed';
do $$
declare c record;
begin
  for c in select conname from pg_constraint where conrelid='public.plan_items'::regclass and contype='c'
           and pg_get_constraintdef(oid) ilike '%status%' loop
    execute format('alter table public.plan_items drop constraint %I', c.conname);
  end loop;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='plan_items_status_chk') then
    alter table public.plan_items add constraint plan_items_status_chk check (status in ('planned','delivered','assessed','blocked'));
  end if;
end $$;
create index if not exists plan_items_trainer on public.plan_items(trainer_id);

-- per-delivery reassessment outcomes (history in the diamond card)
create table if not exists public.plan_item_outcomes (
  id uuid primary key default gen_random_uuid(),
  plan_item_id uuid not null references public.plan_items(id) on delete cascade,
  competency_id uuid not null references public.competencies(id) on delete cascade,
  level int not null check (level between 0 and 5),
  created_at timestamptz not null default now()
);
create index if not exists plan_item_outcomes_item on public.plan_item_outcomes(plan_item_id);
alter table public.plan_item_outcomes enable row level security;
drop policy if exists pio_staff_all on public.plan_item_outcomes;
create policy pio_staff_all on public.plan_item_outcomes for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists pio_own_read on public.plan_item_outcomes;
create policy pio_own_read on public.plan_item_outcomes for select using (
  exists (select 1 from public.plan_items pi join public.assessments a on a.id = pi.assessment_id
    join public.users u on u.consultant_id = a.consultant_id::text
    where pi.id = plan_item_id and lower(u.email) = lower(auth.jwt() ->> 'email'))
);

-- trainers can see the diamonds assigned to them
drop policy if exists pi_trainer_read on public.plan_items;
create policy pi_trainer_read on public.plan_items for select using (
  exists (select 1 from public.trainers t join public.users u on u.id = t.user_id
    where t.id = trainer_id and lower(u.email) = lower(auth.jwt() ->> 'email'))
);
-- ============================================================
-- Step 3: trainer delivery RPCs
-- ============================================================
-- Step 3: trainer delivery RPCs (security definer; keep RLS narrow)
drop function if exists public.my_delivery_assignments();
create or replace function public.my_delivery_assignments()
returns table (
  plan_item_id uuid, training_id uuid, start_month int, status text,
  consultant_id text, consultant_name text, td_full_name text, td_email text
)
language sql security definer set search_path = public stable as $$
  select pi.id, pi.training_id, pi.start_month, pi.status,
         c.id::text, coalesce(nullif(c.full_name, ''), c.email) as consultant_name,
         c.td_full_name, c.td_email
  from public.plan_items pi
  join public.trainers t on t.id = pi.trainer_id
  join public.users me on me.id = t.user_id
  join public.assessments a on a.id = pi.assessment_id
  join public.consultants c on c.id = a.consultant_id
  where pi.kind = 'training' and pi.training_id is not null
    and lower(me.email) = lower(auth.jwt() ->> 'email');
$$;
grant execute on function public.my_delivery_assignments() to authenticated;

create or replace function public.mark_training_delivered(p_plan_item_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid;
begin
  select u.id into me from public.users u where lower(u.email) = lower(auth.jwt() ->> 'email');
  if me is null then raise exception 'no application user for this account'; end if;
  if not exists (
    select 1 from public.plan_items pi join public.trainers t on t.id = pi.trainer_id
    where pi.id = p_plan_item_id and t.user_id = me
  ) then
    raise exception 'not authorised to mark this training delivered';
  end if;
  update public.plan_items
     set status = 'delivered', delivered_at = now(), delivered_by = me
   where id = p_plan_item_id and status = 'planned';
end; $$;
grant execute on function public.mark_training_delivered(uuid) to authenticated;
-- ============================================================
-- Step 6: trainer move requests
-- ============================================================
-- Step 6: trainer move requests
create table if not exists public.plan_move_requests (
  id uuid primary key default gen_random_uuid(),
  plan_item_id uuid not null references public.plan_items(id) on delete cascade,
  requested_month int not null,
  requested_by uuid references public.users(id),
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  decided_by uuid references public.users(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists plan_move_requests_item on public.plan_move_requests(plan_item_id);
create index if not exists plan_move_requests_status on public.plan_move_requests(status);
alter table public.plan_move_requests enable row level security;
drop policy if exists pmr_staff_all on public.plan_move_requests;
create policy pmr_staff_all on public.plan_move_requests for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists pmr_trainer_read on public.plan_move_requests;
create policy pmr_trainer_read on public.plan_move_requests for select using (
  exists (select 1 from public.plan_items pi join public.trainers t on t.id = pi.trainer_id
    join public.users u on u.id = t.user_id
    where pi.id = plan_item_id and lower(u.email) = lower(auth.jwt() ->> 'email'))
);

-- assignments RPC now also reports any pending move month
drop function if exists public.my_delivery_assignments();
create or replace function public.my_delivery_assignments()
returns table (
  plan_item_id uuid, training_id uuid, start_month int, status text,
  consultant_id text, consultant_name text, td_full_name text, td_email text, pending_month int
)
language sql security definer set search_path = public stable as $$
  select pi.id, pi.training_id, pi.start_month, pi.status,
         c.id::text, coalesce(nullif(c.full_name, ''), c.email) as consultant_name,
         c.td_full_name, c.td_email, pm.requested_month
  from public.plan_items pi
  join public.trainers t on t.id = pi.trainer_id
  join public.users me on me.id = t.user_id
  join public.assessments a on a.id = pi.assessment_id
  join public.consultants c on c.id = a.consultant_id
  left join lateral (
    select r.requested_month from public.plan_move_requests r
    where r.plan_item_id = pi.id and r.status = 'pending' order by r.created_at desc limit 1
  ) pm on true
  where pi.kind = 'training' and pi.training_id is not null
    and lower(me.email) = lower(auth.jwt() ->> 'email');
$$;
grant execute on function public.my_delivery_assignments() to authenticated;

create or replace function public.request_training_move(p_plan_item_id uuid, p_month int)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid;
begin
  select u.id into me from public.users u where lower(u.email) = lower(auth.jwt() ->> 'email');
  if not exists (select 1 from public.plan_items pi join public.trainers t on t.id = pi.trainer_id where pi.id = p_plan_item_id and t.user_id = me) then
    raise exception 'not authorised to request a move for this training';
  end if;
  update public.plan_move_requests set status = 'declined', decided_at = now() where plan_item_id = p_plan_item_id and status = 'pending';
  insert into public.plan_move_requests (plan_item_id, requested_month, requested_by) values (p_plan_item_id, p_month, me);
end; $$;
grant execute on function public.request_training_move(uuid, int) to authenticated;

create or replace function public.decide_training_move(p_request_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid; v_item uuid; v_month int;
begin
  select u.id into me from public.users u where lower(u.email) = lower(auth.jwt() ->> 'email');
  select plan_item_id, requested_month into v_item, v_month from public.plan_move_requests where id = p_request_id and status = 'pending';
  if v_item is null then raise exception 'no pending request'; end if;
  -- only the consultant's responsible TD, or a superadmin, may decide
  if not (public.is_superadmin() or exists (
    select 1 from public.plan_items pi join public.assessments a on a.id = pi.assessment_id
      join public.consultants c on c.id = a.consultant_id
    where pi.id = v_item and lower(c.td_email) = lower(auth.jwt() ->> 'email'))) then
    raise exception 'not authorised to decide this request';
  end if;
  if p_accept then
    update public.plan_items set start_month = v_month where id = v_item;
    update public.plan_move_requests set status = 'accepted', decided_by = me, decided_at = now() where id = p_request_id;
  else
    update public.plan_move_requests set status = 'declined', decided_by = me, decided_at = now() where id = p_request_id;
  end if;
end; $$;
grant execute on function public.decide_training_move(uuid, boolean) to authenticated;
