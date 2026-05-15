# Employee Master Feature-Flagged Tenant Filter

## Purpose

This phase adds a default-off feature flag for the live employee master report
page so the report can be tenant-scoped by `TenantContext.organizationId`
without changing default behavior.

## Flag

- `HR_CLOUD_ENABLE_EMPLOYEE_MASTER_TENANT_FILTER`

Default:

- `false`

## Scope

Included in this phase:

- live employee master report page:
  - `app/reports/employee-master/page.tsx`
  - `lib/server/reports/employee-master.ts`

Not included in this phase:

- CSV export
- PDF export
- any other report

## Behavior

### When the flag is `false`

- behavior remains identical to today
- no tenant filter is applied
- page results remain global under the existing report logic

### When the flag is `true` and `TenantContext.organizationId` exists

- the employee master report service filters employee rows to the current
  `TenantContext.organizationId`

### When the flag is `true` and `TenantContext.organizationId` is missing

- the live employee master report fails closed at the service seam and returns
  no report rows

This is intentionally limited to the live page path only for this pilot.

## Guardrails

- default behavior stays unchanged because the flag defaults to `false`
- exports remain unscoped in this phase
- no login, session, or permission behavior changes
- no Prisma schema changes
- no changes to other reports

## Why This Phase Is Safe

The employee master report already had:

- a clean report service seam
- a shadow compare diagnostic route
- a shadow-results diagnostics UI

That made it the lowest-risk report candidate for a default-off live pilot.

## Recommended Follow-Up

Before any production rollout:

1. validate the flag against rehearsal data with real operator review
2. decide whether CSV and PDF exports should follow the same flag
3. only then consider another low-risk report seam such as reporting structure
