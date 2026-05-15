# HR Cloud Roadmap Current State

## Purpose

This document reconciles the current `postgres-rehearsal` branch after the
completed PostgreSQL and platform-identity groundwork phases.

It is a checkpoint document only.

It does not introduce new behavior.

## Completed Phases

Completed so far on this branch:

1. environment and deployment separation planning
2. SaaS backend architecture planning
3. PostgreSQL compatibility review
4. PostgreSQL rehearsal provider switch and baseline lineage planning
5. Next.js build safety updates for Prisma generation and workspace-root tracing
6. platform identity foundation
7. auth identity linkage scaffolding
8. identity linkage coverage and backfill scaffolding
9. read-only linked identity diagnostics
10. admin identity diagnostics UI
11. operator identity remediation playbook
12. organization membership backfill scaffolding
13. read-only organization visibility diagnostics
14. unified identity and organization readiness diagnostics
15. tenant context design
16. tenant context resolver scaffolding
17. request-edge tenant context helper pattern
18. limited tenant-context diagnostics adoption

## Current Architecture State

Current branch state:

- Prisma is configured for PostgreSQL rehearsal on this branch
- legacy MySQL migration history is preserved for reference
- separate PostgreSQL migration lineage artifacts exist for the rehearsal path
- `Organization`, `User`, `OrganizationMembership`, and `UserIdentity` now exist in the schema
- `Employee.organizationId` and `Employee.userId` exist and remain nullable
- login still resolves to an existing `Employee`
- session shape still remains employee-centric
- role and permission resolution still comes from existing global employee role assignments
- business modules still operate without tenant enforcement
- admin-only diagnostics now expose:
  - identity linkage state
  - organization membership readiness
  - unified readiness summary
  - current resolved tenant context
- low-risk admin diagnostics routes can now resolve `TenantContext` once at the route edge after existing authorization succeeds
- the route-edge helper is now reused across multiple preview-only admin diagnostics routes

## Remaining Risks

The biggest remaining risks before tenant enforcement are:

- current business modules still assume global employee visibility and global role space
- repository and service queries still mostly accept raw `employeeId` values instead of tenant-aware context
- internal jobs still run as global system jobs without organization execution scope
- reports still assume whole-system datasets except where employee visibility is manually applied
- copied-data transition assumptions still rely on a default organization fallback in diagnostics
- linked `User` and `OrganizationMembership` coverage may still have gaps or mismatches in real data
- auth remains intentionally employee-centric, so a future transition to richer tenant context must avoid changing login/session behavior too early

## Next 5 Recommended Phases

1. read-only repository wrapper pilot
   - introduce one low-risk read-only wrapper around employee-directory or report queries that accepts `TenantContext`
   - keep returned data unchanged for now

2. read-only report scoping design and pilot
   - choose one low-risk report and make tenant-context inputs explicit without changing visible output yet
   - validate where later organization filters will belong

3. internal job scope design
   - define how scheduled jobs will carry organization scope, system actor identity, and platform-wide admin modes before changing PTO or notification jobs

4. tenant-aware authorization design
   - plan how global employee roles and permissions will later interact with organization membership without changing current access rules yet

5. tenant-context report/export diagnostics adoption
   - use the same pattern in one low-risk report or export route before any query scoping begins

## Guardrails

Do not do these yet:

- do not enforce tenant isolation in business modules
- do not require `Employee.organizationId` globally
- do not require `Employee.userId` globally
- do not move session identity from `employeeId` to `userId`
- do not refactor repositories broadly
- do not tenant-scope PTO, documents, onboarding, offboarding, reports, jobs, or permissions in one large pass
- do not redesign role or permission semantics yet
- do not combine tenant enforcement with auth/session changes
- do not mix tenant scoping with a large schema redesign

## Recommended Immediate Next Phase

The safest next implementation phase is:

- read-only repository wrapper pilot for one low-risk employee-directory or diagnostics query

Why:

- it builds on the now-validated route-edge helper pattern
- it starts shaping a stable server-side calling convention below the route layer
- it still keeps business-module behavior and query filters unchanged
