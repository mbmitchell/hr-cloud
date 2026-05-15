# Organization Membership Backfill

## Purpose

This phase adds safe tooling to populate `OrganizationMembership` for linked
users based on existing `Employee.organizationId` and `Employee.userId`
relationships.

The goal is to prepare platform identity data without introducing tenant
enforcement yet.

## What Was Added

Server-side helper:

- [lib/server/auth/organization-membership-backfill.ts](/Users/mmitchell/dev/hr-cloud/lib/server/auth/organization-membership-backfill.ts:1)

Admin-only route:

- [app/api/admin/auth/organization-memberships/route.ts](/Users/mmitchell/dev/hr-cloud/app/api/admin/auth/organization-memberships/route.ts:1)

## Default Membership Shape

The backfill uses conservative defaults:

- `role: "MEMBER"`
- `status: "ACTIVE"`

These are generic platform identity values and do not change application RBAC
or permissions behavior.

## Preview Behavior

`GET /api/admin/auth/organization-memberships`

Returns a preview including:

- linked employees with both `userId` and `organizationId`
- existing memberships
- missing memberships
- skipped or conflicting records
- counts by action

Preview actions:

- `CREATE_MEMBERSHIP`
- `EXISTING_MEMBERSHIP`
- `SKIP_MISSING_USER`
- `SKIP_MISSING_ORGANIZATION`
- `SKIP_USER_NOT_FOUND`
- `SKIP_ORGANIZATION_NOT_FOUND`

## Apply Behavior

`POST /api/admin/auth/organization-memberships`

Default behavior:

- preview only

Apply mode:

- requires `{ "apply": true }`

Apply only creates memberships when:

- `Employee.userId` is present
- `Employee.organizationId` is present
- the linked `User` exists
- the linked `Organization` exists
- there is no existing `OrganizationMembership` for that same organization/user pair

## Idempotency

The apply path is idempotent.

Re-running the backfill will:

- leave existing memberships unchanged
- create only still-missing memberships
- continue skipping invalid or incomplete records

## Preview / Apply Validation

Validated against the scratch / preview Neon database on `2026-05-15`.

Observed preview state before apply:

- `totalEmployees: 9`
- `linkedEmployeesWithUserAndOrganization: 2`
- `existingMemberships: 0`
- `missingMemberships: 2`
- `skippedRecords: 7`

Observed apply result:

- `appliedRows: 2`
- `createdMemberships: 2`
- `existingMemberships: 0`
- `skippedRows: 7`

Created memberships:

- `mmitchell@mfncuso.com`
- `test.siteadmin@mfncuso.com`

Skipped rows were all `SKIP_MISSING_USER` cases and did not indicate
membership conflicts:

- `postgres.rehearsal.sample@mfncuso.com`
- `test.accounting@mfncuso.com`
- `test.auditor@mfncuso.com`
- `test.employee@mfncuso.com`
- `test.executive@mfncuso.com`
- `test.hradmin@mfncuso.com`
- `test.manager@mfncuso.com`

Post-apply verification:

- `linkedUsersMissingOrganizationMembership` dropped to `0`
- `usersWithoutIdentities` remained `2`
- no duplicate `OrganizationMembership` rows were found for the same
  `organizationId + userId`
- employee directory shadow parity remained intact
- employee master report shadow parity remained intact
- `test.siteadmin@mfncuso.com` still resolves as an active employee for the
  current login flow

## Authorization

The route uses existing admin-only authorization:

- `SITE_ADMIN`
- `HR_ADMIN`

## What Did Not Change

- login behavior
- session shape
- permissions behavior
- tenant enforcement
- PTO, documents, reports, onboarding, offboarding, jobs, or permission logic

## Recommended Next Phase

The next low-risk phase should be identity linkage completion planning:

1. focus on the remaining `usersWithoutIdentities` readiness warning
2. decide whether preview environments should rely on dev-auth-only users or
   whether Microsoft Entra-linked preview identities are needed
3. keep tenant enforcement disabled while identity completeness is still being
   validated
