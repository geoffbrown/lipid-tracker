# LipidLog — PRD v4 (Web)

**Status:** Draft for review. Supersedes `Cholesterol_PRD_v3_3.md` only where it
explicitly says so; v3.3 remains authoritative for everything else and remains
the spec of record for the deferred iOS app.

**How to read this.** This is a delta, not a replacement. Sections are headed
either CARRIES (v3.3 stands), CHANGES (v3.3 is superseded), REMOVED, or NEW.
Decisions that are not yet made are marked **OPEN** and collected at the end;
nothing downstream of an OPEN item should be treated as settled.

---

## 1. Decision & platform — CHANGES

v3.3 specifies a native iOS app. LipidLog is being built as a **web app first**,
on Supabase + Vercel, matching the stack already running for the grip strength
tracker. The iOS app is deferred, not cancelled.

The problem statement, the product thesis, and the biomarker model are unchanged.
What changes is the platform, and everything that hung off it: HealthKit, local-
only storage, and "no accounts".

### Reference implementation

`geoffbrown/grip-strength` is structurally the same app — timestamped numeric
measurements, a source, a trend chart, a history list — and is the intended
source of stack patterns. It runs **Next.js 16 (App Router) + TypeScript +
Tailwind 4 + Vitest**.

> **OPEN-1 — framework.** The handoff's session-1 plan says to scaffold Vite
> around the existing JSX. That conflicts with the reference implementation.
> Reusing grip's auth, storage abstraction, deploy pipeline and RLS work means
> adopting Next.js and converting `LipidLog.jsx` into TypeScript components —
> more up-front work than a Vite wrapper, but it is where the reuse actually
> lives. Recommendation: take Next.js. Decide before any scaffolding.

`src/calc.js` is deliberately free of React, DOM and storage dependencies so it
drops into either choice unchanged.

---

## 2. Biomarker model — CARRIES

Unchanged from v3.3 §Biomarker Model:

- TC, HDL, LDL (device-reported) and TG as stored inputs; ApoB manual entry for
  Lab sources only.
- Both LDL methods, user-selectable; ApoB via INTERHEART (default) or Aggressive.
- TC/HDL and TG/HDL derived dynamically, never stored, divide-by-zero guarded.
- Lp(a) as a user-level setting, never per-reading.
- Device LDL is canonical and never overwritten; calculated LDL is a display
  overlay.
- Split source pools — Home Devices vs Lab Sources — strictly separated.
- Partial readings allowed, minimum one lipid value.

---

## 3. Calculation changes — CHANGES

### 3.1 Triglyceride ceiling (NEW)

v3.3 defines no upper bound on the LDL estimates. It warns outside TG 20-1000
and otherwise calculates at any value. This is wrong at the top of that range:
Friedewald is invalid at TG >= 400 mg/dL because the TG/5 term stops
approximating VLDL-C, and the Martin-Hopkins divisor table is not validated
beyond it either.

**Specification.** At TG >= 400 mg/dL:

- Both Friedewald and Martin-Hopkins estimates are withheld. No divisor is
  extrapolated.
- The reading falls back to the device- or lab-reported LDL, labelled
  **"LDL-C (Reported)"** — distinct from "LDL-C (Device Reported)", which means
  the user chose the device value, not that the estimate was unavailable.
- The reading detail states why in plain language.
- Entry warns at save time, non-blocking.
- Non-HDL and ApoB are unaffected: neither depends on the TG term.

This adds a display label to v3.3 §Calculation Architecture > Display labels.

### 3.2 Martin-Hopkins divisor table — **BLOCKING**

> **OPEN-2 — the divisor table is not to spec, and this is the highest-priority
> open item in the project.**

v3.3 specifies: *"The adjusted divisor varies based on TG level **and non-HDL
cholesterol strata**."* The implementation in `src/calc.js` is keyed on
triglycerides alone — an 18-row, one-dimensional table, not the published
180-cell TG x non-HDL matrix.

This is measurable, not theoretical. v3.3 also claims Martin-Hopkins runs
*"consistently 6-7 mg/dL higher than Friedewald"*. Across 1,792 realistic
readings (TC 150-280, HDL 35-70, TG 50-200) the current implementation produces:

| statistic | MH − Friedewald |
|---|---|
| median | 3.7 mg/dL |
| maximum | 4.7 mg/dL |
| minimum | −0.8 mg/dL |
| within the stated 6-7 | 0.0% |

It never reaches the stated range, and cannot: the delta is structurally capped
below 5. Above TG ~195 the divisor drops under 5.0 and Martin-Hopkins goes
*lower* than Friedewald, so "consistently higher" does not hold either.

Two explanations, not mutually exclusive:

1. The 1-D table is a lossy collapse of the real one, whose divisors span
   roughly 3.1-11.9 and would produce larger deltas at low non-HDL.
2. The "6-7" figure is loose. Note the handoff states a *different* comparison —
   Martin-Hopkins vs **device-reported** LDL — which could well be 6-7 while
   MH vs Friedewald is ~4.

**Required before the port.** Obtain the authoritative Martin et al. table and
either implement the 2-D lookup or record, in this document, a deliberate
decision to ship the 1-D approximation with its error characterised. Do not
reconstruct the table from memory or inference — calculation accuracy is the
product's entire differentiator, and a plausible-looking wrong table is worse
than an acknowledged approximation.

Whichever way it resolves, the "6-7 mg/dL" sentence in v3.3 needs correcting or
qualifying; as written it describes behaviour the app does not have.

### 3.3 ApoB method changes — CARRIES (now implemented)

v3.3 requires a confirmation dialog before changing ApoB method, since the change
reprices every historical derived value. This was specified but missing; it now
exists and leaves lab-measured values untouched, per spec.

---

## 4. Validation — CHANGES

v3.3 §Data Validation carries in full, with one gap closed and one addition:

- **ApoB (manual): 20-250 mg/dL** warn range is now enforced. It was specified in
  v3.3 and absent from the implementation. Checked only for Lab sources, the only
  ones that collect it.
- **TG >= 400** now warns that the LDL estimates will be withheld (see §3.1).

The block-vs-warn distinction is unchanged and load-bearing: only negative
values, non-numeric input, HDL = 0, and an entirely empty reading block a save.
Everything else warns and saves.

> **Implementation note for the schema.** Warn ranges must **not** become database
> CHECK constraints. v3.3 deliberately allows out-of-range values to be saved
> after confirmation, and a physiologically implausible reading is still real
> data. Only the block rules belong in the schema. The grip tracker's
> `check (left_lbs >= 0 and left_lbs < 1000)` is a hard bound and should not be
> copied as a pattern here.

---

## 5. Accounts, storage & security — CHANGES

This section replaces v3.3 §Privacy, §Data Portability > local storage, and the
"No accounts / No cloud backend" goals. It is the largest delta in the document.

### 5.1 Accounts

Supabase magic-link auth, reusing grip's flow: `/login`, an `/auth/callback`
route handling both PKCE (`?code=`) and email-OTP (`?token_hash=&type=`) so the
link works regardless of email-template configuration.

When Supabase is not configured the app runs against a local store with **no
auth gate at all** — grip's `isSupabaseConfigured()` pattern. This is how the UI
stays runnable and screenshottable before any keys exist.

> The prototype previously shipped a sign-in screen that verified nothing: any
> syntactically valid email plus "Continue" entered the app, and the unverified
> address was persisted and displayed as the signed-in account. It has been
> removed. A gate that cannot enforce anything is worse than no gate, because it
> presents a security boundary that does not exist. The demo-mode pattern above
> is the honest version of the same convenience.

> **OPEN-3 — single-user or multi-user.** The handoff leaves this open. The
> recommendation is **multi-user from day one**, for three reasons: the grip
> schema is already shaped that way (`user_id` defaulting to `auth.uid()`, RLS on
> every verb), so it costs nothing to adopt and is the migration the handoff
> worries about retrofitting; Lp(a) being user-level already implies a user
> record even in the single-user case; and RLS is what makes the anon key safe to
> ship in the browser bundle. Deciding otherwise is legitimate but should be
> deliberate.

### 5.2 Schema (proposed)

Mirrors grip's patterns. `readings` holds raw inputs only — every derived value
is computed at read time by `src/calc.js`, so changing the ApoB or LDL method
reprices history with no migration, exactly as v3.3 requires.

```sql
create extension if not exists "pgcrypto";

create table if not exists public.readings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ts            timestamptz not null,
  source        text not null check (source in ('POC','Lab')),
  source_name   text not null,
  tc            double precision check (tc  >= 0),
  hdl           double precision check (hdl >  0),   -- HDL = 0 blocks a save
  ldl           double precision check (ldl >= 0),
  tg            double precision check (tg  >= 0),
  apob_measured double precision check (apob_measured >= 0),
  notes         text check (char_length(notes) <= 300),
  created_at    timestamptz not null default now(),

  -- v3.3: a reading needs at least one lipid value.
  constraint readings_min_one_value check (num_nonnulls(tc, hdl, ldl, tg) >= 1),
  -- v3.3: manual ApoB is accepted for Lab sources only.
  constraint readings_apob_lab_only check (apob_measured is null or source = 'Lab')
);

create index if not exists readings_user_ts_idx
  on public.readings (user_id, ts desc, id desc);

-- Account-level settings: these follow the user across devices.
create table if not exists public.profiles (
  user_id            uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  ldl_method         text not null default 'martin-hopkins'
                       check (ldl_method in ('none','friedewald','martin-hopkins')),
  apob_method        text not null default 'interheart'
                       check (apob_method in ('interheart','aggressive')),
  lpa                double precision check (lpa >= 0),
  lpa_unit           text default 'mg/dL' check (lpa_unit in ('mg/dL','nmol/L')),
  default_source     text default 'POC' check (default_source in ('POC','Lab')),
  default_device     text,
  default_lab_source text,
  home_devices       text[] not null default '{}',
  lab_sources        text[] not null default '{}',
  updated_at         timestamptz not null default now()
);
```

RLS on both tables, all four verbs, `auth.uid() = user_id` — copied from grip's
`0001_init.sql`, which is the piece most worth taking verbatim.

Two notes on the source pools. They are `text[]` here for simplicity; a separate
`sources` table would model rename and delete more cleanly, and is worth
considering given the app already supports both. And `source_name` is stored
denormalised on each reading so that renaming a device does not silently rewrite
history — v3.3 §Source Rules requires historical readings to be unaffected by
settings changes.

### 5.3 Device-local vs account-level state

Grip draws this line and LipidLog should too:

- **Account-level** (Postgres, follows the user): Lp(a) and its unit, LDL method,
  ApoB method, default source, device and lab pools.
- **Device-local** (`localStorage`, never synced): theme, selected biomarker,
  selected time range, comparison overlay selection, collapsed-group state.

LDL and ApoB method are account-level despite looking like view preferences —
they change the numbers, not just the presentation.

### 5.4 Privacy & threat model — CHANGES

v3.3 §Privacy asserts no accounts, no external transmission, and local-only
storage. None of that survives the move to a hosted backend, and the section
needs rewriting rather than amending. Minimum content:

- Personal health data now leaves the device and is stored by a third-party
  processor (Supabase) and served through a third-party host (Vercel). Say so.
- Row-level security is the sole barrier between users' data. It is enforced in
  Postgres, not in the client, and the anon key is publishable precisely because
  of that. State the dependency explicitly.
- The `service_role` key is a real secret, must never reach the client bundle or
  the repository, and is not required by this app.
- Sign-in email addresses are now personal data held in `auth.users`.
- Retention and deletion: what "delete my account" does. `on delete cascade` is
  specified above; the user-facing flow is not yet designed.
- No third-party analytics SDKs — this v3.3 commitment carries and should be
  restated, since a hosted app makes it easy to breach by default.

---

## 6. Apple Health — REMOVED

v3.3 §Apple Health Integration is deleted in its entirety, along with the
per-reading HealthKit UUID, sync status, edit-time delete-and-rewrite lifecycle,
retry flow, and permission handling. There is no web equivalent.

Consequences elsewhere:

- §Onboarding step 3 (optional Health connection) is removed.
- §Settings > Apple Health connection status is removed.
- §Partial Data Handling loses its HealthKit clause.
- §Success Criteria loses two of five entries — "consistent Apple Health sync
  adoption" and "no duplicate HealthKit samples" — and a third, "no unresolved
  sync failures", now refers to Supabase writes rather than HealthKit.

### Revised success criteria

- Repeat usage across multiple testing cycles.
- Users no longer relying on external spreadsheets.
- Readings entered on one device are present on another without user action.
- No data loss: every saved reading is durably persisted and retrievable.

---

## 7. Data portability — CHANGES

CSV export carries from v3.3 and is now the only export path, so it has to be
correct. Two defects fixed:

- Fields are escaped per RFC 4180. Previously only `notes` was quoted, while
  localised dates ("Sep 6, 2026") and user-supplied device names both routinely
  contain commas — every row was silently misaligned.
- The `Date` column is now an ISO 8601 timestamp. v3.3 requires minute precision;
  the export rendered a date only and discarded the time of day.

Import remains out of scope, as in v3.3 — but note the export is now also the
migration path out of the prototype, which raises the bar on its fidelity.

---

## 8. UI surface — CARRIES

v3.3 §Pages, §Visualization, §History View, §Reference Ranges, §Notes and
§Timestamp all carry unchanged.

Onboarding carries minus the HealthKit step, and is currently unimplemented: the
prototype has no onboarding flow. The medical disclaimer requirement (v3.3
§Legal — shown during onboarding and accessible in Settings) is currently met in
Settings only.

---

## 8.1 Visual direction — NEW

SF Pro / SF Symbols / HIG references in v3.3 are void on web. The visual system
takes its direction from the grip strength tracker.

This is a smaller change than it sounds. Both apps already state the same thesis
almost word for word — grip's tokens are headed *"Swiss type & grid ×
contemporary app surfaces"*, LipidLog's *"Swiss-neutral. Chrome is monochrome
(ink / paper); data carries colour."* The merge is mostly mechanical, and where
the two disagree grip is usually the more considered of the pair.

### 8.1.1 Adopt from grip

- **Token architecture.** Tailwind 4 `@theme` custom properties, with the dark
  theme redefining the same properties inside `@layer base .dark`. Re-theming
  the properties re-themes every utility, so there is one place to change a
  colour. LipidLog's current inline style objects threaded through React context
  cannot survive the port regardless.
- **Pre-paint theme script.** Grip sets the `.dark` class from a blocking inline
  script before first paint (`lib/theme.ts`), reading `localStorage` with an
  `auto` default that follows `prefers-color-scheme`. This removes the flash of
  wrong theme that LipidLog's context-based approach has on every load.
- **The neutral ramp**, including its contrast tuning — see §8.1.4.
- **Typography: the system stack** (`"Helvetica Neue", Helvetica, Arial,
  sans-serif`) with `.tabular` (`font-variant-numeric: tabular-nums`) for
  figures. This replaces LipidLog's Plus Jakarta Sans and DM Mono, which are
  injected at runtime by appending a Google Fonts `<link>` to `document.head`.
  Dropping them removes a render-blocking third-party request, a font-swap
  flash, and — given §5.4 — a per-visit request to Google carrying the user's IP
  from a health app. Tabular numerals come from a font feature rather than a
  second webfont.
- **The `.card` surface**: paper background, 1px hairline border, 1rem radius,
  and the two-layer `--shadow-card`. LipidLog's cards are currently flat with no
  elevation.
- **The print stylesheet.** Grip's `@media print` block sets page margins, forces
  `print-color-adjust: exact` so chart fills survive, flattens shadows, and marks
  `.no-print` / `.print-break-avoid`. LipidLog has a report view and none of
  this.
- **`prefers-reduced-motion`.** Grip disables its entrance animations under it.
  LipidLog animates sheets and toasts with no such guard — an accessibility
  defect, not a preference.
- **The interaction-affordance block**: restored `cursor: pointer` on controls
  (Tailwind 4 Preflight drops it), `touch-action: manipulation` to remove tap
  delay, `overscroll-behavior: none`, and the native number-spinner reset.

### 8.1.2 Extend rather than copy — the data palette

This is where grip stops being a template. It charts three series
(`--color-series-avg` / `-left` / `-right`). LipidLog charts **seven**
biomarkers, each with a fixed identity: LDL red, HDL green, TC blue, TG orange,
ApoB violet, TC/HDL teal, TG/HDL pink. Grip's three-colour scale does not
extend, and the biomarker colours carry domain meaning — LDL-red and HDL-green
are conventional and worth keeping.

So LipidLog needs its own `--color-bm-*` scale of seven, sitting alongside grip's
neutral and semantic tokens rather than replacing them.

One thing to take from grip while building it: **grip defines its series colours
twice**, once per theme, lightening them for dark surfaces (`#2563eb` →
`#93c5fd`). LipidLog uses a single fixed palette described as *"mid-tone,
legible on both light and dark"* — a compromise that serves neither surface
optimally. The seven biomarker colours should each get a light and a dark
variant and be contrast-checked against both canvases.

Source identity (Home green `#1B9E5A` / Lab blue `#2E6FE0`) currently collides
with two biomarker colours. Resolve it while the palette is being rebuilt —
source is metadata and should probably read as a neutral or outline treatment
rather than competing with the data colours.

### 8.1.3 Conflict to resolve — green and red mean two things

Grip deliberately keeps its chart series off red and green so those stay free
for `--color-up` / `--color-down` gain-and-loss semantics. LipidLog cannot do
that, because red and green *are* two of its biomarker identities.

It currently has the collision both ways: `StatCard` renders a favourable trend
in `t.success` (green) and an unfavourable one in `t.sec` (grey) — so green
means both "HDL" and "improving", while the unfavourable case is not red at all,
which is inconsistent on its own terms.

Recommendation: keep the biomarker palette as identity, and stop using hue to
carry trend direction. The ▲/▼ glyph already present is doing that work; render
it in `--color-ink-soft` in both directions, and drop `--color-up`/`--color-down`
from the trend indicator. Reserve semantic red for destructive actions and
validation errors only.

### 8.1.4 Accessibility debt to clear in the port

Grip's neutral ramp has been contrast-tuned, with the reasoning left in the
source (*"darkened from #9a9aa1 for ~4:1 AA-ish contrast"*). LipidLog's has not,
and it currently fails:

| token | on | ratio | |
|---|---|---|---|
| LipidLog `muted` `#A1A1AA` | light `#F4F4F5` | **2.33:1** | fails |
| LipidLog `muted` `#56565C` | dark `#0C0C0D` | **2.68:1** | fails |
| LipidLog `sec` `#71717A` | light `#F4F4F5` | 4.40:1 | marginal |
| grip `ink-faint` `#7c7c84` | light `#f5f5f2` | 3.79:1 | large text only |
| grip `ink-soft` `#6c6c73` | light `#f5f5f2` | 4.77:1 | passes |
| grip `ink-faint` `#85858d` | dark `#0d0d0f` | 5.30:1 | passes |

`muted` is not decorative in LipidLog. It carries the ApoB and LDL provenance
labels, the reference-range strings, and the disclaimer note — the text that
tells a user *which method produced the number they are looking at*. Adopting
grip's ramp fixes this as a side effect; adopting only its layout would not.

## 8.2 Trend chart — CHANGES

v3.3 §Visualization carries, with the following made explicit. All of it is
implemented.

**The x-axis is a time scale.** It was a category axis keyed on a formatted date
string, which spaced every reading equally regardless of when it happened. On a
realistic history — weekly home tests, a seven-month gap, then a lab draw — a
194-day interval was drawn the same width as a 7-day one, stretching short-term
noise 5.5x and compressing the quiet stretch to nothing. Slope on that chart
carried no meaning, which is a problem for an app whose subject is longitudinal
change.

**Source is encoded in the mark.** A filled dot is a home device, a ring is a
lab draw, and an averaged bucket spanning both is drawn faded and claims
neither. A legend appears only when the visible data actually mixes sources.

This is the product thesis made visible. Device LDL under-reports Martin-Hopkins
by roughly the size of a real change between tests, so a step in the line that
coincides with a change of mark is method, not biology. Source was already shown
in every list and detail view; the chart — the one place the bias distorts an
inference — was the only view that hid it.

**Segments are straight.** Spline interpolation drew curvature through values
that were never measured; with readings weeks apart that is invention.

**A least-squares trend line is fitted** over the visible series and drawn
beneath it, dashed and dimmed — the "simple linear trend line" v3.3 §Interaction
specifies and never had. It requires three points, since with two the fit merely
retraces the segment already drawn. A caption states it in words: *"Trend −4.2
mg/dL over 6 months"*, alongside the averaging disclosure when one applies.

**The source filter carries the mark it filters on**, and sits above the chart
with the other controls that decide what is being looked at. Its Home and Lab
segments show the same filled dot and ring the chart draws, so one element
teaches the encoding and filters by it — replacing a separate legend above the
chart and a filter below it. The time range stays below the chart, next to the
axis it scopes.

**The three lead metrics are chosen by the user.** v3.3 fixes the dashboard on
LDL, HDL and ApoB. Each card is now a control: tapping it opens the biomarker
list — annotated with each metric's reference range — and the choice is stored
account-level, so it follows the user rather than the device. Picking a metric
already shown in another card swaps the two rather than duplicating it.

Cards read from the whole history rather than only the newest reading, so a
pinned metric still shows its last known value when the latest reading did not
include it, and a metric with no readings yet shows an em dash and stays
tappable. Every card names where its number came from — the LDL method, whether
ApoB was measured or estimated, or that a ratio was derived.

**The stat-card delta says what it measured.** It previously showed a bare
number: a 7-day change and an 8-month change rendered identically, and a delta
spanning a home-to-lab transition — mostly method bias — was coloured as
improvement. It now names its interval ("since Aug 12"), and where the two
readings come from different source types it names the other source instead
("vs Lab, Aug 12") and declines to colour the change as good or bad news.

---

### 8.1.5 Open question — which tokens are the source of truth?

The handoff lists Figma design tokens maintained via Tokens Studio and exported
as native variables and styles. Those were built for the iOS app and would need
re-exporting for web. Grip's tokens, by contrast, are already running in
production in the target stack.

Both cannot be authoritative. See OPEN-6.

---

## 9. Open decisions

| # | Decision | Blocks | Recommendation |
|---|---|---|---|
| OPEN-1 | Next.js vs Vite | All scaffolding | Next.js — that is where the reuse is |
| OPEN-2 | Martin-Hopkins divisor table | The port of `src/calc.js` | Obtain the source table before porting |
| OPEN-3 | Single-user vs multi-user | The schema | Multi-user — grip's shape, costs nothing now |
| OPEN-4 | Source pools as `text[]` or a table | The schema | `text[]` unless rename/delete needs auditing |
| OPEN-5 | Account deletion flow | Privacy section | Design before launch, not before build |
| OPEN-6 | Token source of truth: grip's tokens vs the Figma/Tokens Studio set | The visual system | Grip's — already running in the target stack; re-point Figma at it |
| OPEN-7 | Warm neutrals (grip `#f5f5f2`) vs LipidLog's cool zinc ramp | The neutral palette | Warm, for consistency across the two apps |
| OPEN-8 | System font stack vs the Plus Jakarta Sans / DM Mono webfonts | Typography | System stack — see §8.1.1 |

---

## 10. Verification debt

The calculator carries `test/calc.test.mjs`, which pins the divisor boundaries
and proves the extraction and the TG ceiling changed nothing inside the validated
range. Two gaps remain, both recorded here so they are not mistaken for done:

- `test/fixtures/validated-readings.json` is **empty**. The handoff states the
  calculator was validated against six real readings from personal test history;
  those readings are not in the repo. Until they are, the suite proves internal
  consistency, not correctness against ground truth, and reports as skipped.
  `synthetic-readings.json` is invented data and is labelled as such — it catches
  drift, it does not establish correctness.
- The persistence layer and the validation rules have no coverage. Chart
  aggregation is now covered by `test/chart.test.mjs` — the trend fit, span
  wording, and the bucketing rules that keep a bucket from claiming a source it
  does not have.

## 11. Reuse caution

The grip repo's `supabase/migrations/` contains only `0001_init.sql`, which
creates `readings`. The application code also reads and writes a `profiles`
table that exists in the live Supabase project but **is not in any migration**.
Copying the migrations directory alone will not reproduce that schema. LipidLog
should not inherit the gap: every table it uses belongs in a checked-in
migration.
