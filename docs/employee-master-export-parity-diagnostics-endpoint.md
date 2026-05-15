# Employee Master Export Parity Diagnostics Endpoint

## Purpose

This phase adds a read-only admin diagnostics endpoint for comparing employee
master report page counts, export counts, and tenant-shadow counts without
changing live behavior.

It does not change:

- the live employee master report page
- CSV export behavior
- PDF export behavior
- tenant enforcement

## Endpoint

Path:

- `GET /api/admin/auth/employee-master-export-parity`

Authorization:

- existing admin role requirement only
- `SITE_ADMIN` or `HR_ADMIN`

## Returned Diagnostics

The endpoint returns:

- current live page count using the current page query seam
- current CSV export count using the current CSV export seam
- current PDF export count using the current PDF export seam
- tenant-shadow scoped count using `Employee.organizationId =
  TenantContext.organizationId`
- missing organization count
- excluded-by-tenant-filter count and row list
- feature flag state
- warnings
- explicit expected mismatch explanation when the live page flag is enabled
  while exports remain global

## Current Comparison Rules

Live page count is derived from:

- `getEmployeeMasterReport(filters, { tenantContext })`

CSV export count is derived from:

- `getEmployeeMasterExportRows(filters)`

PDF export count is currently derived from the same export rows seam:

- `getEmployeeMasterExportRows(filters)`

Tenant-shadow scoped count is derived from:

- `getEmployeeMasterReportTenantShadowCompare({ filters, tenantContext })`

## Why This Endpoint Is Safe

- it is admin-only
- it is read-only
- it does not alter page, CSV, or PDF routes
- it uses existing report seams and existing tenant-shadow logic
- it documents the expected temporary mismatch when the live page pilot flag is
  enabled but exports remain intentionally global

## Expected Warning Cases

The endpoint may emit:

- `TENANT_CONTEXT_ORGANIZATION_ID_MISSING`
- `PAGE_EXPORT_COUNT_MISMATCH`
- `CSV_PDF_COUNT_MISMATCH`
- `REPORT_EMPLOYEES_MISSING_ORGANIZATION`
- `TENANT_FILTER_EXCLUDES_REPORT_EMPLOYEES`
- `PAGE_FLAG_ENABLED_EXPORTS_REMAIN_GLOBAL`

## Recommended Next Step

The safest next phase is:

- employee master export parity diagnostics UI

That would surface this data for operators in the existing admin diagnostics
experience while still keeping all report and export behavior unchanged.
