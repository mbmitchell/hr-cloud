# Employee Directory Tenant Shadow Compare

## Purpose

This phase adds a read-only shadow comparison for the employee directory read
path.

The goal is to compare:

- current visible employees
- tenant-scoped visible employees using `Employee.organizationId = tenantContext.organizationId`

without changing the live `/employees` page behavior.

## What Was Added

Shadow compare helper:

- [lib/server/employees/employee-queries.ts](/Users/mmitchell/dev/hr-cloud/lib/server/employees/employee-queries.ts:1)
  - `getEmployeeDirectoryTenantShadowCompare(...)`

Admin-only diagnostics route:

- [app/api/admin/auth/employee-directory-shadow/route.ts](/Users/mmitchell/dev/hr-cloud/app/api/admin/auth/employee-directory-shadow/route.ts:1)

## What The Helper Returns

- current visible employee count
- tenant-scoped visible employee count
- missing organization count among current visible employees
- excluded employees under the shadow tenant filter
- warnings when `tenantContext.organizationId` is null

## Important Safety Rule

The live employee directory query remains unchanged:

- [app/employees/page.tsx](/Users/mmitchell/dev/hr-cloud/app/employees/page.tsx:1)
- [lib/server/employees/employee-queries.ts](/Users/mmitchell/dev/hr-cloud/lib/server/employees/employee-queries.ts:1)
  - `getEmployeeDirectoryEmployees(actorId)`

This phase does not alter:

- directory query filters
- employee visibility rules
- route permissions
- session behavior

## Warnings

Current shadow warnings:

- `TENANT_CONTEXT_ORGANIZATION_ID_MISSING`
- `VISIBLE_EMPLOYEES_MISSING_ORGANIZATION`
- `TENANT_FILTER_EXCLUDES_VISIBLE_EMPLOYEES`

## Success Criteria

Before any real tenant filter is applied to employee reads:

- default-org rehearsal data should produce the same visible employee ids in
  unscoped and tenant-scoped comparison when data is fully backfilled
- active visible employees should not be missing `organizationId`
- no authorization or session behavior should change

## Recommended Next Phase

The next safest step is to add the same shadow-compare pattern to the employee
master report read path before any live filtering is introduced there.
