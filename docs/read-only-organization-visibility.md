# Read-Only Organization Visibility

## Purpose

This phase extends the existing admin identity diagnostics flow so operators can
review whether each employee is ready for the future:

- `Employee -> User`
- `User -> OrganizationMembership`
- `Employee.organizationId -> Organization`

It remains strictly read-only.

## What Was Added

Extended helper:

- [lib/server/auth/identity-linkage.ts](/Users/mmitchell/dev/hr-cloud/lib/server/auth/identity-linkage.ts:1)

Extended admin diagnostics UI:

- [app/employees/[id]/EmployeeIdentityDiagnosticsPanel.tsx](/Users/mmitchell/dev/hr-cloud/app/employees/[id]/EmployeeIdentityDiagnosticsPanel.tsx:1)

## Additional Read-Only Fields

The employee diagnostics flow now includes:

- `Employee.organizationId`
- organization slug/name/status when the employee organization exists
- whether the linked user has a membership in the employee organization
- membership role/status for that matching organization membership
- memberships in different organizations

## Additional Flags

New read-only diagnostics flags:

- `EMPLOYEE_MISSING_ORGANIZATION`
- `USER_MISSING_MEMBERSHIP_IN_EMPLOYEE_ORGANIZATION`
- `USER_HAS_MEMBERSHIP_IN_DIFFERENT_ORGANIZATION`
- `MEMBERSHIP_INACTIVE`

These flags do not enforce tenant behavior and do not block login.

## Operator Guidance Included In UI

The admin diagnostics panel now includes guidance for:

- employee missing organization
- employee linked to user but missing membership
- user with membership in a different organization
- inactive membership

## What Did Not Change

- login behavior
- session shape
- permissions behavior
- tenant enforcement
- PTO, documents, reports, onboarding, offboarding, jobs, or permission logic

## Recommended Next Phase

The next low-risk phase should be diagnostics workflow support:

1. connect the employee diagnostics view to preview-only organization membership backfill results
2. give operators a single review flow for identity, organization, and membership readiness
3. keep the UI read-only until organization remediation patterns are stable
