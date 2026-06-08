# SCHEMA.md — plain-English data dictionary

What each table is for, and who may read and write it. Columns are not listed here;
the snapshot in `supabase/baseline/SCHEMA_BASELINE.sql` owns those. Update this file
whenever a change alters what a table is for or who can see it.

The tables below are everything that exists after the Foundations step. The rest of
the data model (consultants, competencies, trainings, assessments, SQEP cases, plans)
arrives in later build-order steps and is added here as it is built.

---


A training has a title, a duration in days, optional notes, and one or more deliverers
drawn from the approved trainers registry (`training_deliverers`). It addresses one or more
from-star, to-star). A training therefore can lift several capabilities at once. These
bands are what let the assessment later match a person's gaps to the right trainings.

**Who can read / write:** staff (superadmins and Technical Directors).

---

## roles, role_competencies

Roles are named sets of competencies. **Base Nuclear** is a special role that is always
present, cannot be deleted, and holds the competencies everyone needs. A competency in
Base cannot belong to any other role, and a competency in any normal role cannot be added
to Base; the database enforces both. Normal roles may share competencies with each other.
Assessment (built later) is always Base plus whichever roles are chosen for a person,
deduplicated.

**Who can read:** staff (superadmins and Technical Directors).

**Who can write:** staff. The Base role is protected (no delete, cannot be un-based) and
only one Base may exist.

---

## competency_categories, competency_subcategories, competencies

The competency library, in three levels: a category, a subcategory beneath it, and the
competencies themselves. The app enforces the full chain: a competency sits under a
subcategory, a subcategory under a category. Each competency also carries optional star
level descriptors (`level_descriptors`, JSON keyed 1 to 5) that say what each star means
for that specific skill, used later as the assessment anchors. Deleting a category removes everything beneath it;
deleting a subcategory keeps its competencies, moving them up to sit directly under the
category. This taxonomy is the backbone that trainings and assessments attach to.

**Who can read:** staff (superadmins and Technical Directors) for now. This will be
widened to a consultant for their own competency names when the consultant profile is
built.

**Who can write:** staff (superadmins and Technical Directors), through the editable
Nuclear Competencies page.

---

## trainers

The registry of people and providers approved to deliver training. Each row is one of
three kinds: a Technical Director (linked to a user), a consultant (linked to a
consultant record), or an external provider (with company and contact details). A
training in the catalogue may only list deliverers that appear here.

**Who can read:** superadmins and Technical Directors (staff).

**Who can write:** superadmins and Technical Directors. Trainers are picked through a
guarded lookup (`trainer_candidates`) so this does not open up the user or consultant
tables.

---

## users

The list of people who may use SQEPify and the role each one holds. A person is
matched to their row by email address, the same address they sign in with through
Microsoft 365. Three roles exist: superadmin, technical_director and consultant. The
`consultant_id` column links a consultant's account to their cached consultant record
once that table exists; it is empty for now.

**Who can read:** a signed-in person can read only their own row. A superadmin can read
every row.

**Who can write:** only a superadmin. Ordinary users cannot change their own role or
anyone else's.

The very first superadmin cannot be created through the app, because that would need a
superadmin to already exist. It is set once, directly in the database, as recorded in
the changelog.

Consultant logins are provisioned automatically. Each consultant sync creates a user
for any active consultant who has a company email (role consultant, linked to their
record), reactivates returning consultants, and switches off the login of anyone who
has left the company. This only ever affects consultant accounts, never a Technical
Director or superadmin. Consultants without a company email are not auto-created, since
there is no address to match their Microsoft 365 sign in against.

---

## app_settings

A single row holding which AI provider and model SQEPify uses (Anthropic first, with
OpenAI as failover). Edge functions read this server-side when they call the model.

**Who can read:** any signed-in person.

**Who can write:** only a superadmin.

---

## consultants

A local cache of the consultants pulled from the Control Room's read-only feed,
refreshed by the `sync-consultants` edge function. Keyed off the Control Room's own id.
Holds each consultant's names, personal and company email, job title, status,
engineering skills, and their reporting Technical Director (id, name and email). Company
email is unique when present and is the first thing matched against a person's Microsoft
365 login; personal email is the fallback.

Leavers are kept as history: when someone is exited in the Control Room they stop
appearing in the feed, and the sync marks them inactive with a left date rather than
deleting them. Nothing in SQEPify is ever removed because a person left.

**Who can read:** a superadmin reads everyone. A Technical Director reads the
consultants whose Technical Director email matches their own. A person can read their
own consultant record (matched on company email, then personal email).

**Who can write:** no one through the app. Only the sync function writes, using the
service role, so the cache only ever changes by pulling from the Control Room.

---

## sync_state

A single row recording when the consultant sync last ran successfully, and how many it
pulled and marked as left. Used to show a "last successful pull" line on the System
page, covering both the manual button and the scheduled runs.

**Who can read:** any signed-in person.

**Who can write:** no one through the app. Only the sync function writes, using the
service role.

## competency_level_paths

The learning path for a competency. One row per (competency, level 1 to 5) holding `actions`
(what to do to reach that level) and `verification` (how it is evidenced). Levels use the
same five-star scale as everywhere else; level 1 (no knowledge) carries no path. Which
write are staff-only (`is_staff()`).

## role_competencies.required_level

Each row in `role_competencies` carries `required_level` (1 to 5, default 4), the target
level that role needs for that competency. The same competency can be required at different
levels in different roles. A consultant's gap on a competency is this target minus their
assessed level, taken across Base Nuclear plus their selected roles.

## competency_level_trainings

Which trainings make up the learning path for a competency at each level. One row per
(competency, level 2 to 5, training). The trainings are chosen explicitly by staff in the
competency's learning path, not derived from training bands. Read and write are staff-only.
Per-level descriptions ("what this level means") live in `competency_level_paths.actions`.

## assessments, assessment_roles

An assessment is one run of the consultant workflow. `assessments` holds the consultant, a
`status` that moves through draft → self_assessment → validation → planning → plan_review →
delivered (or cancelled), and an 18-month `horizon_months`. `assessment_roles` records the
role-based roles chosen for it; Base Nuclear always applies and is not stored. Staff
(`is_staff()`) manage assessments; a consultant can read their own (matched via
`users.consultant_id`). Scores and the generated plan are added in later steps.

## app_settings (key/value)

A simple key/value table read by the AI edge functions and editable by the superadmin. The AI
client reads three keys in one request: `ai_primary_provider` (anthropic|openai),
`ai_model_anthropic` and `ai_model_openai`. When a provider deprecates a model, the superadmin
updates the string here, no code change. Selectable by any authenticated user; written by
superadmin only. The provider API keys themselves are never here; they live as edge-function
secrets (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`).

## assessment_scores
One row per (assessment, competency). `ai_level` = AI's CV-derived proposal, `self_level` =
consultant's self-assessment, `validated_level` = TD's locked level, `note` = evidence/comment.
All levels 0–5 (0 = not assessed). RLS: staff read/write all; consultant read/write own by email.
