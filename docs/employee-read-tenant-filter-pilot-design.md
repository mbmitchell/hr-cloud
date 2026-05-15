# Employee Read Tenant Filter Pilot Design

## Purpose

This document defines the first actual tenant-filter pilot design for employee
read paths on the `postgres-rehearsal` branch.

This is still a planning-only phase.

It does not change:

- runtime behavior
- Prisma schema
- query filters
- authorization behavior
- login or session behavior

## Employee Read Paths In Scope

### Employee Directory

User-facing path:

- [app/employees/page.tsx](/Users/mmitchell/dev/hr-cloud/app/employees/page.tsx:1)

Current read service:

- [lib/server/employees/employee-queries.ts](/Users/mmitchell/dev/hr-cloud/lib/server/employees/employee-queries.ts:1)
  - `getEmployeeDirectoryEmployees(actorId)`

Supporting visibility helper:

- [lib/server/employee-visibility.ts](/Users/mmitchell/dev/hr-cloud/lib/server/employee-visibility.ts:1)
  - `getVisibleEmployeeIds(actorId)`

### Employee Detail

User-facing path:

- [app/employees/[id]/page.tsx](/Users/mmitchell/dev/hr-cloud/app/employees/[id]/page.tsx:1)

Current read service:

- [lib/server/employees/employee-queries.ts](/Users/mmitchell/dev/hr-cloud/lib/server/employees/employee-queries.ts:1)
  - `getEmployeeProfilePageData(...)`

Additional read dependencies:

- onboarding summary helpers
- offboarding summary helpers
- document acknowledgement summary helpers
- compensation and benefits read helpers

### Employee Master Report And Exports

User-facing path:

- [app/reports/employee-master/page.tsx](/Users/mmitchell/dev/hr-cloud/app/reports/employee-master/page.tsx:1)

Current report service:

- [lib/server/reports/employee-master.ts](/Users/mmitchell/dev/hr-cloud/lib/server/reports/employee-master.ts:1)

Current export routes:

- [app/api/reports/employee-master/export/route.ts](/Users/mmitchell/dev/hr-cloud/app/api/reports/employee-master/export/route.ts:1)
- [app/api/reports/employee-master/export-pdf/route.ts](/Users/mmitchell/dev/hr-cloud/app/api/reports/employee-master/export-pdf/route.ts:1)

## Expected Current Behavior

### Employee Directory

Current behavior:

- authorization is still employee-centric
- visible employees are determined by role/permission plus manager visibility
- query filters are based on visible employee ids only
- no organization filter is applied

Important consequence:

- the employee directory is already a reduced read surface driven by
  `getVisibleEmployeeIds(actorId)`, which makes it the safest first place to
  introduce a shadow tenant comparison

### Employee Detail

Current behavior:

- access is decided by self, admin, executive, auditor, or manager rules
- the detail query reads one employee and a broad set of related records
- no organization filter is applied anywhere in the read path

Important consequence:

- the detail page is lower-volume but much broader in join surface, so it is
  not the safest first pilot

### Employee Master Report

Current behavior:

- admin-only access
- broad employee report with filters for status, department, role, manager,
  employment classification, sorting, and export
- no organization filter is applied

Important consequence:

- this is a strong second pilot candidate, but it is broader than the employee
  directory and has export implications

## Recommended Shadow/Compare Mode

Before any real tenant filter is enforced, the branch should add a shadow mode
for one selected read path.

Recommended shadow outputs:

- `unscopedResultCount`
- `tenantScopedResultCount`
- `differenceCount`
- `differenceIdsSample`
- `tenantContextOrganizationId`
- `warnings`

Recommended shadow warnings:

- `TENANT_CONTEXT_ORGANIZATION_ID_MISSING`
- `EMPLOYEE_WITHOUT_ORGANIZATION_IN_UNSCOPED_RESULTS`
- `SCOPED_RESULTS_DIFFER_FROM_UNSCOPED_RESULTS`

Recommended comparison approach:

1. run the current unmodified query
2. run a shadow query that adds `Employee.organizationId = tenantContext.organizationId`
3. compare counts and ids
4. return diagnostics only in admin/internal preview mode
5. keep the actual user-facing result based on the current unscoped query

## Safest First Route And Query For Shadow Comparison

Recommended first route/query:

- `getEmployeeDirectoryEmployees(actorId)` in
  [lib/server/employees/employee-queries.ts](/Users/mmitchell/dev/hr-cloud/lib/server/employees/employee-queries.ts:1)

Why this is the safest first seam:

- the underlying root table is `Employee`, which already has `organizationId`
- the route is already visibility-limited by employee ids
- the query is read-only
- result parity is easier to reason about than the broader employee-master report
- it avoids exports, PDF generation, and broader report formatting concerns

Recommended first consumer for shadow mode:

- a low-risk admin or internal diagnostics-only route, not the user-facing
  `/employees` page itself

Recommended first implementation shape:

- add a read-only comparison helper around the employee-directory query
- expose the comparison through an admin/internal diagnostics endpoint or
  preview route
- do not switch the real page to filtered results yet

## Why Employee Detail Should Not Be First

The employee detail path is a worse first pilot because:

- it fans out into many related data sets
- it mixes profile, benefits, documents, onboarding, offboarding, job changes,
  and acknowledgement summaries
- parity failures would be harder to isolate

## Why Employee Master Report Should Probably Be Second

The employee master report is a good follow-up pilot because:

- it is still read-only
- it is admin-only
- it remains employee-centered

But it is broader than the directory because:

- it drives CSV and PDF export flows
- it has more filters and summary totals
- parity changes would be more visible operationally

## Success Criteria Before Real Filtering

The pilot should not move from shadow mode to actual filtering until all of the
following hold:

1. same result count for default-org rehearsal data
2. same result ids for default-org rehearsal data
3. no authorization changes
4. no session changes
5. no missing-organization warnings for active employees in the pilot result set
6. no unexpected manager-visibility regressions in the unscoped versus scoped comparison
7. no route status code changes

## Implementation Guardrails

- do not change the live result set yet
- do not change existing employee visibility rules yet
- do not introduce tenant filtering to employee detail in the same phase
- do not combine the pilot with report export changes
- do not combine the pilot with auth or permission changes
- do not treat a default-organization fallback as proof that all employee data is ready

## Recommended Next Step After This Design

Implement the shadow comparison only for the employee directory read path in an
admin/internal diagnostics surface first, and keep the actual `/employees` page
unchanged until parity is demonstrated.
