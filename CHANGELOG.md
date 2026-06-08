# CHANGELOG

The running record of every database change to SQEPify: what changed and why, the
exact SQL that was run, and the SQL to undo it. Newest first. See
`docs/DATABASE_WORKFLOW.md` for the rules.

---

## Consultants cache and Control Room sync

**What and why.** Adds `public.consultants`, a local cache of active consultants pulled
read-only from the Control Room feed, keyed off the Control Room's own `id`. The sync
itself is an edge function, `sync-consultants` (see `supabase/functions/`), which is
deployed separately by pasting into the Supabase dashboard and needs the secrets
`CONTROL_ROOM_FEED_URL` and `CONTROL_ROOM_FEED_TOKEN`. Leavers are detected by absence
from the feed and kept as history (`is_active = false` with a `left_at`), never deleted.

**Access in plain English.** A superadmin reads all consultants; a Technical Director
reads those whose TD email matches their own; a person can read their own consultant
record (matched on company email, then personal email). No one writes through the app;
only the sync function writes, using the service role.

**SQL (safe to re-run):**

```sql
create table if not exists public.consultants (
  id                 uuid primary key,
  full_name          text,
  first_name         text,
  last_name          text,
  email              text not null,
  company_email      text,
  job_title          text,
  status             text,
  engineering_skills text[] not null default '{}',
  td_id              uuid,
  td_full_name       text,
  td_email           text,
  is_active          boolean not null default true,
  first_seen_at      timestamptz not null default now(),
  last_seen_at       timestamptz not null default now(),
  left_at            timestamptz,
  updated_at         timestamptz not null default now()
);

create unique index if not exists consultants_company_email_unique
  on public.consultants (lower(company_email)) where company_email is not null;
create index if not exists consultants_td_email_idx on public.consultants (lower(td_email));
create index if not exists consultants_is_active_idx on public.consultants (is_active);

alter table public.consultants enable row level security;

drop policy if exists consultants_select_superadmin on public.consultants;
create policy consultants_select_superadmin on public.consultants
  for select using (public.is_superadmin());

drop policy if exists consultants_select_td on public.consultants;
create policy consultants_select_td on public.consultants
  for select using (lower(td_email) = lower(auth.jwt() ->> 'email'));

drop policy if exists consultants_select_self on public.consultants;
create policy consultants_select_self on public.consultants
  for select using (
    lower(coalesce(company_email, '')) = lower(auth.jwt() ->> 'email')
    or lower(email) = lower(auth.jwt() ->> 'email')
  );
```

**Undo:**

```sql
drop policy if exists consultants_select_self on public.consultants;
drop policy if exists consultants_select_td on public.consultants;
drop policy if exists consultants_select_superadmin on public.consultants;
drop table if exists public.consultants;
```

---

## Foundations — users, roles and app settings

**What and why.** The first database step. Creates the `users` table (who may use
SQEPify and the role each holds, matched to a person by email), a helper that tells
whether the caller is a superadmin, and a single-row `app_settings` table holding the
AI provider and model. Row Level Security is turned on for both tables: a person can
read only their own user row, a superadmin can read and write all of them; any
signed-in person can read the AI settings, only a superadmin can change them.

**Order matters.** Within Block A, the tables are created first, then the
`is_superadmin()` helper (which reads the users table), then the policies (which call
the helper). Putting the helper before the table fails, because Postgres validates the
helper as it is created and cannot find the table yet.

**Order to apply.** Run block A once in the Supabase SQL editor. Then, after you have
signed in to SQEPify once with Microsoft 365 (so your account exists in Supabase
Auth), run block B once with your own email filled in, to make yourself the first
superadmin.

**Block A — schema and access rules (safe to re-run):**

```sql
-- users
create table if not exists public.users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  full_name     text,
  product_role  text not null default 'consultant'
                check (product_role in ('superadmin', 'technical_director', 'consultant')),
  consultant_id text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create unique index if not exists users_email_lower_idx
  on public.users (lower(email));

-- app_settings (single row)
create table if not exists public.app_settings (
  id          boolean primary key default true check (id),
  ai_provider text not null default 'anthropic'
              check (ai_provider in ('anthropic', 'openai')),
  ai_model    text not null default 'claude-sonnet-4-20250514',
  updated_at  timestamptz not null default now()
);

insert into public.app_settings (id) values (true)
on conflict (id) do nothing;

-- helper, created after the users table exists
create or replace function public.is_superadmin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where lower(u.email) = lower(auth.jwt() ->> 'email')
      and u.product_role = 'superadmin'
      and u.is_active
  );
$$;

-- access rules, created after the helper exists
alter table public.users enable row level security;

drop policy if exists users_select_self on public.users;
create policy users_select_self on public.users
  for select
  using (lower(email) = lower(auth.jwt() ->> 'email'));

drop policy if exists users_all_superadmin on public.users;
create policy users_all_superadmin on public.users
  for all
  using (public.is_superadmin())
  with check (public.is_superadmin());

alter table public.app_settings enable row level security;

drop policy if exists app_settings_select_auth on public.app_settings;
create policy app_settings_select_auth on public.app_settings
  for select
  using (auth.role() = 'authenticated');

drop policy if exists app_settings_write_superadmin on public.app_settings;
create policy app_settings_write_superadmin on public.app_settings
  for all
  using (public.is_superadmin())
  with check (public.is_superadmin());
```

**Block B — make yourself the first superadmin (run once, replace the email and name).**
Use the exact email address you sign in with via Microsoft 365.

```sql
insert into public.users (email, full_name, product_role, is_active)
select 'you@yourcompany.com', 'Your Name', 'superadmin', true
where not exists (
  select 1 from public.users where lower(email) = lower('you@yourcompany.com')
);
```

**Undo (drops everything this step created):**

```sql
drop policy if exists app_settings_write_superadmin on public.app_settings;
drop policy if exists app_settings_select_auth on public.app_settings;
drop policy if exists users_all_superadmin on public.users;
drop policy if exists users_select_self on public.users;
drop table if exists public.app_settings;
drop table if exists public.users;
drop function if exists public.is_superadmin();
```
