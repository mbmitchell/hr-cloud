# Employee Directory Shadow Results UI

## Purpose

This phase surfaces the employee directory tenant shadow compare in the
existing admin-only auth diagnostics UI.

It does not change the live employee directory behavior.

It does not apply tenant filtering.

It gives operators a read-only parity check before any real
`Employee.organizationId` filtering is considered.

## UI Location

- admin auth diagnostics page:
  - `/admin/auth`

## Data Source

The UI fetches:

- `GET /api/admin/auth/employee-directory-shadow`

That route remains admin-only and returns the shadow comparison for the
current admin context.

## What The UI Shows

- current visible employee count
- tenant-scoped visible employee count
- missing organization count
- excluded-by-tenant-filter count
- excluded employee list when present
- shadow warnings
- operator guidance for parity review

## Operator Interpretation

- Parity means the tenant-scoped comparison matches the current visible
  employee count, there are no employees missing organization assignments,
  and no shadow warnings are present.
- Missing organization means some visible employees still cannot be
  organization-scoped safely.
- Excluded-by-tenant-filter means an organization filter would remove some
  employees from the current directory if enforcement were enabled today.

## Guardrails

- no change to `/employees`
- no change to current employee visibility logic
- no change to authorization decisions
- no tenant enforcement
- no mutation controls

## Why This Matters

This creates an operator-facing validation step between the earlier
server-side shadow compare helper and any future enforcement work.

Operators can now confirm whether the default-organization rehearsal data is
already parity-safe or still needs organization cleanup.
