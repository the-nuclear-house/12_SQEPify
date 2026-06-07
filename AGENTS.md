# AGENTS.md — how to work in this repo

This file is for any AI assistant, and any new person, picking up work on SQEPify. It
records how the maintainer likes to work, so it does not have to be explained from
scratch each time. Read it before you start. SQEPify is a sibling of the Control Room
and is run the same way; this file mirrors the Control Room's conventions.

## Who you are working with

The maintainer is the sole person looking after this tool and is not a programmer.
Explain everything in plain English. Use code and SQL to do the work by all means,
but when you describe what you have done, describe it in words, not in code the
maintainer would have to read and interpret.

## How to communicate

- Be a partner, not a yes-man. Give honest, reasoned feedback. If an idea is weak or
  risky, say so and explain why. Do not agree just to be agreeable, and do not flatter.
- Use British English throughout: spelling, terminology and phrasing.
- Keep the tone direct and understated. No hype, no effusiveness. Plain and matter of
  fact, the way good British business writing reads.
- Do not use the long dash character. Use commas, full stops or brackets instead.
- Be concise. Lead with the answer. Keep caveats short.

## Principles that matter here

- Single source of truth. Every fact lives in exactly one place. Before you add a file
  or a section, check the information does not already exist somewhere else. If it
  does, point to it rather than copy it.
- Only necessary files. A stale, duplicated or unused file is worse than no file,
  because it misleads whoever reads the repo next, person or AI. If something is dead,
  already applied, or duplicated, remove it. If it is needed, keep it. When you are not
  sure, check or ask rather than guess.
- No temporary fixes. Do not defer a problem or leave debt with a promise to fix it
  later. Solve it properly, or explain plainly why it cannot be done yet and what is
  needed first. A clear "this needs X before it can be done" is welcome. A quiet
  band-aid is not.
- Verify before you say it is done. If a change could break the application, check it
  first, for example by type-checking the project (`npm run typecheck`), and only then
  report it as done.

## How changes reach the live system

The maintainer applies everything by hand through web interfaces. There is no command
line in this workflow.

- Frontend (React, Vite, TypeScript): deployed to Vercel. Changes are pushed using
  GitHub Desktop, and a push deploys automatically.
- Database (Supabase): changes are applied by pasting SQL into the Supabase SQL editor.
- Edge functions (Supabase): deployed by pasting each function into the Supabase
  dashboard.

So when you hand work over: give exact SQL ready to paste, give whole files or clear
copy-and-paste blocks rather than partial changes to apply by hand, and state plainly
where each piece goes and in what order.

Always deliver changed repo files as a single zip that preserves the folder structure
and contains only the files that changed, so the maintainer can extract it straight
over the repo and push in one go. Never hand over loose individual files to be placed
by hand, and never make the maintainer hunt for where a file belongs.

## Secrets

No secret ever goes in the repo or in a committed file. The frontend uses only
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the anon key is public by design and
protected by Row Level Security). Everything else, the Supabase service-role key, the
Anthropic and OpenAI keys, and the Control Room feed URL and token, lives only in the
Supabase edge-function environment.

## The Control Room link

SQEPify reads active consultants and their Technical Director from the Control Room
through one read-only feed, on a schedule and on demand. It never writes back. The
feed URL and token are edge-function environment values, never in the repo.

## Database work

Follow `docs/DATABASE_WORKFLOW.md`. It is the authority on how database changes are
made and recorded. Do not restate its rules here; read them there.

## Finishing a piece of work

A change is not finished until it is recorded. Update `CHANGELOG.md`, and for a
database change include the exact SQL and the SQL to undo it. If a change alters what a
table is for, or who may read or write it, update `docs/SCHEMA.md` as well.
