# Provider-Backed Identity Validation Runbook

## Purpose

This runbook defines how to validate real Microsoft Entra sign-in and
provider-backed `UserIdentity` creation before production rollout.

It is planning-only.

It does not change:

- runtime code
- Prisma schema
- auth behavior
- feature flags
- tenant enforcement scope

## Preconditions

Before running this validation:

- Preview deployment is healthy
- `AUTH_ENABLE_DEV_AUTH=true` may remain enabled as a rollback path
- at least one test `Employee` row exists for the Entra test user
- that employee is `ACTIVE`
- the employee has the correct `organizationId`
- the employee has either:
  - an existing `userId`, or
  - no `userId` so linkage can be created on first Entra sign-in
- if organization membership validation is in scope, the employee should also
  have a matching `OrganizationMembership` or be known to be missing one for
  negative-path testing

## Required Microsoft Entra App Registration Settings

The Entra application used for Preview validation should be configured as a
confidential web application.

Required settings:

- Application (client) ID GUID
- client secret
- tenant-specific issuer
- web redirect URI for the Preview deployment

Important requirements from the current auth implementation:

- the Auth.js provider expects the Application (client) ID GUID
- do not use the `api://...` Application ID URI as the client ID
- the issuer must be tenant-specific, not `common`

Recommended Entra registration settings:

- platform type: `Web`
- account type: single tenant for the intended production tenant directory
- scopes used by this app:
  - `openid`
  - `profile`
  - `email`

## Required Callback URL

The registered redirect URI must be:

- `<NEXTAUTH_URL>/api/auth/callback/microsoft-entra-id`

Example Preview callback:

- `https://<preview-domain>/api/auth/callback/microsoft-entra-id`

## Required Vercel Environment Variables

Required for provider-backed validation:

- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `AUTH_MICROSOFT_ENTRA_ID_ID`
- `AUTH_MICROSOFT_ENTRA_ID_SECRET`
- `AUTH_MICROSOFT_ENTRA_ID_ISSUER`

May remain enabled during Preview rollback-safe validation:

- `AUTH_ENABLE_DEV_AUTH=true`
- `AUTH_DEV_PASSWORD`
- optional `AUTH_DEV_AUTH_EMAIL_ALLOWLIST`

Expected Preview stance during this runbook:

- Microsoft Entra sign-in is enabled
- dev auth remains available only as fallback while the provider-backed flow is
  being validated

## Expected Sign-In Flow

The current production-intended flow in [auth.ts](/Users/mmitchell/dev/hr-cloud/auth.ts:1) is:

1. user signs in through Microsoft Entra
2. Auth.js returns Entra claims including:
   - `oid`
   - `tid`
   - email candidates
3. the app validates:
   - issuer is tenant-specific
   - `tid` exists
   - `tid` matches the configured issuer tenant
   - `oid` exists
4. employee resolution happens in this order:
   - resolve by existing `Employee.entraOid + Employee.entraTid`
   - otherwise bootstrap by MFN company email fallback
5. if resolved by email fallback, the employee is bound to:
   - `entraOid`
   - `entraTid`
6. the employee must already exist and be `ACTIVE`
7. after sign-in succeeds, best-effort identity linkage runs:
   - find or create `User`
   - link `Employee.userId`
   - create `UserIdentity` when provider info is available
8. session remains employee-centric

## Expected User Creation Behavior

On first successful Entra sign-in for an employee:

- if no `User` exists for the normalized employee email:
  - create a `User`
- if a `User` already exists for that email:
  - reuse it

Expected result:

- exactly one `User` per normalized employee email
- no duplicate `User` creation on repeat sign-in

## Expected UserIdentity Creation Behavior

On successful Entra sign-in:

- `provider` should be `microsoft-entra-id`
- `providerAccountId` should be the Entra `oid`

Expected behavior:

- first successful Entra sign-in creates one `UserIdentity` if none exists
- repeat sign-in reuses the existing `UserIdentity`
- no duplicate `UserIdentity` rows should be created for the same
  `provider + providerAccountId`
- if that Entra identity is already linked to a different `User`, the linkage
  helper should log a conflict and sign-in diagnostics must be reviewed

## Expected Employee.userId Linking Behavior

On first successful Entra sign-in:

- if `Employee.userId` is null and the matching `User` exists or is created:
  - link `Employee.userId`
- if `Employee.userId` is already linked to the same `User`:
  - no change
- if `Employee.userId` points to a different `User`:
  - treat as a conflict and investigate before rollout

This linkage is best-effort and should not change session behavior.

## Expected OrganizationMembership State

This runbook does not create memberships automatically.

Expected state for a production-ready provider-backed user:

- employee has `organizationId`
- employee has `userId`
- the linked `User` has an `OrganizationMembership` in the employee's
  organization

Allowed temporary Preview state:

- sign-in may still succeed even if membership is missing
- readiness diagnostics should show the missing membership clearly

## How To Verify `/admin/auth` After Sign-In

After a successful provider-backed sign-in:

1. open `/admin/auth`
2. verify readiness summary
3. verify tenant context
4. verify linked identity diagnostics for the signed-in employee
5. verify organization membership readiness

Expected diagnostics for a successful provider-backed test user:

- `TenantContext.organizationId` is not null
- `TenantContext.userId` is not null
- `TenantContext.employeeId` matches the employee session
- linked identity diagnostics show:
  - employee email
  - linked `User`
  - `UserIdentity.provider = microsoft-entra-id`
  - `UserIdentity.providerAccountId` present
- readiness should not count the user under preview-expected
  `usersWithoutIdentities`

## How To Distinguish Dev-Auth Users From Provider-Backed Users

Dev-auth-only Preview users:

- can authenticate through credentials when `AUTH_ENABLE_DEV_AUTH=true`
- may have `User` and `Employee.userId`
- may have `OrganizationMembership`
- typically do not have `UserIdentity`

Provider-backed users:

- authenticate through Microsoft Entra
- should have `UserIdentity.provider = microsoft-entra-id`
- should have `UserIdentity.providerAccountId = <entra oid>`
- should not rely on dev-auth-only warning classification once production
  readiness is being evaluated

## Validation Checklist

### First Entra Sign-In

- sign in with a real Entra test user whose email matches an `ACTIVE`
  `Employee`
- verify sign-in succeeds
- verify `Employee.entraOid` and `Employee.entraTid` are set if they were
  previously empty
- verify a `User` exists for the employee email
- verify `Employee.userId` is linked
- verify one `UserIdentity` row exists for:
  - `provider = microsoft-entra-id`
  - `providerAccountId = <entra oid>`
- verify `/admin/auth` shows provider-backed identity readiness

Pass criteria:

- all rows created or linked as expected
- no duplicate rows
- no blocking readiness surprises beyond known non-auth rollout gaps

### Repeat Entra Sign-In

- sign out
- sign in again with the same Entra user
- verify sign-in still succeeds
- verify no second `User` is created
- verify no second `UserIdentity` is created
- verify `Employee.userId` remains stable

Pass criteria:

- idempotent result
- no duplicate identities

### Mismatched Email

- attempt Entra sign-in with a company email that does not match the expected
  employee record

Expected result:

- sign-in denied
- audit/security event recorded
- no new `Employee`
- no new `UserIdentity`

### Missing Employee Row

- attempt Entra sign-in with a real test user whose email has no matching
  `Employee`

Expected result:

- sign-in denied
- no employee auto-creation
- no production rollout approval

### Inactive Employee Row

- attempt Entra sign-in with a real test user whose matching employee is not
  `ACTIVE`

Expected result:

- sign-in denied
- employee remains inactive
- no `UserIdentity` should be trusted as rollout-ready for access

### Missing Membership

- sign in with a valid provider-backed employee whose `User` exists but whose
  membership is intentionally absent

Expected result:

- sign-in may still succeed because membership is not yet an auth gate
- `/admin/auth` should clearly surface the missing membership
- this remains a rollout-readiness issue even though auth succeeds

### Duplicate Identity Attempt

- attempt sign-in or data setup that would associate the same Entra `oid` with
  a different `User`

Expected result:

- linkage conflict is logged
- no duplicate `UserIdentity` is created
- rollout is blocked until manually reviewed

## Failure Scenarios And Troubleshooting

### Invalid issuer

Symptoms:

- sign-in fails immediately
- startup warnings may indicate bad Entra configuration

Checks:

- issuer is tenant-specific
- issuer is not `common`
- issuer matches the intended tenant

### Missing or mismatched tenant ID

Symptoms:

- sign-in denied with tenant mismatch behavior

Checks:

- Entra user belongs to the same tenant as the configured issuer
- `AUTH_MICROSOFT_ENTRA_ID_ISSUER` is correct

### Missing OID

Symptoms:

- provider-backed identity cannot anchor to a stable Entra object

Checks:

- validate the app registration and returned claims
- verify the selected account is a normal Entra user in the target tenant

### No employee match

Symptoms:

- sign-in denied

Checks:

- normalized email exactly matches an existing `Employee.email`
- email uses `@mfncuso.com`
- employee row exists in the Preview database

### Inactive employee

Symptoms:

- sign-in denied even though email exists

Checks:

- employee status is `ACTIVE`

### UserIdentity not created

Symptoms:

- sign-in succeeds but `/admin/auth` still shows the user as lacking provider
  identity

Checks:

- confirm sign-in used Microsoft Entra, not dev auth
- confirm provider was `microsoft-entra-id`
- review auth logs for linkage conflict or audit-log write failure
- check whether a duplicate `provider + providerAccountId` already exists on a
  different user

### Membership missing after successful sign-in

Symptoms:

- sign-in succeeds
- readiness still warns about missing membership

Checks:

- compare `Employee.organizationId`
- compare linked `OrganizationMembership`
- run the membership preview/apply workflow if appropriate for Preview

## Rollback Path Back To Dev-Auth Preview Testing

If provider-backed validation is incomplete or unstable:

1. keep `AUTH_ENABLE_DEV_AUTH=true` in Preview
2. return testers to `/login` and use dev credentials
3. do not disable Microsoft Entra config unless it is actively causing Preview
   instability
4. keep provider-backed readiness marked incomplete
5. continue using `/admin/auth` diagnostics to separate:
   - dev-auth-only preview users
   - provider-backed validated users

Rollback does not require:

- deleting `User`
- deleting `UserIdentity`
- deleting `OrganizationMembership`

## Go / No-Go Criteria

### Before Disabling Dev Auth

Go only if:

- at least one real provider-backed admin validates successfully end-to-end
- first and repeat Entra sign-in both behave correctly
- `/admin/auth` shows provider-backed identity linkage as expected
- no unexplained duplicate identity or linkage conflicts remain

No-go if:

- Entra sign-in is still relying on manual cleanup
- provider-backed `UserIdentity` creation is inconsistent
- Preview operators still depend on dev auth for normal admin validation

### Before Treating `usersWithoutIdentities` As Blocking

Go only if:

- provider-backed validation has succeeded for the target environment
- dev auth is disabled or no longer the primary validation path
- the remaining providerless users are understood and intentionally excluded

No-go if:

- Preview is still primarily dev-auth-driven
- known valid test users have not yet completed real Entra sign-in

### Before Expanding Tenant Enforcement

Go only if:

- provider-backed admin validation is complete
- readiness diagnostics distinguish preview-only warnings from real production
  blockers correctly
- organization membership readiness remains stable for provider-backed users
- employee master pilot remains stable after provider-backed validation

No-go if:

- provider-backed identity creation is still unproven
- sign-in failures or identity conflicts are unresolved
- readiness remains green only because dev-auth warnings are being ignored

## Recommended Outcome Of This Runbook

The intended result of this runbook is not code change.

It is a documented operational decision that one of these statements is now
true:

- provider-backed identity creation is validated and Preview can begin
  production-like auth testing
- provider-backed identity creation is not yet validated and tenant rollout
  must remain limited to dev-auth Preview rehearsal
