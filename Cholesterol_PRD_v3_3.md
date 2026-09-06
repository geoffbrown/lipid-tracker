# Cholesterol Tracker — Product Requirements Document
## Version 3.3

---

## Problem

Several at-home cholesterol testing tools aim to simplify cardiovascular health monitoring. However, most lack smart or automatic data integration, making it difficult to track results over time. Users are often forced to create their own spreadsheets or ad-hoc systems to monitor progress. Additionally, many at-home tests do not report ApoB, a critical cardiovascular risk marker that can be reliably derived from standard lipid values. Device-reported LDL values also consistently underreport compared to calculated values using the Martin-Hopkins methodology. This creates fragmented data, incomplete insights, and unnecessary friction for people managing cholesterol outside of a clinical setting.

## Solution

A native iOS app that allows users to log lipid readings, automatically calculate derived biomarkers (ApoB, ratios, optional calculated LDL), visualize trends over time, and optionally write data to Apple Health (write-only). The app serves as the primary source of truth for longitudinal lipid tracking and provides more accurate LDL calculations than device defaults.

---

# Scope

## v1 Goals

- Structured manual entry of lipid readings
- Derived biomarker calculation (ApoB, ratios, optional calculated LDL)
- Longitudinal visualization with trend lines
- Lab vs POC source classification
- Write-only Apple Health integration
- Lp(a) stored as a user-level setting (not per reading)
- Clear validation and data integrity rules
- CSV export
- No accounts
- No cloud backend
- No bidirectional HealthKit merge
- No risk scoring

---

# Biomarker Model

## Primary Inputs (Per Reading)

- Total Cholesterol (TC)
- HDL
- LDL (device-reported)
- Triglycerides (TG)
- ApoB (manual entry allowed only for Lab source)

## User-Level Settings (Not Per Reading)

- Lp(a) — stored as a single persistent user setting, not per reading. Lp(a) is a genetic marker that does not meaningfully change over time. Apple Health does not support Lp(a). Storing it at the user level rather than per reading reflects its biological nature and differentiates this app from existing solutions.

## Derived Metrics

- ApoB (INTERHEART default or Aggressive optional)
- LDL-C (optional calculated overlay: Friedewald or Martin-Hopkins)
- TC/HDL ratio
- TG/HDL ratio

## Not Supported in v1

- ApoA-1
- ApoB/ApoA-1 ratio
- ASCVD or Framingham risk scoring
- Lipoprotein subclasses

---

# Calculation Architecture

## LDL Handling

- Always store device-reported LDL exactly as entered.
- Device LDL is canonical and never overwritten.
- Optional calculated LDL (Friedewald or Martin-Hopkins) may be enabled in Settings.
- When enabled, calculated LDL replaces displayed LDL in charts, tables, and CSV export.
- Original device LDL remains stored and is never deleted.
- Martin-Hopkins consistently produces values 6-7 mg/dL higher than Friedewald; this is expected and reflects more accurate LDL estimation at lower triglyceride levels.
- Display labels:
  - "LDL-C (Device Reported)"
  - "LDL-C (Calculated - Martin-Hopkins)"
  - "LDL-C (Calculated - Friedewald)"

### Friedewald Formula

LDL = TC - HDL - (TG / 5)

Requires: TC, HDL, TG

### Martin-Hopkins Formula

LDL = TC - HDL - (TG / Adjusted Divisor)

The adjusted divisor varies based on TG level and non-HDL cholesterol strata. Requires: TC, HDL, TG. More accurate than Friedewald at lower LDL and TG ranges.

## ApoB Handling

Supported methods (v1):

- INTERHEART-style regression estimation (Default)
- Aggressive / Risk-Weighted estimation

Rules:

- Store raw lipid inputs only.
- ApoB is dynamically derived unless directly measured (Lab source only).
- For Lab source:
  - If ApoB entered -> label "ApoB (Lab Measured)"
  - If not entered -> derive using selected method
- For POC source:
  - ApoB always derived
- Changing method:
  - Recalculates all historical derived ApoB values immediately
  - Does not affect lab-measured ApoB values
  - Reversible by switching back (no prior values stored)
  - Confirmation dialog required:
    "Changing from [Previous Method] to [New Method] will recalculate all derived values. Measured values will remain unchanged. Continue?"

## Ratios

- TC/HDL = TC / HDL
- TG/HDL = TG / HDL
- Derived dynamically
- Not editable
- Display only if required inputs exist
- Prevent divide-by-zero

---

# Lp(a) User Setting

- Lp(a) is stored as a single persistent value in user Settings, not attached to individual readings.
- User may enter or update their Lp(a) value at any time.
- Stored in nmol/L or mg/dL per user preference.
- Displayed in Settings and optionally surfaced in the individual reading detail view as persistent context.
- Not written to Apple Health (not supported by HealthKit).
- No validation range enforcement in v1 beyond basic numeric / non-negative checks.
- Not a per-reading field. Does not appear in Add/Edit Reading modal.

---

# Reading Source Model

## Source Types

- Point-of-Care (POC)
- Lab Test

## Supported Sources

POC:
- CURO L7 / L5
- CardioChek
- Accutrend Plus
- Manual Entry / Other

Lab:
- Lab Test

## Source Rules

- Each reading stores Source Type and Source Name.
- Default source is configurable in Settings (metadata only, does not affect calculations).
- Source is selectable per entry and can be overridden at time of entry.
- Changing the default source does not affect historical readings.
- Lab and POC readings are visually distinguished in all list and detail views.
- Source classification does not automatically change calculations.

---

# Data Validation

## Required Fields

- At least one lipid value (TC, HDL, LDL, or TG) must be present to save a reading.

## Block Save If

- Negative values
- Non-numeric input
- No lipid values entered (no required field present)
- HDL = 0

## Warn (Allow Save) If Outside Ranges

- TC: 80-500 mg/dL
- HDL: 10-150 mg/dL
- LDL: 20-400 mg/dL
- TG: 20-1000 mg/dL
- ApoB (manual): 20-250 mg/dL

## Additional Rules

- Derived metrics calculate only when required inputs are present.
- Missing derived values display as unavailable, not zero.
- Ratios prevent divide-by-zero.
- Partial readings are allowed and saved gracefully.

---

# Visualization

## Dashboard

- Time-series graph for selected biomarker
- Biomarker selector
- Time-range selector (30d, 90d, 1y, All) — available on Dashboard and Drill-Down only
- Recent Readings section
- Optional two-metric comparison overlay (max two metrics simultaneously)

## Interaction

- Tap data points to view exact value and timestamp
- Display simple linear trend line
- No pinch-to-zoom in v1
- No moving averages in v1
- No advanced statistical overlays in v1

## Drill-Down View

- Expanded graph for single biomarker
- Same time-range selector
- Same tap-to-inspect interaction

## History View

- Full chronological list of all readings
- No time-range selector (always shows complete history)
- Lab and POC readings visually distinguished

---

# Reference Ranges

- Display general non-diagnostic reference ranges in individual reading view.
- Informational only.
- No automated classification (e.g., "High" / "Low" labels).
- No treatment guidance.

---

# Notes

- Freeform note per reading.
- 300 character limit.
- Truncated preview in list views.

---

# Timestamp

- Stored to minute precision.
- Default to current date/time on new entry.
- User-editable before saving.

---

# Partial Data Handling

- Allow saving readings with partial lipid inputs (minimum: one lipid value).
- Derived metrics compute only if required inputs exist.
- Missing derived values display as unavailable.
- Apple Health writes only metrics that are present in the reading.

---

# Onboarding

1. Welcome screen with purpose statement and medical disclaimer
2. Default source selection (pre-selects device/lab type for new readings)
3. Optional Apple Health connection
4. Done -> Dashboard

- No account creation required
- HealthKit connection is optional and skippable

---

# Apple Health Integration (Write-Only)

## Core Principles

- App is the primary source of truth.
- Apple Health is a write-only destination.
- No bidirectional merge.
- No silent overwrites.

## Write Behavior

- Write only metrics present in the reading.
- Derived metrics written only if calculation mode is enabled and required inputs exist.
- No placeholder or zero values written to HealthKit.

## Data Stored Per Reading

- Local UUID
- HealthKit UUID (nullable)
- Sync Status: Not Synced | Synced | Sync Failed

## Edit Lifecycle

- On edit of a synced reading:
  - Attempt to delete the existing HealthKit sample using stored HealthKit UUID.
  - If deletion succeeds -> write updated sample -> store new HealthKit UUID.
  - If deletion fails -> do not write new sample (prevents duplication) -> mark reading as Sync Failed.
- Alert user only on sync failure. No success confirmation displayed.

## Sync Status & Error Handling

- Display sync status indicator in individual reading detail view (Not Synced, Synced, Sync Failed).
- Failed syncs require manual retry from the individual reading detail view.
- No automatic retry in v1.

## Permission Handling

- If HealthKit permissions are revoked:
  - Notify user.
  - Suspend all write attempts.
  - Resume only after user manually restores permissions and triggers retry.

---

# Data Portability

- All data stored locally on device.
- Recoverable via iOS device backup (iCloud).
- CSV export of all readings available (raw inputs + derived values).
- No import flow in v1.

---

# Privacy

- No accounts.
- No third-party analytics SDKs in v1.
- No external data transmission beyond optional HealthKit write.

---

# Legal

- Include medical disclaimer stating the app is for informational purposes only and does not replace professional medical advice.
- Display during onboarding and accessible in Settings.

---

# Pages

- Home (Dashboard)
- History (Full List)
- Individual Reading
- Add/Edit Reading (Modal)
- Settings

---

# Settings Contents

- Default source selection
- LDL calculation method (Off / Friedewald / Martin-Hopkins)
- ApoB calculation method (INTERHEART / Aggressive)
- Lp(a) value entry
- Apple Health connection status
- Medical disclaimer
- CSV export

---

# Success Criteria

- Repeat usage across multiple testing cycles.
- Consistent Apple Health sync adoption.
- Users no longer relying on external spreadsheets.
- No duplicate HealthKit samples.
- No unresolved sync failures.

---

# Non-Goals (v1)

- Risk scoring (ASCVD, Framingham)
- Clinical decision support
- Medication tracking
- Cloud accounts
- Bidirectional HealthKit sync
- Lp(a) per-reading tracking (stored as user setting instead)
- ApoA-1
- Lipoprotein subclasses
- Import flow
- Automatic HealthKit retry
