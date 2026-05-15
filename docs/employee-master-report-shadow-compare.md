# Employee Master Report Shadow Compare

## Purpose

This phase adds an admin-only shadow comparison for the employee master report.

It compares the current employee master report population against a
tenant-scoped version of the same filtered population using
`Employee.organizationId = tenantContext.organizationId`.

It does not change the live report page.

It does not change CSV export behavior.

It does not change PDF export behavior.

## Existing Report Path

The live employee master report path remains:

- page:
  - `/reports/employee-master`
- CSV export:
  - `/api/reports/employee-master/export`
- PDF export:
  - `/api/reports/employee-master/export-pdf`

All three continue to use the existing report logic in:

- `lib/server/reports/employee-master.ts`

## Shadow Compare Helper

The new helper is:

- `getEmployeeMasterReportTenantShadowCompare({ filters, tenantContext })`

It returns:

- current report employee count
- tenant-scoped report employee count
- missing organization count
- excluded-by-tenant-filter count
- excluded employee list
- shadow warnings

## Admin Diagnostics Route

The shadow comparison is exposed only through:

- `GET /api/admin/auth/employee-master-shadow`

This route is admin-only and read-only.

It accepts the same filter query parameters as the live report path so
operators can compare the exact same report slice without touching the live
report UI or exports.

## Warnings

Possible warnings:

- `TENANT_CONTEXT_ORGANIZATION_ID_MISSING`
- `REPORT_EMPLOYEES_MISSING_ORGANIZATION`
- `TENANT_FILTER_EXCLUDES_REPORT_EMPLOYEES`

## Guardrails

- no change to `/reports/employee-master`
- no change to CSV export output
- no change to PDF export output
- no change to current report query filters
- no tenant enforcement

## Why This Matters

This extends the proven shadow-compare approach from the employee directory to
another employee-centered read surface before any real organization filtering
is introduced.

It helps validate report readiness while keeping all live reporting behavior
stable.
