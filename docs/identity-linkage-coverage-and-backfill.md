# Identity Linkage Coverage And Backfill

## Purpose

This phase adds safe server-side visibility and controlled backfill support for:

- `User`
- `UserIdentity`
- `Employee.userId`

The goal is to measure and improve linkage coverage without changing:

- login behavior
- session shape
- role or permission behavior
- tenant enforcement

## What Was Added

Server-side helper:

- [lib/server/auth/identity-linkage.ts](/Users/mmitchell/dev/hr-cloud/lib/server/auth/identity-linkage.ts:1)

Admin-only API route:

- [app/api/admin/auth/identity-linkage/route.ts](/Users/mmitchell/dev/hr-cloud/app/api/admin/auth/identity-linkage/route.ts:1)

## Coverage Summary

The coverage helper reports:

- total employees
- employees with `userId`
- employees without `userId`
- total users
- users without employees
- total user identities
- identities without linked users
- duplicate or ambiguous normalized email risks
- employee/user email mismatch risks
- users linked to multiple employees

Because `UserIdentity.userId` is required and foreign-keyed, dangling
identities are not expected through normal Prisma writes. The summary therefore
reports `identitiesWithoutLinkedUsers = 0` and explains why.

## Backfill Behavior

The backfill helper is intentionally limited and idempotent.

It can:

- create `User` records for employees missing `userId`
- link `Employee.userId` by normalized email

It does not:

- change login behavior
- create `UserIdentity` rows without known provider identity
- change session data
- create memberships
- enforce organizations or tenants

### Preview actions

Preview rows classify each unlinked employee as one of:

- `CREATE_USER_AND_LINK`
- `LINK_EXISTING_USER`
- `SKIP_INVALID_EMAIL`
- `SKIP_AMBIGUOUS_USER_EMAIL`
- `SKIP_USER_LINKED_ELSEWHERE`

### Apply rules

Apply mode:

- only mutates rows that were safe candidates
- re-checks current database state inside a transaction
- skips already-linked employees
- skips ambiguous email matches
- skips users already linked to another employee
- can be re-run safely

## Route Behavior

### GET `/api/admin/auth/identity-linkage`

Returns:

- coverage summary
- preview of backfill candidates

Authorization:

- existing admin role guard only
- `SITE_ADMIN` or `HR_ADMIN`

### POST `/api/admin/auth/identity-linkage`

Default behavior:

- preview mode only

Apply mode:

- requires request body `{ "apply": true }`

This explicit flag reduces accidental mutations while still allowing controlled
admin-driven backfill execution.

## Audit And Logging

Backfill preview/apply writes audit entries using:

- `AUTH_IDENTITY_LINKAGE_BACKFILL_PREVIEW`
- `AUTH_IDENTITY_LINKAGE_BACKFILL_APPLY`

Skipped and conflict rows are also written to server logs with structured
warning entries so operators can review ambiguous cases before any follow-up
cleanup.

## Current Limitations

- no UI yet
- no session exposure of linked `User`
- no `OrganizationMembership` creation
- no `UserIdentity` backfill without provider truth
- no tenant enforcement
- no automatic cleanup for ambiguous legacy email states

## Recommended Next Phase

The next low-risk phase should focus on read-only linked identity consumption:

1. add a helper that resolves the linked `User` and `UserIdentity` from the authenticated `Employee`
2. expose read-only admin diagnostics for linked identity status on employee records
3. keep session and login behavior unchanged while validating linkage coverage in real environments
