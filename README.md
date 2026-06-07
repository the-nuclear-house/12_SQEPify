# SQEPify

Upskilling consultants to SQEP (Suitably Qualified and Experienced Person) status
against nuclear competencies, for The Nuclear House. A standalone product with its
own Supabase database. It reads active consultants and their reporting line from the
Control Room, one way only, and manages everything else itself.

## How this repo is run

Read `AGENTS.md` first. It records how the maintainer works and how changes reach the
live system. In short: there is no command line. The frontend deploys to Vercel on a
push from GitHub Desktop; database changes are pasted into the Supabase SQL editor;
edge functions are pasted into the Supabase dashboard.

For anything touching the database, read `docs/DATABASE_WORKFLOW.md`. It is the
authority. The plain-English data dictionary is `docs/SCHEMA.md`. Every database
change is recorded in `CHANGELOG.md` with its SQL and its undo.

## Tech stack

React 18, Vite, TypeScript, deployed on Vercel. Supabase for Postgres, Auth, Storage
and Edge Functions, in its own project. Microsoft 365 SSO via Supabase Auth's azure
provider. Row Level Security on every table.

## Local development

1. Copy `.env.example` to `.env.local` and fill in the SQEPify Supabase project's URL
   and anon key.
2. `npm install`
3. `npm run dev`

`npm run build` type-checks and builds. `npm run typecheck` type-checks only.

## Environment variables

Set in Vercel for production, in `.env.local` for development:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

No other secrets belong in the frontend or the repo. Service-role keys, the Anthropic
and OpenAI keys, and the Control Room feed token all live only in the Supabase
edge-function environment.
