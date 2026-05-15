# Tenant Context Design

## Purpose

This phase defines the future tenant context pattern for the `postgres-rehearsal`
branch before any organization scoping is enforced.

The design goal is to introduce a single server-side context object that can
eventually carry tenant identity and authorization inputs across routes,
services, reports, and internal jobs without changing current login behavior or
session shape in this phase.

This document is planning-only.

It does not change:

- login behavior
- session shape
- permissions behavior
- repository behavior
- tenant enforcement
- PTO, documents, reports, onboarding, offboarding, jobs, or API scoping

The branch now also has an initial read-only resolver scaffold described in
[docs/tenant-context-resolver-scaffolding.md](/Users/mmitchell/dev/hr-cloud/docs/tenant-context-resolver-scaffolding.md:1).

The branch now also has a request-edge route helper pattern described in
[docs/request-edge-tenant-context-pattern.md](/Users/mmitchell/dev/hr-cloud/docs/request-edge-tenant-context-pattern.md:1).

## Current Backend Resolution Pattern

The current app is still employee-centric.

Current authenticated flow:

1. Auth.js sign-in resolves to an existing `Employee`
2. JWT stores only `employeeId`, email, and name
3. `lib/auth/current-user.ts` resolves the current actor back to `Employee`
4. `lib/server/authorization.ts` loads roles and permissions from
   `EmployeeRoleAssignment`
5. routes and services pass `actor.id` or `employeeId` directly into Prisma queries

Current important files:

- [auth.ts](/Users/mmitchell/dev/hr-cloud/auth.ts:1)
- [lib/auth/current-user.ts](/Users/mmitchell/dev/hr-cloud/lib/auth/current-user.ts:1)
- [lib/auth/access.ts](/Users/mmitchell/dev/hr-cloud/lib/auth/access.ts:1)
- [lib/auth/permissions.ts](/Users/mmitchell/dev/hr-cloud/lib/auth/permissions.ts:1)
- [lib/server/authorization.ts](/Users/mmitchell/dev/hr-cloud/lib/server/authorization.ts:1)
- [lib/server/employee-visibility.ts](/Users/mmitchell/dev/hr-cloud/lib/server/employee-visibility.ts:1)

Current architectural reality:

- the session identity is `Employee`-based, not `User`-based
- role and permission resolution is global, not organization-scoped
- manager relationships are global employee relationships
- reports query across the full employee table unless filtered by visibility
- internal jobs run as global platform/system actors
- services and routes usually accept raw `employeeId` instead of a contextual identity object

## Proposed Tenant Context Shape

Recommended future server-side shape:

```ts
export type TenantResolutionSource =
  | "employee_session"
  | "linked_user"
  | "organization_membership"
  | "transition_default_organization"
  | "internal_job"
  | "system";

export type TenantContext = {
  organizationId: string | null;
  userId: string | null;
  employeeId: string | null;
  roleCodes: string[];
  permissionCodes: string[];
  source: TenantResolutionSource;
};
```

Recommended optional expansion later:

```ts
export type TenantContext = {
  organizationId: string | null;
  userId: string | null;
  employeeId: string | null;
  roleCodes: string[];
  permissionCodes: string[];
  source: TenantResolutionSource;
  membershipId?: string | null;
  membershipRole?: string | null;
  membershipStatus?: string | null;
  resolvedFromDefaultOrganization?: boolean;
  warnings?: string[];
};
```

## Why This Shape Fits The Current App

This shape matches the existing branch state without forcing an early refactor:

- `employeeId`
  - remains the active application identity during transition
- `userId`
  - supports the new `User` and `UserIdentity` linkage work
- `organizationId`
  - supports future tenant ownership without making it required yet
- `roleCodes`
  - aligns with current `EmployeeRoleAssignment -> Role.code`
- `permissionCodes`
  - aligns with current role-permission derivation
- `source`
  - makes transitional resolution explicit and auditable

## Recommended Resolution Order During Transition

The future tenant context resolver should prefer the smallest number of new
rules while the app is still employee-first.

Recommended transition resolution order:

1. resolve current authenticated `Employee`
2. resolve linked `User` from `Employee.userId` if present
3. resolve `organizationId` from `Employee.organizationId` if present
4. if `Employee.organizationId` is missing during transition, optionally fall
   back to the known default organization
5. resolve `OrganizationMembership` only for diagnostics and future validation
   at first
6. resolve global role codes and permission codes from the current employee role
   model

Recommended transition rules:

- if there is a current authenticated employee, `employeeId` remains the anchor
- `userId` is nullable and should not block resolution
- `organizationId` is nullable and should not block resolution in the first implementation slice
- default organization fallback should be explicit and traceable
- membership lookup should enrich context but should not block requests yet

## Resolution By Source

### 1. Current Employee-Based Auth

Primary current source:

- `session.user.employeeId` from [auth.ts](/Users/mmitchell/dev/hr-cloud/auth.ts:307)
- resolved by [lib/auth/current-user.ts](/Users/mmitchell/dev/hr-cloud/lib/auth/current-user.ts:1)

Initial tenant context result:

- `employeeId`
  - resolved
- `roleCodes`
  - resolved from current employee assignments
- `permissionCodes`
  - resolved from current employee role permissions
- `organizationId`
  - resolved from `Employee.organizationId` when present
- `userId`
  - resolved from `Employee.userId` when present
- `source`
  - `"employee_session"`

### 2. Linked User

Available after current linkage scaffolding:

- `Employee.userId`
- `User`
- `UserIdentity`

Use during transition:

- enrich diagnostics and future routing decisions
- do not replace `Employee` as the primary app actor yet

Recommended source value:

- `"linked_user"`

### 3. OrganizationMembership

Available after membership backfill scaffolding:

- `OrganizationMembership` for linked `User`

Use during transition:

- validate that the linked user is actually represented in the employee organization
- expose membership mismatch or inactive status in diagnostics
- do not enforce membership as a hard gate yet

Recommended source value:

- `"organization_membership"`

### 4. Default Organization During Transition

Needed because this branch still contains copied single-company data.

Use case:

- `Employee.organizationId` is null
- the branch still operates as one copied organization
- later migration passes need a temporary tenant identifier for read/write scoping design

Recommended source value:

- `"transition_default_organization"`

Important rule:

- the fallback should be explicit and only used inside the future resolver layer
- downstream code should be able to see that the organization came from a transition fallback

## Where Tenant Context Should Be Required Later

### Repositories

Future requirement:

- every repository-like data-access helper that reads or writes tenant-owned
  business data should accept `TenantContext` or an extracted
  `organizationId`-aware subset

Examples of current future touchpoints:

- [lib/server/employees/employee-queries.ts](/Users/mmitchell/dev/hr-cloud/lib/server/employees/employee-queries.ts:1)
- [lib/server/employees/compensation.ts](/Users/mmitchell/dev/hr-cloud/lib/server/employees/compensation.ts:1)
- [lib/server/document-acknowledgements/queries.ts](/Users/mmitchell/dev/hr-cloud/lib/server/document-acknowledgements/queries.ts:1)
- [lib/server/offboarding/offboarding-queries.ts](/Users/mmitchell/dev/hr-cloud/lib/server/offboarding/offboarding-queries.ts:1)

Recommended later rule:

- repositories should never infer tenant scope from arbitrary route params alone

### Services

Future requirement:

- service-layer functions that implement business rules should accept a
  context object instead of raw `actorId` plus loose `employeeId` values over
  time

Examples:

- [lib/server/documents/create-document.ts](/Users/mmitchell/dev/hr-cloud/lib/server/documents/create-document.ts:1)
- [lib/server/employees/apply-employee-update.ts](/Users/mmitchell/dev/hr-cloud/lib/server/employees/apply-employee-update.ts:1)
- [lib/pto/apply-approval-decision.ts](/Users/mmitchell/dev/hr-cloud/lib/pto/apply-approval-decision.ts:1)

### API Routes

Future requirement:

- routes should resolve tenant context once near the edge
- routes should pass that context into downstream authorization and service calls

Examples:

- [app/api/pto-requests/route.ts](/Users/mmitchell/dev/hr-cloud/app/api/pto-requests/route.ts:1)
- [app/api/employees/[id]/documents/route.ts](/Users/mmitchell/dev/hr-cloud/app/api/employees/[id]/documents/route.ts:1)
- [app/api/reports/summary/route.ts](/Users/mmitchell/dev/hr-cloud/app/api/reports/summary/route.ts:1)

### Reports

Future requirement:

- reports should resolve one tenant context and one report scope
- report queries should explicitly decide whether they are:
  - self
  - manager/direct-report
  - organization-wide admin
  - platform-level internal support

Examples:

- [lib/server/reports/employee-master.ts](/Users/mmitchell/dev/hr-cloud/lib/server/reports/employee-master.ts:1)
- [lib/server/reports/user-access.ts](/Users/mmitchell/dev/hr-cloud/lib/server/reports/user-access.ts:1)

### Internal Jobs

Future requirement:

- internal jobs must eventually run with an organization-aware execution scope,
  even if they continue to use system actors

Examples:

- [lib/server/internal-jobs/runs.ts](/Users/mmitchell/dev/hr-cloud/lib/server/internal-jobs/runs.ts:1)
- [lib/pto/accrual-job.ts](/Users/mmitchell/dev/hr-cloud/lib/pto/accrual-job.ts:1)
- [lib/pto/rollover-job.ts](/Users/mmitchell/dev/hr-cloud/lib/pto/rollover-job.ts:1)

Recommended later rule:

- scheduled jobs should carry either:
  - one `organizationId`
  - or an explicit platform-wide mode for migration/admin operations

## Proposed Future Resolver Layers

Recommended eventual layering:

1. `resolveCurrentActor()`
   - current employee-based actor resolution
2. `resolveTenantContext()`
   - build the transition-safe context object
3. `requireTenantContext()`
   - later strict version once organization linkage is mandatory
4. `assertTenantAccess()`
   - later org-aware authorization checks

Recommended first implementation behavior:

- `resolveTenantContext()`
  - never change session shape
  - never block login
  - return nullable `organizationId` and `userId`
  - attach a transparent resolution source

Current branch status:

- a first read-only `resolveTenantContext()` scaffold now exists
- it resolves from the current employee-based session
- it preserves current role and permission resolution
- it may use the known `default-org` only as a diagnostics fallback
- it is not used for authorization or data scoping yet
- a thin request-edge helper pattern now exists for low-risk admin diagnostics routes

## Proposed Migration Order By Module

### Lowest Risk First

- admin diagnostics
- read-only reports with clear actor boundaries
- employee directory query helpers
- new repository wrappers introduced alongside existing calls

Why:

- mostly read-heavy
- easiest to verify by diffing result sets
- lowest chance of changing approval or payroll-adjacent behavior

### Medium Risk

- employee profile reads
- document metadata reads
- onboarding/offboarding read paths
- notification query selection
- admin maintenance pages

Why:

- broader surface area
- mixes read and write flows
- more likely to expose hidden cross-table assumptions

### Highest Risk Last

- PTO creation, approval, ledger, and accrual paths
- compensation write flows
- document assignment and acknowledgement writes
- internal jobs
- report exports that aggregate across many employee-owned tables
- authorization-core role and permission enforcement

Why:

- these areas are write-heavy, audit-heavy, or highly sensitive
- they rely on existing manager and admin semantics
- they often chain multiple side effects together

## Recommended First Implementation Slice

The first code slice after this design phase should be a non-enforcing resolver
only.

Recommended exact scope:

1. add a small server-side `resolveTenantContext()` helper
2. source it from the current authenticated employee
3. enrich it with nullable `userId` and nullable `organizationId`
4. derive current global role and permission codes exactly as they exist today
5. add a `source` field that can indicate default-organization fallback
6. use it first in admin diagnostics or another read-only internal route only

This is the safest first slice because it:

- does not change the session
- does not change authorization decisions
- does not refactor repositories
- gives the branch a concrete context object to validate before scoping any business module

## What Should Wait Until Later

- making `organizationId` required everywhere
- moving session identity from `employeeId` to `userId`
- org-aware role and permission tables
- tenant-scoped repository enforcement
- tenant-scoped report filtering
- tenant-scoped job runners
- tenant-scoped document storage keys

## Rollout Guardrails

When implementation begins, keep these guardrails:

- resolve tenant context once per request where practical
- keep it server-only at first
- do not trust client-provided organization ids
- prefer explicit `source` and warning fields over silent fallback behavior
- do not mix tenant enforcement with auth-session refactors in the same phase
