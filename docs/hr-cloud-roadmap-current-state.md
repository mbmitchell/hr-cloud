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

1. employee master read-only tenant-context seam pilot
   - make `TenantContext` an explicit non-enforcing input to the employee master report service and export seam
   - keep live page and exports unchanged while validating parity expectations

2. read-only report scoping diagnostics adoption
   - extend the diagnostics pattern to another low-risk report seam such as reporting structure
   - keep output unchanged

3. internal job scope design
   - define how scheduled jobs will carry organization scope, system actor identity, and platform-wide admin modes before changing PTO or notification jobs

4. tenant-aware authorization design
   - plan how global employee roles and permissions will later interact with organization membership without changing current access rules yet

5. employee detail shadow tenant-filter pilot design
   - map the employee detail read path before any organization-aware filtering work
   - keep employee detail behavior unchanged

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

- read-only report scoping design and pilot

Why:

- both employee-centered shadow compare diagnostics are now in place
- the next safe step is to make tenant context explicit in one low-risk report seam without changing report output
- it still avoids changing live business behavior or authorization rules
