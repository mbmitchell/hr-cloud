# Employee Master Export Parity Diagnostics Plan

## Purpose

This document defines how to validate parity between the employee master live
page and the employee master CSV/PDF exports before any tenant-scoped export
behavior is introduced.

It is a planning document only.

It does not change runtime behavior.

## Current Page And Export Seams

### Live Page

Path:

- `app/reports/employee-master/page.tsx`

Current seam:

- `getEmployeeMasterReport(filters, { tenantContext })`

Current behavior:

- the page authorizes with the existing admin role requirement
- the page resolves `TenantContext`
- the page passes `TenantContext` into the report service
- the page can become tenant-scoped only when
  `HR_CLOUD_ENABLE_EMPLOYEE_MASTER_TENANT_FILTER=true`
- with the flag off, the page remains global

### CSV Export

Path:

- `app/api/reports/employee-master/export/route.ts`

Current seam:

- `getEmployeeMasterExportRows(filters)`

Current behavior:

- the route authorizes with the existing admin role requirement
- the route parses filters directly from the request
- the route does not resolve `TenantContext`
- the export is global today

### PDF Export

Path:

- `app/api/reports/employee-master/export-pdf/route.ts`

Current seam:

- `getEmployeeMasterExportRows(filters)`

Current behavior:

- the route authorizes with the existing admin role requirement
- the route parses filters directly from the request
- the route does not resolve `TenantContext`
- the export is global today

## Why Parity Diagnostics Are Needed

The live page and exports currently share filters but do not share tenant
context behavior.

That means there are two valid temporary states:

1. flag off
   - page is global
   - CSV is global
   - PDF is global

2. flag on
   - page may be tenant-scoped
   - CSV remains global
   - PDF remains global

The second state is acceptable only as a tightly controlled pilot.

Operators need explicit parity diagnostics so they can tell whether:

- the page is still aligned with exports
- a known temporary page/export mismatch is occurring
- missing organization data would make export rollout unsafe

## Recommended Parity Checks

Parity review should compare four counts for the same filter set:

1. live page count
2. CSV export count
3. PDF export count
4. tenant-scoped shadow count

### Count Definitions

#### Live Page Count

Definition:

- the count shown by the live employee master page result under current flag
  state

Notes:

- with the flag off, this should match the current global report count
- with the flag on, this may match the tenant-scoped count instead

#### CSV Export Count

Definition:

- the number of rows produced by the CSV export for the same filter set

Notes:

- today this remains global

#### PDF Export Count

Definition:

- the number of employee rows rendered in the PDF export for the same filter
  set

Notes:

- today this remains global

#### Tenant-Scoped Shadow Count

Definition:

- the count from the existing shadow compare logic using
  `Employee.organizationId = TenantContext.organizationId`

Notes:

- this is the best read-only estimate of future scoped behavior
- this should not change live exports today

## Expected Behavior While Exports Remain Global

### When The Flag Is Off

Expected:

- live page count = CSV export count
- live page count = PDF export count
- CSV export count = PDF export count
- tenant-scoped shadow count may be smaller, but should not affect behavior

Interpretation:

- this is the steady expected parity state for current production-like use

### When The Flag Is On And TenantContext.organizationId Exists

Expected:

- live page count may equal tenant-scoped shadow count
- CSV export count remains global
- PDF export count remains global
- live page count may be lower than both export counts

Interpretation:

- this is an expected temporary mismatch during the pilot
- operators must know that exports are intentionally broader

### When The Flag Is On And TenantContext.organizationId Is Missing

Expected:

- the live page may fail closed and return no rows
- CSV export count remains global
- PDF export count remains global
- shadow compare should warn that `TenantContext.organizationId` is missing

Interpretation:

- export rollout must not proceed until tenant context is reliably present for
  intended scoped users

## Recommended Diagnostics Shape

Before exports join the tenant filter, diagnostics should ideally expose:

- current page count
- current CSV count
- current PDF count
- current tenant-scoped shadow count
- missing-organization count
- excluded-by-tenant-filter count
- current flag state
- warnings for page/export mismatch

Recommended warning cases:

- `EXPORT_PAGE_COUNT_MISMATCH`
- `CSV_PDF_COUNT_MISMATCH`
- `TENANT_CONTEXT_ORGANIZATION_ID_MISSING`
- `REPORT_EMPLOYEES_MISSING_ORGANIZATION`
- `TENANT_FILTER_EXCLUDES_REPORT_EMPLOYEES`

## Go / No-Go Criteria Before Exports Join The Flag

Exports should not join `HR_CLOUD_ENABLE_EMPLOYEE_MASTER_TENANT_FILTER` until
all of the following are true:

### Go Criteria

- shadow diagnostics are stable and understood by operators
- default-org rehearsal data shows clean shadow parity for intended scoped users
- active report rows do not show unresolved missing-organization problems
- page behavior under flag-on has been reviewed by operators in preview
- CSV and PDF counts already match each other for the same filter set
- page/export mismatch is intentionally understood during pilot validation
- there is a documented rollback path by disabling the shared flag

### No-Go Conditions

- missing organization warnings remain unresolved for report rows
- tenant context is missing for admins expected to use scoped reporting
- CSV and PDF do not match each other for the same filter set
- operators cannot reliably explain why page and export counts differ
- page filtering behavior is still under active investigation

## Recommended Rollout Approach

Recommended sequence:

1. keep exports global
2. add parity diagnostics or review procedure for page vs CSV vs PDF vs shadow
3. validate operator understanding in preview
4. verify missing-organization count is acceptable
5. only then move exports to the same shared flag as the live page

The shared long-term flag should still be:

- `HR_CLOUD_ENABLE_EMPLOYEE_MASTER_TENANT_FILTER`

Exports should not receive a separate long-term flag unless rollout control
becomes absolutely necessary for a short-lived emergency.

## Recommended Next Phase

The safest next phase is:

- employee master export parity diagnostics design or implementation

That phase can remain read-only and should focus on comparing page, CSV, PDF,
and shadow counts before any export scoping behavior changes.
