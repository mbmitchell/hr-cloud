# Unified Identity And Organization Readiness

## Purpose

This phase adds one read-only readiness workflow for the current platform
identity chain:

- `Employee`
- `User`
- `UserIdentity`
- `OrganizationMembership`

The goal is to give admins and operators a single place to review whether the
copied MFN HR data is ready for later tenant-enforcement phases.

This phase does not change:

- login behavior
- session shape
- permissions behavior
- tenant enforcement
- PTO, documents, onboarding, offboarding, jobs, reports, or API scoping

## What Was Added

Admin-only summary route:

- [app/api/admin/auth/readiness/route.ts](/Users/mmitchell/dev/hr-cloud/app/api/admin/auth/readiness/route.ts:1)

Admin diagnostics page update:

- [app/admin/auth/page.tsx](/Users/mmitchell/dev/hr-cloud/app/admin/auth/page.tsx:1)

Shared readiness summary helper:

- [lib/server/auth/identity-linkage.ts](/Users/mmitchell/dev/hr-cloud/lib/server/auth/identity-linkage.ts:1)

## Summary Returned

The unified readiness summary includes:

- total employees
- employees missing user linkage
- employees missing organization
- linked users missing organization membership
- linked users without identities
- users without identities
- duplicate or ambiguous email risks
- inactive memberships
- users with membership in a different organization
- blocking issue count
- warning issue count
- overall readiness status

## Overall Status

The current summary uses three read-only status levels:

- `READY`
  - no blocking issues
  - no warning issues
- `NEEDS_REVIEW`
  - no blocking issues
  - one or more warning issues
- `NOT_READY`
  - one or more blocking issues

Blocking issues currently include:

- employees missing user linkage
- employees missing organization
- linked users missing membership in the employee organization
- duplicate or ambiguous email risks

Warning issues currently include:

- users without identities
- inactive memberships
- users with membership in a different organization

## Operator Workflow

Use the unified readiness view as the top-level checkpoint, then follow the
existing lower-level tools in this order:

1. Review identity linkage coverage in
   [docs/identity-linkage-coverage-and-backfill.md](/Users/mmitchell/dev/hr-cloud/docs/identity-linkage-coverage-and-backfill.md:1)
   and preview
   `GET /api/admin/auth/identity-linkage`
2. Review organization membership readiness in
   [docs/organization-membership-backfill.md](/Users/mmitchell/dev/hr-cloud/docs/organization-membership-backfill.md:1)
   and preview
   `GET /api/admin/auth/organization-memberships`
3. Resolve flagged edge cases using
   [docs/operator-identity-remediation-playbook.md](/Users/mmitchell/dev/hr-cloud/docs/operator-identity-remediation-playbook.md:1)

## What This Still Does Not Do

- no apply buttons in the UI
- no tenant enforcement
- no automatic correction of linkage or membership state
- no auth/session changes
- no role or permission behavior changes

## Recommended Next Phase

The next low-risk phase should keep the workflow read-only while making it
easier for operators to act on the diagnostics:

1. add drill-down or filtered readiness views for blocking categories
2. connect the unified summary to per-employee diagnostics more directly
3. keep any apply behavior confined to the existing preview-first admin routes
