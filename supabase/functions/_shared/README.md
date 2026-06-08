# Shared AI client

`ai-client.ts` is the canonical AI client (the `callAI` helper). Because edge functions are
deployed by pasting into the Supabase dashboard (no CLI), each AI function embeds its own copy
of this block. If this file changes, update it here first, then re-paste into every function.

Functions that embed the client:
- parse-cv-nuclear
- (parse-requirement, compile-requirements, sqepify-plan — added as the workflow reaches them)
