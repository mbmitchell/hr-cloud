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
19. read-only repository wrapper pilot
20. second read-only repository wrapper pilot
21. tenant scope candidate selection and risk classification
22. employee read tenant-filter pilot design
23. employee directory tenant shadow compare
24. employee directory shadow results UI
25. employee master report shadow compare
26. employee master report shadow results UI
27. report tenant context seam design
28. employee master feature-flagged tenant filter pilot
29. employee master export seam decision
30. employee master tenant filter validation checklist
31. organization membership backfill apply validation
32. identity linkage completeness planning
33. employee master export parity diagnostics planning
34. employee master export parity diagnostics endpoint

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
- two low-risk diagnostics queries now have `TenantContext`-accepting read-only wrappers with documented parity expectations
- tenant-scoping candidates are now classified by risk so the first real organization-filter pilot can stay narrow
- the first actual tenant-filter pilot is now designed as a shadow comparison on employee read paths before any live filtering is introduced
- the employee directory now has an admin-only tenant shadow compare path while the live directory behavior remains unchanged
- the admin auth diagnostics page now surfaces employee directory shadow results so operators can verify parity before any real tenant filtering is enabled
- the employee master report now also has an admin-only shadow compare path while the live report page and exports remain unchanged
- the admin auth diagnostics page now surfaces employee master report shadow results so operators can validate report parity before any real tenant-scoped reporting is enabled
- report pages, export routes, and report services are now classified by tenant-context seam and scoping risk before any live report filtering is introduced
- the employee master report page now has a default-off tenant filter pilot flag, while flag-off behavior remains unchanged and exports remain unscoped
- the employee master export decision is now documented: exports stay intentionally global for now, but should eventually join the same rollout flag rather than a separate long-term flag
- the employee master tenant filter now has an explicit validation checklist with go/no-go gates before expanding to exports or other modules
- employee master export parity planning now defines how page count, CSV count, PDF count, and tenant-shadow count should be compared before exports join the tenant-filter rollout
- an admin-only employee master export parity endpoint now compares live page, CSV, PDF, and tenant-shadow counts without changing any live page or export behavior
- organization membership backfill apply has now been validated on the scratch Neon database: missing memberships were created, readiness improved, and both employee shadow parity diagnostics remained clean
- identity linkage completeness is now explicitly classified by environment: preview dev-auth users may legitimately lack `UserIdentity`, while production Microsoft Entra users should eventually have real provider-backed identities

## Remaining Risks

The biggest remaining risks before tenant enforcement are:

- current business modules still assume global employee visibility and global role space
- repository and service queries still mostly accept raw `employeeId` values instead of tenant-aware context
- internal jobs still run as global system jobs without organization execution scope
- reports still assume whole-system datasets except where employee visibility is manually applied
- copied-data transition assumptions still rely on a default organization fallback in diagnostics
- linked `User` and `OrganizationMembership` coverage may still have gaps or mismatches in real data
- readiness interpretation for `usersWithoutIdentities` still needs a future diagnostics refinement so preview dev-auth exceptions and production remediation are surfaced separately
- auth remains intentionally employee-centric, so a future transition to richer tenant context must avoid changing login/session behavior too early

## Next 5 Recommended Phases

1. employee master export parity diagnostics UI
   - surface the new parity endpoint in the admin diagnostics experience
   - keep export behavior unchanged while improving operator review

2. readiness diagnostics severity refinement
   - distinguish preview dev-auth-only users from real provider-backed users
   - keep behavior unchanged while improving rollout signal quality

3. read-only report scoping diagnostics adoption
   - extend the diagnostics pattern to another low-risk report seam such as reporting structure
   - keep output unchanged

4. internal job scope design
   - define how scheduled jobs will carry organization scope, system actor identity, and platform-wide admin modes before changing PTO or notification jobs

5. tenant-aware authorization design
   - plan how global employee roles and permissions will later interact with organization membership without changing current access rules yet

## Guardrails

Do not do these yet:

- do not enforce tenant isolation in business modules
- do not require `Employee.organizationId` globally
- do not require `Employee.userId` globally
- do not move session identity from `employeeId` to `userId`
- do not create fake provider identities to satisfy readiness metrics
- do not refactor repositories broadly
- do not tenant-scope PTO, documents, onboarding, offboarding, reports, jobs, or permissions in one large pass
- do not redesign role or permission semantics yet
- do not combine tenant enforcement with auth/session changes
- do not mix tenant scoping with a large schema redesign

## Recommended Immediate Next Phase

The safest next implementation phase is:

- employee master export parity diagnostics UI

Why:

- employee master page scoping now has a default-off pilot while exports remain intentionally global
- the new endpoint now exposes live page, CSV, PDF, and shadow counts, so the next safe step is to surface that data for operator review
- it still avoids changing live business behavior or authorization rules
