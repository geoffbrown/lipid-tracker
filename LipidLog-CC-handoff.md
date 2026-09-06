# LipidLog — Claude Code Handoff Brief

## What this is

A cholesterol tracking app for people doing self-directed cardiovascular
optimization with at-home point-of-care devices (primarily the Curo L7).
The differentiator is calculation accuracy, not record aggregation:
device-reported LDL consistently underreports versus Martin-Hopkins by
roughly 6–7 mg/dL, and most home devices don't report ApoB at all.

Competitors like Guava Health import clinical lab PDFs. That's a different
job. This app understands the numbers rather than just displaying them.

## Decision (Sept 2026)

**Building the web app first.** Supabase + Vercel, matching the stack
already running for the grip strength tracker. The native iOS app is
deferred, not cancelled.

## Assets

| Asset | Location | Status |
|---|---|---|
| `LipidLog.jsx` | Downloaded from Claude artifact, May 26 2026 | Working prototype — **only copy** |
| `Cholesterol_PRD_v3_3.md` | Claude project files | Spec of record, iOS-oriented |
| Grip strength tracker | Local repo | Reference implementation for stack |
| Design tokens | Figma, via Tokens Studio | Exported as native variables/styles |
| `geoffbrown/cholesterol-tracker` | GitHub, private | Created for the iOS effort |

**`LipidLog.jsx` is the highest-value file here.** It contains the only
implementation of the biomarker calculator, validated against six real
readings from personal test history. Preserve that logic exactly when
porting — re-deriving the Martin-Hopkins divisor table from scratch is
error-prone and the PRD doesn't include it.

## Reuse from the grip strength tracker

Structurally the same app: timestamped numeric measurements, a source
device, a trend chart, a history list. Expected to carry over more or
less directly:

- Supabase client setup and env wiring
- Auth flow
- RLS policy shape
- Vercel project config and deploy pipeline

Needs to be extended rather than copied:

- LipidLog has multiple metrics per reading, not one value
- Two-metric comparison overlay on the chart
- Derived values computed at read time from stored raw inputs

## PRD v3.3 — what carries, what doesn't

**Carries over intact (the actual product thinking):**

- Biomarker model: TC, HDL, LDL, TG as stored inputs
- Both LDL methods — Friedewald and Martin-Hopkins, user-selectable
- ApoB derivation (INTERHEART default, Aggressive optional)
- TC/HDL and TG/HDL ratios, derived dynamically
- Lp(a) as a user-level setting, never per-reading — it's a stable
  genetic marker
- Device LDL is canonical and never overwritten; calculated LDL is a
  display overlay
- Split source pools: Home Devices vs Lab Sources, strictly separated
- Validation ranges and the block-vs-warn distinction
- Partial readings allowed, minimum one lipid value

**Dead on web — needs replacing:**

- The entire Apple Health section: HealthKit UUIDs, delete-and-rewrite
  on edit, sync status, permission handling. Also removes one of the
  stated success criteria.
- "No accounts, no cloud backend, local storage, iCloud backup
  recovery" → auth, Postgres, RLS. The Privacy section needs a real
  rewrite; there's now a threat model that didn't exist before.
- SwiftData models → Postgres schema
- SF Pro / SF Symbols / HIG → web equivalents (tokens already exist
  in Figma)

## Open question to settle first

**Single-user or multi-user from day one?**

Single-user skips most auth complexity now. But retrofitting `user_id`
across every table later is a migration annoying enough that it's worth
deciding deliberately rather than by default.

Note that Lp(a) being a *user-level* setting already implies a user
record exists somewhere, even in the single-user case.

## Session 1 plan

1. `git init` in the repo, commit `LipidLog.jsx` unchanged as the
   baseline. Do this before touching anything.
2. Read the grip tracker repo; note what's directly reusable.
3. Write `PRD-v4-web.md` as a delta against v3.3. Keep v3.3 in the repo
   — the iOS path isn't dead.
4. Scaffold Vite around the existing JSX so there's a dev server and
   real diffs.
5. Draft the Postgres schema, informed by both the JSX data shapes and
   the grip tracker's existing patterns.

## Kickoff prompt

> This repo will hold LipidLog, a cholesterol tracking web app. Read
> `LipidLog-CC-handoff.md` first, then `Cholesterol_PRD_v3_3.md`, then
> `LipidLog.jsx`. Also read the grip strength tracker repo at
> `<path>` — it's a working Supabase + Vercel app I want to reuse the
> stack setup from. Then let's talk through the schema before writing
> any code.