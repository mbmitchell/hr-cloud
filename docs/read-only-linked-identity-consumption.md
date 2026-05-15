# Read-Only Linked Identity Consumption

## Purpose

This phase adds a safe read-only way to inspect linked platform identity data
for an existing `Employee` record.

It does not change:

- login behavior
- session shape
- permissions behavior
- tenant enforcement

## What Was Added

Server-side helper:

- [lib/server/auth/identity-linkage.ts](/Users/mmitchell/dev/hr-cloud/lib/server/auth/identity-linkage.ts:1)
  - `getEmployeeLinkedIdentityDetails(employeeId)`

Admin-only diagnostics route:

- [app/api/admin/auth/identity-linkage/[employeeId]/route.ts](/Users/mmitchell/dev/hr-cloud/app/api/admin/auth/identity-linkage/[employeeId]/route.ts:1)

## Helper Output

For a single employee, the helper returns:

- employee id
- employee email
- normalized email
- linked `userId`
- linked `User` id/email/isActive if present
- `UserIdentity` provider and providerAccountId values if present
- organization membership count for the linked user
- read-only mismatch and conflict flags

## Flags

Current flags:

- `EMPLOYEE_NOT_LINKED`
- `EMPLOYEE_EMAIL_DUPLICATE`
- `USER_EMAIL_DUPLICATE`
- `EMPLOYEE_USER_EMAIL_MISMATCH`
- `USER_LINKED_TO_MULTIPLE_EMPLOYEES`
- `USER_WITHOUT_IDENTITY`

These flags are diagnostics only. They do not block login and do not mutate
data.

## Route Behavior

### GET `/api/admin/auth/identity-linkage/:employeeId`

Returns read-only linked identity details for the specified employee.

Authorization:

- existing admin role guard
- `SITE_ADMIN` or `HR_ADMIN`

Headers:

- private no-store response headers

## Security Notes

The route intentionally does not expose:

- access tokens
- refresh tokens
- OAuth secrets
- provider profile payloads

Only safe linkage metadata is returned:

- provider name
- provider account id
- linked entity ids
- linkage status flags

## What Did Not Change

- login allow/deny logic
- Auth.js callbacks behavior
- session payloads
- `employeeId` as the active app identity
- tenant behavior
- PTO, documents, reports, onboarding, offboarding, job, or permission logic

## Recommended Next Phase

The next low-risk phase should be admin diagnostics consumption:

1. optionally surface read-only linked identity status inside admin employee views
2. add operator-facing guidance for resolving flagged mismatch/conflict states
3. continue keeping login and session behavior unchanged
