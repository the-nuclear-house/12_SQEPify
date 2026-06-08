## parse-cv-nuclear: adopt the Control Room's proven file/URL dispatch

**What and why.** Reworked the CV input to mirror the Control Room's `parse-requirement`
dispatch, which handles uploads reliably. The function now accepts `{ competencies, and one of:
file_base64 + media_type | text | url }` and supports PDF (handed to Anthropic), Word `.docx`
(extracted server-side with `npm:mammoth@1.6.0`), images (jpeg/png/gif/webp), a pasted CV, and a
URL (fetched with a browser User-Agent, stripped of scripts/styles/nav, capped at 15k chars).
The frontend now sends `file_base64`/`media_type` (or `text` for .txt) instead of the old
`cv:{kind,data}` shape. No database change.

**Apply.** Redeploy the `parse-cv-nuclear` edge function (paste the updated file) and push the
frontend. Word now works without any frontend library.
## Trainings: status + hours, drop the circular competency mapping

**What and why.** A training no longer carries the "this competency from level X to Y" mapping,
which duplicated and went circular against the learning path. The learning path on each
competency card now owns which trainings reach which level. So the `training_competencies`
table is removed. Trainings instead gain a `status` of `active` or `required` (required means
the training is needed but not built yet; its card shows red), and duration moves from days to
`duration_hours`.

**SQL (safe to re-run).**
```sql
alter table public.trainings add column if not exists status text not null default 'active';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'trainings_status_chk') then
    alter table public.trainings add constraint trainings_status_chk check (status in ('active','required'));
  end if;
end $$;
alter table public.trainings add column if not exists duration_hours int;
do $$ begin
  if exists (select 1 from information_schema.columns where table_name = 'trainings' and column_name = 'duration_days') then
    update public.trainings set duration_hours = round(duration_days * 8) where duration_hours is null and duration_days is not null;
    alter table public.trainings drop column duration_days;
  end if;
end $$;
drop table if exists public.training_competencies;
```

**Undo.** Re-add `duration_days numeric` and `status`/`duration_hours` can be dropped; the
`training_competencies` data cannot be restored once dropped.
```sql
alter table public.trainings add column if not exists duration_days numeric;
update public.trainings set duration_days = duration_hours / 8.0 where duration_days is null and duration_hours is not null;
alter table public.trainings drop column if exists duration_hours;
alter table public.trainings drop constraint if exists trainings_status_chk;
alter table public.trainings drop column if exists status;
```

## Assessment scores table (assessment_scores)

**What and why.** A per-competency scores table holding the three levels each competency
collects through the journey: the AI's proposed level from the CV (`ai_level`), the
consultant's self-assessment (`self_level`) and the Technical Director's validated level
(`validated_level`), plus a free-text `note`. This underpins the Set-up CV/AI step (which
writes `ai_level`), self-assessment and validation, and feeds the figure and radar later.
One row per (assessment, competency).

**Access.** Staff (superadmin or technical director) read and write all rows. A consultant
can read and write the rows of their own assessment (matched by email), for self-assessment.

**SQL.**
```sql
create table if not exists public.assessment_scores (
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  competency_id uuid not null references public.competencies(id) on delete cascade,
  ai_level int check (ai_level between 0 and 5),
  self_level int check (self_level between 0 and 5),
  validated_level int check (validated_level between 0 and 5),
  note text,
  primary key (assessment_id, competency_id)
);
alter table public.assessment_scores enable row level security;
drop policy if exists as_staff_all on public.assessment_scores;
create policy as_staff_all on public.assessment_scores for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists as_own_rw on public.assessment_scores;
create policy as_own_rw on public.assessment_scores for all using (
  exists (select 1 from public.assessments a join public.users u on u.consultant_id = a.consultant_id::text
    where a.id = assessment_id and lower(u.email) = lower(auth.jwt() ->> 'email'))
) with check (
  exists (select 1 from public.assessments a join public.users u on u.consultant_id = a.consultant_id::text
    where a.id = assessment_id and lower(u.email) = lower(auth.jwt() ->> 'email'))
);
```

**Undo.** `drop table if exists public.assessment_scores;`

## AI backend foundation (settings, secrets, first edge function)

**What and why.** Set up the server-side AI plumbing, mirroring the Control Room: a key/value
`app_settings` table the canonical AI client reads (primary provider plus the two model
strings), and the first edge function, `parse-cv-nuclear`, which reads a consultant CV against
the competency library and returns the levels it evidences. The function embeds the canonical
client verbatim and is gated to technical_director and superadmin. Also corrected the two
consultant self-read policies from the previous step to match on email (the app's identity),
not auth.uid().

**SQL (safe to re-run):** reshapes `app_settings` to key/value and seeds the three AI keys,
and re-creates the corrected assessment self-read policies. See the block in chat.

**Supabase setup (not SQL):** add function secrets `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`
(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically), and create an edge
function named `parse-cv-nuclear` from the file in `supabase/functions/`.

**Undo:** revert `app_settings` to its previous single-row shape if needed; the edge function
can simply be deleted in the dashboard.

---

## Consultant assessment workflow, step 1 (set-up)

**What and why.** The consultant page is now the start of the assessment workflow. Opening a
consultant shows a five-step stepper (Set-up, Self-assessment, Validation, Plan, Done) and
the Set-up step: choose the roles the consultant is assessed against (Base Nuclear always
applies, role-based roles added on top), which starts the assessment. The later steps and the
AI (CV parsing, plan generation) build on top of this.

**SQL (safe to re-run):** creates `assessments` (consultant, status, 18-month horizon) and
`assessment_roles`, with staff-write RLS and a read policy so a consultant can later see their
own. See the block in chat.

**Undo:**

```sql
drop table if exists public.assessment_roles;
drop table if exists public.assessments;
```

---

# CHANGELOG

The running record of every database change to SQEPify: what changed and why, the
exact SQL that was run, and the SQL to undo it. Newest first. See
`docs/DATABASE_WORKFLOW.md` for the rules.

---

## Learning paths moved inside the competency, trainings now chosen per level

**What and why.** Opening a competency in the Library now lands on its learning path (no
separate button). Each level shows what it means for that competency, and for every level
above "no knowledge" you pick the trainings needed to reach it from the catalogue, rather
than them being matched automatically. Editing a competency's name and description, and
deleting it, are available from the same view. Any older per-level descriptors are folded in.

**SQL (safe to re-run):** creates `competency_level_trainings` (competency, level, training)
with staff-only RLS, and migrates existing `level_descriptors` into the learning path. See
the block in chat.

**Undo:**

```sql
drop table if exists public.competency_level_trainings;
```

---

## Required level per competency on a role

**What and why.** Each competency in a role now carries a required level (Awareness, Basic,
SQEP or Expert), so a role can require different skills at different depths rather than
everything at SQEP. This is the target the upcoming consultant assessment measures gaps
against. Set inline on each competency chip in the Roles tab. Existing assignments default
to Level 4 (SQEP); adjust down where a role needs less.

**SQL (safe to re-run):** adds `required_level` to `role_competencies` (default 4, checked 1
to 5). See the block in chat.

**Undo:**

```sql
alter table public.role_competencies drop column if exists required_level;
```

---

## Learning paths per competency

**What and why.** Each competency now has a learning path: for every level above "no
knowledge", what someone must do to reach it (Related actions) and how it is evidenced
(Verification means). Trainings are matched to each level automatically from the catalogue,
so the path and the catalogue stay in step without double entry. Opened from a competency's
"Learning path" button in the Library. Our five star labels are unchanged; the path content
(for example, drawn from the learning-paths spreadsheet) is entered against them.

**SQL (safe to re-run):** creates `competency_level_paths` (competency, level, actions,
verification) with staff-only RLS. See the block in chat.

**Undo:**

```sql
drop table if exists public.competency_level_paths;
```

---

## Trainings can cover multiple capabilities

**What and why.** A single course often lifts several capabilities at once, so the
competency and band moved off the training into a link table, `training_competencies`
(competency, from-star, to-star). A training now holds just title, duration and notes, and
links to one or more competencies each with its own band. Existing single-competency
trainings are migrated automatically. The catalogue card lists each capability with its
own star-to-star, and the add/edit form has a capabilities editor with "+ Add capability".

**SQL (safe to re-run):** creates `training_competencies`, migrates existing trainings, then
drops the old `competency_id`/`from_level`/`to_level` columns. See the block in chat.

**Undo:** (note: this loses the per-competency bands)

```sql
drop table if exists public.training_competencies;
```

---

## Training catalogue

**What and why.** Build-order step: the Training Catalogue, the second tab on the Trainings
page. Adds `trainings` (one competency, a from-star to to-star band, duration in days,
optional notes) and `training_deliverers` (links to the approved trainers registry). A
training can span several bands (e.g. 1 to 3). Each training shows a star-to-star visual of
what it delivers. Staff read and write.

**SQL (safe to re-run):** see the trainings section of `supabase/baseline/SCHEMA_BASELINE.sql`
or the block provided in chat.

**Undo:**

```sql
drop table if exists public.training_deliverers;
drop table if exists public.trainings;
```

---

## Roles and the Base Nuclear role

**What and why.** Build-order step: competencies are now split into Library (definitions)
and Roles (groupings). Adds `roles` and `role_competencies`. Base Nuclear is seeded,
always present, undeletable, and holds the standard competencies everyone needs. Database
triggers enforce that a Base competency cannot be in another role and vice versa, that the
Base role cannot be deleted or un-based, and that only one Base exists. Normal roles may
share competencies. The Nuclear Competencies page gains a Library/Roles tab split; inside a
role, competencies are grouped by category and subcategory, and the add browser greys out
ineligible competencies with the reason.

**Access in plain English.** Staff read and write roles. The Base role is protected.

**SQL (safe to re-run):** see `supabase/baseline/SCHEMA_BASELINE.sql`, the roles section,
or the block provided in chat.

**Undo:**

```sql
drop table if exists public.role_competencies;
drop table if exists public.roles;
drop function if exists public.enforce_role_exclusivity();
drop function if exists public.protect_base_role();
```

---

## Competency hierarchy enforced + star level descriptors

**What and why.** Tightened the competency model on TD feedback. The app now enforces the
full chain (a competency only under a subcategory, a subcategory only under a category) so
the structure reads cleanly, with subcategories shown as tabs inside a category. Added a
`level_descriptors` JSON field to competencies so each skill can say what 1 to 5 stars
actually mean for it; these are the anchors the assessment will use. Page redesigned for
contrast: cyan category panels, subcategory tabs, green-edged competency cards.

**Access in plain English.** No access change. One new optional field on competencies.

**SQL (safe to re-run):**

```sql
alter table public.competencies add column if not exists level_descriptors jsonb;
```

**Undo:**

```sql
alter table public.competencies drop column if exists level_descriptors;
```

---

## Fix: competency library not visible in the app

**What and why.** The competency read rule used `auth.role() = 'authenticated'`, which did
not reliably match in the live project, so the library loaded empty in the app even though
the rows existed. Switched the three read policies to `public.is_staff()`, the same check
the trainers list uses. Read is staff-only for now; it will widen for consultants when the
consultant profile is built. `docs/SCHEMA.md` and the baseline updated.

**SQL (safe to re-run):**

```sql
drop policy if exists comp_cat_read on public.competency_categories;
create policy comp_cat_read on public.competency_categories for select using (public.is_staff());
drop policy if exists comp_sub_read on public.competency_subcategories;
create policy comp_sub_read on public.competency_subcategories for select using (public.is_staff());
drop policy if exists comp_read on public.competencies;
create policy comp_read on public.competencies for select using (public.is_staff());
```

---

## Competency taxonomy (categories, subcategories, competencies)

**What and why.** Build-order step 3: the competency library. Three tables form a
category, optional subcategory, then competency hierarchy. A competency always has a
category and may optionally sit under a subcategory. Deleting a category removes
everything beneath it; deleting a subcategory keeps its competencies under the category.
The Nuclear Competencies page is a staff-only editor over these tables. Content is added
later from the reference material.

**Access in plain English.** Any signed-in user can read the library (names are needed
elsewhere in the app). Only staff (superadmins and Technical Directors) can add, rename,
or delete anything.

**SQL (safe to re-run):**

```sql
create table if not exists public.competency_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.competency_subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.competency_categories(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.competencies (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.competency_categories(id) on delete cascade,
  subcategory_id uuid references public.competency_subcategories(id) on delete set null,
  name text not null,
  description text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists competency_subcategories_category on public.competency_subcategories(category_id);
create index if not exists competencies_category on public.competencies(category_id);
create index if not exists competencies_subcategory on public.competencies(subcategory_id);

alter table public.competency_categories enable row level security;
alter table public.competency_subcategories enable row level security;
alter table public.competencies enable row level security;

drop policy if exists comp_cat_read on public.competency_categories;
create policy comp_cat_read on public.competency_categories for select using (auth.role() = 'authenticated');
drop policy if exists comp_cat_write on public.competency_categories;
create policy comp_cat_write on public.competency_categories for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists comp_sub_read on public.competency_subcategories;
create policy comp_sub_read on public.competency_subcategories for select using (auth.role() = 'authenticated');
drop policy if exists comp_sub_write on public.competency_subcategories;
create policy comp_sub_write on public.competency_subcategories for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists comp_read on public.competencies;
create policy comp_read on public.competencies for select using (auth.role() = 'authenticated');
drop policy if exists comp_write on public.competencies;
create policy comp_write on public.competencies for all using (public.is_staff()) with check (public.is_staff());
```

**Undo:**

```sql
drop table if exists public.competencies;
drop table if exists public.competency_subcategories;
drop table if exists public.competency_categories;
```

---

## Trainer management opened to Technical Directors

**What and why.** Trainer management is a Technical Director responsibility, not just a
superadmin one. Trainers can now be added and removed by any staff member (superadmin or
Technical Director). To let a TD pick trainers without opening up the user and consultant
tables, picking goes through a guarded lookup, `trainer_candidates()`, which returns only
id and name to a staff caller. `docs/SCHEMA.md` updated for the new write access.

**SQL (safe to re-run):**

```sql
drop policy if exists trainers_write_superadmin on public.trainers;
drop policy if exists trainers_write_staff on public.trainers;
create policy trainers_write_staff on public.trainers
  for all using (public.is_staff()) with check (public.is_staff());

create or replace function public.trainer_candidates()
returns table (kind text, id text, name text)
language sql security definer set search_path = public as $$
  select 'td'::text, u.id::text, coalesce(u.full_name, u.email)
  from public.users u
  where public.is_staff() and u.product_role = 'technical_director' and u.is_active
  union all
  select 'consultant'::text, c.id::text, coalesce(c.full_name, c.company_email, c.email)
  from public.consultants c
  where public.is_staff() and c.is_active;
$$;
grant execute on function public.trainer_candidates() to authenticated;
```

**Undo:**

```sql
drop function if exists public.trainer_candidates();
drop policy if exists trainers_write_staff on public.trainers;
create policy trainers_write_superadmin on public.trainers
  for all using (public.is_superadmin()) with check (public.is_superadmin());
```

---

## Approved trainers registry

**What and why.** Adds `public.trainers`, the registry of who may deliver a training:
Technical Directors, consultants, or external providers. A training in the catalogue
(built next) may only list deliverers from here. Also adds `is_staff()`, a helper that
is true for an active superadmin or Technical Director, used for read access.

**Access in plain English.** Staff (superadmins and Technical Directors) can read the
registry. Only superadmins can add or remove trainers for now, because adding a trainer
needs the full user and consultant lists, which only superadmins can currently read.
Opening management to Technical Directors is a later, deliberate change.

**SQL (safe to re-run):**

```sql
create or replace function public.is_staff()
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.users u
    where lower(u.email) = lower(auth.jwt() ->> 'email')
      and u.product_role in ('superadmin','technical_director')
      and u.is_active
  );
$$;

create table if not exists public.trainers (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('technical_director','consultant','external')),
  user_id       uuid,
  consultant_id text,
  display_name  text not null,
  company_name  text,
  contact_name  text,
  contact_email text,
  contact_phone text,
  notes         text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);
create unique index if not exists trainers_user_unique on public.trainers (user_id) where user_id is not null;
create unique index if not exists trainers_consultant_unique on public.trainers (consultant_id) where consultant_id is not null;

alter table public.trainers enable row level security;

drop policy if exists trainers_select_staff on public.trainers;
create policy trainers_select_staff on public.trainers for select using (public.is_staff());

drop policy if exists trainers_write_superadmin on public.trainers;
create policy trainers_write_superadmin on public.trainers
  for all using (public.is_superadmin()) with check (public.is_superadmin());
```

**Undo:**

```sql
drop policy if exists trainers_write_superadmin on public.trainers;
drop policy if exists trainers_select_staff on public.trainers;
drop table if exists public.trainers;
drop function if exists public.is_staff();
```

---

## Auto-provision consultant logins from the sync

**What and why.** Consultants pulled from the Control Room should be able to sign in to
SQEPify without anyone creating their account by hand, since they already have a
Microsoft 365 work account. This adds `reconcile_consultant_users()`, which the sync
function calls at the end of each run. It creates a user for every active consultant
that has a company email (role consultant, linked by `consultant_id`), links and
reactivates returning consultants, and switches off the login of any consultant who has
left (gone inactive in the cache). It only ever touches consultant-role accounts, never
a Technical Director or superadmin. Consultants without a company email are not
auto-created, as there is no address to match their sign in against.

**Access in plain English.** Runs server-side as part of the sync; nothing for a user
to do. A consultant's SQEPify access now tracks their employment in the Control Room.

**SQL (safe to re-run):**

```sql
create or replace function public.reconcile_consultant_users()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (email, full_name, product_role, is_active, consultant_id)
  select c.company_email, c.full_name, 'consultant', true, c.id::text
  from public.consultants c
  where c.is_active
    and c.company_email is not null
    and not exists (select 1 from public.users u where lower(u.email) = lower(c.company_email));

  update public.users u
  set consultant_id = c.id::text,
      is_active = case when u.product_role = 'consultant' then true else u.is_active end
  from public.consultants c
  where c.is_active and c.company_email is not null
    and lower(u.email) = lower(c.company_email);

  update public.users u
  set is_active = false
  from public.consultants c
  where u.product_role = 'consultant'
    and u.consultant_id = c.id::text
    and c.is_active = false;
end;
$$;
```

**Undo:**

```sql
drop function if exists public.reconcile_consultant_users();
```

---

## sync_state — record of the last successful sync

**What and why.** Adds `public.sync_state`, a single row holding when the consultant
sync last succeeded and the counts from that run. The sync function writes it at the end
of a successful run (service role), and the System page reads it to show a "last
successful pull" line, covering both the manual button and the scheduled runs.

**Access in plain English.** Any signed-in person can read it; no one writes through
the app, only the sync function does.

**SQL (safe to re-run):**

```sql
create table if not exists public.sync_state (
  id               boolean primary key default true check (id),
  last_sync_at     timestamptz,
  last_pulled      int,
  last_marked_left int,
  updated_at       timestamptz not null default now()
);
insert into public.sync_state (id) values (true) on conflict (id) do nothing;

alter table public.sync_state enable row level security;

drop policy if exists sync_state_select_auth on public.sync_state;
create policy sync_state_select_auth on public.sync_state
  for select using (auth.role() = 'authenticated');
```

**Undo:**

```sql
drop policy if exists sync_state_select_auth on public.sync_state;
drop table if exists public.sync_state;
```

---

## Scheduled Control Room sync (twice daily)

**What and why.** Runs `sync-consultants` automatically twice a day (06:00 and 12:00
UTC) using pg_cron and pg_net, in addition to the manual Sync now button. The cron call
authenticates as the service role, which the function accepts; the service role key is
held in Supabase Vault, never in the repo.

**One-off setup (run once in the SQL editor, value never committed).** Get the SQEPify
service role key from Project Settings, then API, and store it in Vault. Replace the
placeholder with the real key:

```sql
select vault.create_secret('PASTE-SQEPIFY-SERVICE-ROLE-KEY', 'sqepify_service_role_key');
```

**Schedule (safe to re-run; re-running updates the jobs by name).** Replace the URL with
your SQEPify function URL.

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'sqepify-sync-morning',
  '0 6 * * *',
  $$
  select net.http_post(
    url := 'https://YOUR-SQEPIFY-REF.supabase.co/functions/v1/sync-consultants',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'sqepify_service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'sqepify-sync-midday',
  '0 12 * * *',
  $$
  select net.http_post(
    url := 'https://YOUR-SQEPIFY-REF.supabase.co/functions/v1/sync-consultants',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'sqepify_service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

**Check it (optional):**

```sql
select jobname, status, return_message, start_time
from cron.job_run_details
order by start_time desc
limit 10;
```

**Undo:**

```sql
select cron.unschedule('sqepify-sync-morning');
select cron.unschedule('sqepify-sync-midday');
```

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
