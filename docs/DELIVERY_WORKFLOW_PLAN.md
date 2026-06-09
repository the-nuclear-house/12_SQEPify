# Delivery workflow — build tracker

Living checklist. `[x]` done and shipped, `[~]` in progress, `[ ]` to do.
Keep this updated every turn so nothing becomes silent technical debt.

## Agreed model (locked)
- A **diamond = one training occurrence** for a consultant: training + month + assigned trainer.
  Not one-per-competency.
- Training-plan Gantt = **one lane per training**. Competency progress stays in the spider + bars.
- A training can address several competencies (from the learning paths). Reassessment only
  covers the addressed competencies that are **required by the consultant's role**.
- Delivering a training **never** auto-moves a competency. Levels move only when the responsible
  TD reassesses and changes the stars (and it may be "no change"). The SQEPimeter moves only on a
  real level change.
- Diamond states: **planned** (grey) -> **delivered** (amber, trainer confirmed delivery) ->
  **assessed** (green, TD reassessed; may or may not have moved a level).
- A consultant becomes a **trainer** by being on the Approved Trainers list (linked to their user).
  That unlocks the trainer section of the dashboard. Trainer view != TD view: a consultant-trainer
  sees only the delivery part; a TD sees consultants + status + their own delivery Gantt.
- Superadmin can see and do everything.

## Steps
- [x] **1. Schema.** plan_items v2 (kind training|missing, trainer_id, statuses planned/delivered/assessed,
  delivered_at/by, assessed_at/by, competency_id + start_month nullable); plan_item_outcomes
  (per-delivery per-competency level = the history shown in the diamond card); RLS so trainers can
  see their assigned diamonds.
- [x] **2. Plan model rework.** Generation + plan editor + consultant Gantt move to lane-per-training.
  "Training Missing" lines where a path step has no training. Trainer dropdown per diamond (approved
  trainers of that training).
- [x] **3. Trainer dashboard.** Detect trainer; dashboard trainer section with their delivery Gantt,
  people icons with x2/x3 cohorts; cohort modal (names + each consultant's responsible TD); trainer
  marks delivered per consultant -> amber, with "Do you confirm you delivered X to Y?".
- [x] **4. TD reassessment.** Amber diamond on the consultant page -> reassess modal listing the
  role-required competencies that training addresses (prefilled stars) + comment -> save outcomes,
  diamond goes green, SQEPimeter moves on any change. History readable in the diamond card (consultant
  can read their own).
- [x] **5. Training Missing flow.** Missing line card -> "Create training and assign" -> training modal ->
  on create, offer to add it to that competency's learning path (level X->Y) -> adds to path and
  replaces the missing line in this consultant's plan (auto-refresh).
- [x] **6. Trainer move request.** Trainer proposes a month change -> request goes to the responsible
  TD -> TD accepts -> the diamond moves for both.

## Files touched (for the single final handover)
- supabase/delivery_workflow.sql  (NEW, the one consolidated migration to run)
- supabase/baseline/SCHEMA_BASELINE.sql
- docs/DELIVERY_WORKFLOW_PLAN.md (NEW), docs/SCHEMA.md, CHANGELOG.md
- src/lib/types.ts
- src/pages/ConsultantProfile.tsx
- src/index.css
(Will grow as later steps touch Dashboard.tsx, App.tsx, new components, etc.)

## Step 2 notes
No new SQL. Generation now produces one diamond per distinct training needed (kind 'training',
trainer unassigned) plus a 'missing' line per path gap with no training. The plan editor is
lane-per-training: drag to reschedule, + to add an occurrence, a trainer dropdown per diamond
(approved trainers of that training), and 'Training Missing' lanes shown with a dashed danger marker.
Diamond colours: planned grey, delivered amber, assessed green, plus a cyan dot when a trainer is set.
