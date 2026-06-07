# SCHEMA.md — plain-English data dictionary

What each table is for, and who may read and write it. Columns are not listed here;
the snapshot in `supabase/baseline/SCHEMA_BASELINE.sql` owns those. Update this file
whenever a change alters what a table is for or who can see it.

The tables below are everything that exists after the Foundations step. The rest of
the data model (consultants, competencies, trainings, assessments, SQEP cases, plans)
arrives in later build-order steps and is added here as it is built.

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

---

## app_settings

A single row holding which AI provider and model SQEPify uses (Anthropic first, with
OpenAI as failover). Edge functions read this server-side when they call the model.

**Who can read:** any signed-in person.

**Who can write:** only a superadmin.
