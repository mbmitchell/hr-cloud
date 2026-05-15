# Employee Master Export Parity Diagnostics UI

## Purpose

This phase surfaces employee master export parity diagnostics in the existing
admin auth diagnostics experience.

It is read-only.

It does not change:

- the live employee master report page
- CSV export behavior
- PDF export behavior
- tenant enforcement

## UI Location

The diagnostics panel is shown on:

- `app/admin/auth/page.tsx`

Section title:

- `Employee Master Export Parity Diagnostics`

## Data Source

The UI fetches:

- `GET /api/admin/auth/employee-master-export-parity`

## Displayed Signals

The panel shows:

- live page count
- CSV export count
- PDF export count
- tenant-shadow count
- missing organization count
- excluded-by-tenant-filter count
- warnings
- current flag state
- expected mismatch explanation when the page flag is enabled while exports
  remain global

## Operator Guidance

The panel explains:

- what parity means
- why CSV and PDF are still intentionally global
- why page/export mismatch can be expected during the current pilot
- when exports may eventually join
  `HR_CLOUD_ENABLE_EMPLOYEE_MASTER_TENANT_FILTER`

## Why This Phase Is Safe

- the UI is admin-only
- it consumes an existing read-only diagnostics endpoint
- it does not alter report queries or export queries
- it does not add any mutation actions

## Recommended Next Phase

The safest next phase is:

- readiness diagnostics severity refinement

That keeps the next change in the diagnostics and rollout-signal layer without
changing report behavior or export behavior.
