# CHANGELOG

The running record of every database change to SQEPify: what changed and why, the
exact SQL that was run, and the SQL to undo it. Newest first. See
`docs/DATABASE_WORKFLOW.md` for the rules.

---

## Foundations — users, roles and app settings

**What and why.** The first database step. Creates the `users` table (who may use
SQEPify and the role each holds, matched to a person by email), a helper that tells
whether the caller is a superadmin, and a single-row `app_settings` table holding the
AI provider and model. Row Level Security is turned on for both tables: a person can
read only their own user row, a superadmin can read and write all of them; any
signed-in person can read the AI settings, only a superadmin can change them.

**Order to apply.** Run block A once in the Supabase SQL editor. Then, after you have
signed in to SQEPify once with Microsoft 365 (so your account exists in Supabase
Auth), run block B once with your own email filled in, to make yourself the first
superadmin.

**Block A — schema and access rules (safe to re-run):**

```sql
-- Helper: is the caller a superadmin?
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
