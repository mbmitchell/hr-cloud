# Employee Master Shadow Results UI

## Purpose

This phase surfaces the employee master report tenant shadow compare in the
existing admin-only auth diagnostics UI.

It does not change the live employee master report.

It does not change CSV export behavior.

It does not change PDF export behavior.

It gives operators a read-only parity check before any real
organization-scoped reporting is introduced.

## UI Location

- admin auth diagnostics page:
  - `/admin/auth`

## Data Source

The UI fetches:

- `GET /api/admin/auth/employee-master-shadow`

That route remains admin-only and returns the shadow comparison for the
current admin context.

## What The UI Shows

- current report employee count
- tenant-scoped report employee count
- missing organization count
- excluded-by-tenant-filter count
- excluded employee list when present
- shadow warnings
- operator guidance for report parity review

## Operator Interpretation

- Parity means the tenant-scoped comparison matches the current report
  employee count, there are no employees missing organization assignments,
  and no shadow warnings are present.
- Missing organization means some report employees still cannot be
  organization-scoped safely.
- Excluded-by-tenant-filter means an organization filter would remove some
  employees from the current employee master report if enforcement were
  enabled today.

## Guardrails

- no change to `/reports/employee-master`
- no change to CSV export output
- no change to PDF export output
- no change to current report query filters
- no tenant enforcement
- no mutation controls

## Why This Matters

This creates an operator-facing validation step between the earlier
server-side employee master shadow compare helper and any future tenant-aware
report scoping work.
