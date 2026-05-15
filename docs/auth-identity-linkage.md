# Auth Identity Linkage

## Purpose

This phase adds server-side linkage scaffolding between the existing
`Employee`-based authentication flow and the new platform identity models:

- `User`
- `UserIdentity`
- `Employee.userId`

The goal is to begin building long-term SaaS identity foundations without
changing current login behavior.

## What Was Implemented

Added helper:

- [lib/auth/link-authenticated-identity.ts](/Users/mmitchell/dev/hr-cloud/lib/auth/link-authenticated-identity.ts:1)

Wired into existing auth success paths:

- [auth.ts](/Users/mmitchell/dev/hr-cloud/auth.ts:1)

Current behavior of the helper:

1. normalize the authenticated email
2. find or create a `User` by normalized email
3. if the resolved `Employee` exists and `employee.userId` is null, link it to the `User`
4. if provider identity details are available, create a `UserIdentity`
5. if linkage fails or conflicts, log and continue without blocking login

## Current Provider Behavior

### Credentials dev auth

- still authenticates exactly as before
- still requires an existing active `Employee`
- now performs best-effort `User` creation and `Employee.userId` linkage
- does not create a `UserIdentity` row because there is no stable external provider account id in this temporary flow

### Microsoft Entra auth

- still authenticates exactly as before
- still requires tenant validation, stable `oid`, and an existing internal `Employee`
- still binds `entraOid` and `entraTid` on `Employee` as before
- now also performs best-effort `User` creation, `Employee.userId` linkage, and `UserIdentity` creation

For this scaffolding phase, `UserIdentity.providerAccountId` is populated from
the resolved Entra `oid`.

## What Did Not Change

- login flow
- sign-in allow/deny behavior
- session payload shape
- `employeeId` as the authenticated app identity
- role/permission behavior
- tenant enforcement
- PTO, document, onboarding, offboarding, report, notification, and job scoping

## Best-Effort Design

Identity linkage is intentionally non-blocking.

If the helper encounters:

- a database error
- an existing conflicting `Employee.userId`
- an existing conflicting `UserIdentity`

then login still succeeds if the original auth path succeeded.

This keeps the phase low risk while still building platform identity records
incrementally during normal sign-in activity.

## Audit And Logging

The helper writes audit rows when it:

- applies linkage
- detects a linkage conflict
- hits a linkage failure

Current audit actions:

- `AUTH_IDENTITY_LINKAGE_APPLIED`
- `AUTH_IDENTITY_LINKAGE_CONFLICT`
- `AUTH_IDENTITY_LINKAGE_FAILED`

The helper also writes structured server logs for the same events.

## Current Limitations

- no session exposure of `userId`
- no auth-time tenant selection
- no membership creation yet
- no `OrganizationMembership` linking yet
- no backfill of historical users outside sign-in activity
- no UI for viewing or managing linked platform identities

## Recommended Next Auth Phase

The next low-risk auth phase should:

1. add a read-only helper for resolving the linked `User` record from the authenticated `Employee`
2. optionally backfill missing `User` and `UserIdentity` links for existing employees in a controlled admin/job path
3. keep session behavior unchanged while measuring linkage coverage

Only after that should the app consider any session-level or tenant-selection
changes.
