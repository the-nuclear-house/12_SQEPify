# CLAUDE.md — guidance for Claude Code working in this repo

Read `AGENTS.md` first: it holds the maintainer's working preferences (British English,
direct understated tone, no em-dashes, partner-not-yes-man), and `docs/DATABASE_WORKFLOW.md`
for the rules on any database change. This file records points specific to keeping the
competency framework safe.

## SQEPify is now the master of the competency framework

SQEPify is the single source of truth for the nuclear competency framework (categories,
competencies, roles and their required levels). Control Room and any other consumer read
the framework one-way from SQEPify by **stable `code`** values on the `competencies` and
`roles` tables (each has a unique `code` column). The framework is edited **only through
the SQEPify UI** from now on; it is no longer rebuilt from a seed.

### Do not run `seed/reset_and_seed.sql` against production

The reset/reseed script (kept in the maintainer's build environment, not committed to this
repo) **truncates and regenerates** the library, role and training tables. Running it
against production would destroy and recreate every competency and role, breaking the
`code` values that Control Room references and severing every downstream link. It must
**never** be run against production. Treat it as a local/development tool only.

## Edge function: `competency-feed`

`supabase/functions/competency-feed/index.ts` is the one-way JSON feed that lets Control
Room (and any other consumer) read the live framework from SQEPify.

- Read-only `GET`. Returns the scale, categories, competencies and roles, with each
  competency and role keyed by its stable `code`.
- Auth is a shared bearer token in the `COMPETENCY_FEED_TOKEN` secret; requests without a
  matching `Authorization: Bearer <token>` are rejected with 401.
- Required secrets (set in the Supabase dashboard, never committed): `COMPETENCY_FEED_TOKEN`.
  `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically.
- Deployed by pasting the whole file into a new Supabase edge function of the same name
  (this project does not use the Supabase CLI to deploy).

Do not change the existing `sync-consultants` function as part of framework work; it pulls
consultants from Control Room and is unrelated to the feed out.

## Build

`npm run build` (= `tsc && vite build`) must be green before handover. `tsc` runs with
`noUnusedLocals`/`noUnusedParameters`, so remove dead variables or the build fails. The
build covers only `src`; the Deno edge functions under `supabase/functions/` are not part
of the TypeScript build.
