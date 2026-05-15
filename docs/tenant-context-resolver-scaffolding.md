# Tenant Context Resolver Scaffolding

## Purpose

This phase adds a read-only server-side `TenantContext` resolver so the branch
can validate how tenant identity would resolve from the current employee-based
session before tenant enforcement begins.

This phase does not change:

- login behavior
- session shape
- authorization behavior
- repository behavior
- tenant scoping
- PTO, documents, reports, onboarding, offboarding, jobs, or permissions logic

## What Was Added

Server-side resolver:

- [lib/server/tenant-context.ts](/Users/mmitchell/dev/hr-cloud/lib/server/tenant-context.ts:1)

Admin-only diagnostics endpoint:

- [app/api/admin/auth/tenant-context/route.ts](/Users/mmitchell/dev/hr-cloud/app/api/admin/auth/tenant-context/route.ts:1)

Read-only auth diagnostics page section:

- [app/admin/auth/page.tsx](/Users/mmitchell/dev/hr-cloud/app/admin/auth/page.tsx:1)

## Resolved Shape

The resolver currently returns:

- `organizationId`
- `userId`
- `employeeId`
- `roleCodes`
- `permissionCodes`
- `source`
- `warnings`

It also includes read-only enrichment for diagnostics:

- resolved organization metadata
- linked user email and status metadata
- matching organization membership metadata

## Current Resolution Rules

Resolution order on this branch:

1. resolve the current authenticated `Employee` via existing auth helpers
2. resolve global role codes and permission codes using the current employee role model
3. resolve linked `User` from `Employee.userId` when present
4. resolve `organizationId` from `Employee.organizationId` when present
5. if the employee has no organization yet, attempt a read-only fallback to
   the known transition organization with slug `default-org`
6. if a linked user exists, check for a matching `OrganizationMembership`

## Current Source Values

The current resolver may return:

- `employee_session`
- `linked_user`
- `organization_membership`
- `transition_default_organization`

These source values are informative only in this phase.

## Warning Flags

Current warning flags:

- `EMPLOYEE_NOT_AUTHENTICATED`
- `EMPLOYEE_USER_LINK_MISSING`
- `EMPLOYEE_ORGANIZATION_MISSING`
- `DEFAULT_ORGANIZATION_FALLBACK_USED`
- `DEFAULT_ORGANIZATION_NOT_FOUND`
- `LINKED_USER_NOT_FOUND`
- `LINKED_USER_WITHOUT_IDENTITY`
- `LINKED_USER_WITHOUT_MEMBERSHIP_IN_EMPLOYEE_ORGANIZATION`
- `LINKED_USER_HAS_DIFFERENT_ORGANIZATION_MEMBERSHIP`

These warnings do not block requests. They exist only to make transition
readiness explicit.

## What This Still Does Not Do

- no authorization decisions use `TenantContext`
- no repository query is scoped by `organizationId`
- no route requires tenant context yet
- no session field was added
- no tenant enforcement occurs

## Recommended Next Phase

The next safest phase is to use the resolver in one additional read-only
internal/admin diagnostic surface and then introduce a thin request-edge helper
pattern:

1. expose tenant context alongside existing readiness diagnostics where useful
2. add a small helper pattern for route-edge resolution without changing route behavior
3. keep repository and business-module scoping out of scope until that pattern is stable
