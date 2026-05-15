# Employee Master Export Seam Decision

## Purpose

This phase records the rollout decision for the employee master CSV and PDF
exports after the live employee master report page received a default-off
tenant filter pilot.

It is documentation-only.

It does not change runtime behavior.

## Current Behavior

### Live Employee Master Report Page

Current page path:

- `app/reports/employee-master/page.tsx`

Current service seam:

- `lib/server/reports/employee-master.ts`

Current behavior:

- the page resolves `TenantContext`
- the page passes `TenantContext` into `getEmployeeMasterReport(...)`
- the live page can be tenant-scoped only when
  `HR_CLOUD_ENABLE_EMPLOYEE_MASTER_TENANT_FILTER=true`
- the flag defaults to `false`
- with the flag off, page behavior remains unchanged

### CSV Export

Current export path:

- `app/api/reports/employee-master/export/route.ts`

Current export seam:

- `getEmployeeMasterExportRows(filters)`

Current behavior:

- CSV export authorizes with the existing admin role requirement
- CSV export parses filters directly from the request
- CSV export does not resolve `TenantContext`
- CSV export is always global today

### PDF Export

Current export path:

- `app/api/reports/employee-master/export-pdf/route.ts`

Current export seam:

- `getEmployeeMasterExportRows(filters)`

Current behavior:

- PDF export authorizes with the existing admin role requirement
- PDF export parses filters directly from the request
- PDF export does not resolve `TenantContext`
- PDF export is always global today

## Current Mismatch Risk

There is now a potential page/export mismatch when:

- the live page flag is enabled
- the current admin has a resolved `TenantContext.organizationId`
- the page becomes tenant-scoped
- the exports remain global

That creates a confusing operator experience:

- the on-screen report may show one population
- the exported CSV/PDF may contain a broader population

This mismatch is acceptable only as a temporary pilot state while the flag
remains default-off.

## Risk Of Scoping Exports Too Early

Scoping exports too early has its own risks:

- exported audit evidence may unexpectedly shrink before operators trust the
  scoped behavior
- CSV and PDF may diverge if they do not share the exact same seam
- operators may assume exports still represent whole-system data
- support and reconciliation become harder if the page and exports switch
  together before parity review is complete

Exports are also less forgiving than pages:

- operators often treat exported files as authoritative snapshots
- export mistakes are harder to spot than page-table differences
- downstream spreadsheet and PDF review workflows may not show obvious clues
  that scoping occurred

## Recommended Rollout Approach

Recommended strategy:

1. keep CSV and PDF exports intentionally global for now
2. keep the live page pilot default-off
3. validate page parity and operator understanding first
4. only after page behavior is trusted, move exports to the same rollout path

This keeps the current pilot narrow and avoids changing downloadable artifacts
too early.

## Flag Recommendation

Recommended export flag strategy:

- eventually use the same flag:
  - `HR_CLOUD_ENABLE_EMPLOYEE_MASTER_TENANT_FILTER`

But not yet.

Reason:

- page, CSV, and PDF should ultimately stay in sync under one tenant-filter
  rollout switch
- using separate long-term flags would increase drift risk
- one shared flag is the cleaner steady-state design once exports are ready

Recommended transition path:

1. keep exports global today
2. add explicit export-parity diagnostics or operator review notes if needed
3. when ready, adopt the same flag for:
   - `getEmployeeMasterExportRows(...)`
   - CSV route
   - PDF route

## Decision

For the current branch phase:

- live page may be tenant-scoped behind the default-off flag
- CSV export should remain intentionally global
- PDF export should remain intentionally global
- exports should eventually join the same flag, not a separate long-term flag

## Recommended Next Step

The next safest step is:

- add export parity review or diagnostics planning before moving CSV/PDF behind
  the same flag

That keeps behavior stable while reducing the risk of page/export confusion in
the next rollout phase.
