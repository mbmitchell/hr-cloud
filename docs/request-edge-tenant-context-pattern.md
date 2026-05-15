# Request-Edge Tenant Context Pattern

## Purpose

This phase adds a small helper pattern for read-only admin and internal routes
so they can resolve `TenantContext` once at the route edge after existing
authorization succeeds.

This phase does not change:

- login behavior
- session shape
- authorization decisions
- repository behavior
- tenant scoping
- PTO, documents, reports, onboarding, offboarding, jobs, or permissions logic

## What Was Added

Route-edge helper:

- [lib/server/tenant-context-route.ts](/Users/mmitchell/dev/hr-cloud/lib/server/tenant-context-route.ts:1)

Updated routes:

- [app/api/admin/auth/tenant-context/route.ts](/Users/mmitchell/dev/hr-cloud/app/api/admin/auth/tenant-context/route.ts:1)
- [app/api/admin/auth/readiness/route.ts](/Users/mmitchell/dev/hr-cloud/app/api/admin/auth/readiness/route.ts:1)
- [app/api/admin/auth/identity-linkage/route.ts](/Users/mmitchell/dev/hr-cloud/app/api/admin/auth/identity-linkage/route.ts:1)
- [app/api/admin/auth/organization-memberships/route.ts](/Users/mmitchell/dev/hr-cloud/app/api/admin/auth/organization-memberships/route.ts:1)

## Pattern

The pattern is intentionally small:

1. run the existing admin or role authorization helper first
2. after authorization succeeds, resolve `TenantContext`
3. return both the existing authorized actor and the read-only `TenantContext`
4. use the resolved context for diagnostics only in this phase

Current helpers:

- `requireRoleWithTenantContext(...)`
- `requireAdminWithTenantContext(...)`

## Why This Pattern Is Safe

- it keeps existing auth helpers authoritative
- it does not change role or permission evaluation
- it does not change session contents
- it does not scope Prisma queries
- it creates a stable route-edge calling convention for later phases

## Response Shape Changes

The readiness diagnostics route now includes a clearly labeled
`tenantContext` field alongside the existing readiness payload.

The tenant-context route still returns the same top-level
`tenantContext` diagnostics payload.

The following preview-only diagnostics routes now also include a clearly
labeled `tenantContext` field:

- `GET /api/admin/auth/identity-linkage`
- `GET /api/admin/auth/organization-memberships`

The corresponding `POST` apply routes were intentionally left unchanged in this
phase so the pattern remains read-only first.

## Example Adoption

Current low-risk adoption examples:

1. `GET /api/admin/auth/readiness`
   - existing admin authorization remains authoritative
   - route now returns readiness data plus `tenantContext`
2. `GET /api/admin/auth/identity-linkage`
   - existing admin authorization remains authoritative
   - route now returns coverage preview plus `tenantContext`
3. `GET /api/admin/auth/organization-memberships`
   - existing admin authorization remains authoritative
   - route now returns membership preview plus `tenantContext`

## Recommended Next Phase

The next safest phase is a read-only adoption step:

1. use the same request-edge helper in one or two additional internal/admin
   routes
2. keep repository and service behavior unchanged
3. confirm the route-edge calling convention stays stable before any scoping work
