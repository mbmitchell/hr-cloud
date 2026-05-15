# Identity Linkage Completeness Plan

## Purpose

This document defines how `UserIdentity` completeness should be interpreted on
the `postgres-rehearsal` branch before broader tenant-scoping rollout begins.

It is a planning document only.

It does not change authentication, session behavior, readiness code, or tenant
enforcement.

## Current State

Current preview validation shows:

- `linkedUsersMissingOrganizationMembership = 0`
- employee directory shadow parity remains intact
- employee master report shadow parity remains intact
- remaining readiness issue is `usersWithoutIdentities = 2`

Those remaining users are currently preview/test users that authenticate
through the temporary dev credentials flow, not through Microsoft Entra.

## Why Dev-Auth Users May Legitimately Lack UserIdentity

The current preview break-glass login path is intentionally different from real
Microsoft Entra sign-in:

- it authenticates by shared dev password plus an existing `Employee` record
- it preserves the existing employee-first login model
- it is meant for controlled preview/testing validation only
- it does not prove ownership of a real external identity provider account

Because of that, a preview user can legitimately have:

- an `Employee`
- a linked `User`
- an `OrganizationMembership`
- no `UserIdentity`

That is not automatically a defect in preview. It reflects the fact that the
user has only exercised the dev-auth path and has not completed a real
provider-backed Microsoft Entra login.

The platform should not create fake provider identities just to make readiness
metrics appear green.

## Why Real Microsoft Entra Users Should Eventually Have UserIdentity

For real provider-backed users, a `UserIdentity` row is important because it:

- records which external provider authenticated the user
- captures the stable provider account identifier used for future matching
- supports identity continuity across repeated sign-ins
- reduces ambiguity when multiple internal records may share similar data
- provides a safer foundation for future organization-aware auth decisions

For production Microsoft Entra users, the target steady state should be:

- existing `Employee` record
- linked `User`
- linked `OrganizationMembership`
- at least one provider-backed `UserIdentity`

In other words, missing `UserIdentity` is expected for preview-only dev-auth
users, but it should be treated as a remediation target for real Entra-backed
production users.

## Recommended Readiness Classification

Readiness diagnostics should distinguish among three states.

### 1. Dev-Auth-Only Preview Users

Definition:

- linked `User`
- no `UserIdentity`
- environment is preview/test
- user is known to be using the dev credentials path only

Recommended treatment:

- warning-only
- not rollout-blocking for preview parity validation
- explicitly labeled as preview/dev-auth-only identity incompleteness

Recommended diagnostic wording:

- `USER_WITHOUT_IDENTITY (DEV_AUTH_PREVIEW_EXPECTED)`

### 2. Real Provider-Backed Users

Definition:

- user is expected to authenticate through Microsoft Entra
- provider-backed login should already be available or required in that
  environment

Recommended treatment:

- remediation required
- should block production readiness for tenant-scoped rollout if the account is
  expected to be actively used

Recommended diagnostic wording:

- `USER_WITHOUT_IDENTITY (PROVIDER_LINK_REQUIRED)`

### 3. Missing Identity That Should Be Remediated

Definition:

- environment is production-like
- Microsoft Entra auth is the intended steady-state path
- linked `User` exists without any provider-backed `UserIdentity`
- no approved preview/dev-auth exception applies

Recommended treatment:

- blocking for production readiness
- remediation should be a real Microsoft Entra sign-in, not synthetic data

## Severity Recommendation for usersWithoutIdentities

Recommended severity should be environment-dependent.

### Preview / Testing

- `usersWithoutIdentities` should be warning-only
- it should not block preview validation when the affected users are known
  dev-auth test users
- readiness summaries should clearly separate:
  - preview-expected dev-auth incompleteness
  - unexpected missing provider identity

### Production

- `usersWithoutIdentities` should be blocking for accounts expected to use
  Microsoft Entra
- production readiness should require real provider-backed linkage for active
  users who will participate in tenant-scoped behavior

### Transitional Shared Rule

During rollout, severity should be based on both environment and account type:

- preview dev-auth-only user: warning
- real Entra user in preview performing SSO validation: should resolve after
  first real sign-in
- production active user without provider identity: blocking

## Preview / Testing Expectations

For preview and rehearsal environments:

- dev auth may remain temporarily enabled for controlled testing
- preview test users may exist only to validate employee matching, readiness
  diagnostics, shadow parity, and admin flows
- those users may legitimately lack `UserIdentity`
- readiness should remain green enough for tenant-shadow and read-only rollout
  work if all other linkage requirements are satisfied

Preview should still verify at least one real Microsoft Entra path before
production rollout, but the environment does not need every test user to have a
real provider identity.

## Production Expectations

For production or production-like rollout gates:

- Microsoft Entra should be the primary login path
- dev auth should be disabled
- active users expected to access the system should eventually create
  provider-backed `UserIdentity` rows via real sign-in
- readiness checks should treat providerless linked users as actionable
  remediation items

Production rollout should not rely on synthetic identities or manual fake
identity inserts.

## Recommended Remediation Path

Recommended remediation should stay conservative:

1. do not create fake `UserIdentity` rows
2. do not backfill provider identities without real provider identifiers
3. allow real Microsoft Entra sign-in to create `UserIdentity` naturally
4. treat remaining providerless active users in production as rollout blockers
5. treat preview-only dev-auth users as explicitly exempted warnings

## Recommended Readiness Evolution

Before broader tenant-scoping rollout:

- keep current readiness logic conceptually intact
- refine readiness interpretation so `usersWithoutIdentities` is not treated as
  equally severe in every environment
- document preview exceptions clearly
- require at least one successful real Entra-linked readiness validation before
  calling production tenant rollout ready

Current implementation on `postgres-rehearsal` now follows that direction:

- with `AUTH_ENABLE_DEV_AUTH=true`, `usersWithoutIdentities` is classified as a
  warning-only preview/dev-auth signal
- with dev auth disabled, `usersWithoutIdentities` is classified as a blocking
  provider-linkage gap

This refinement is intentionally environment-aware rather than per-user-aware,
because the current schema and diagnostics layer do not yet track durable
identity provenance for users who have never completed a real provider-backed
sign-in.

## Recommended Next Phase

The safest next phase is:

- employee master export parity diagnostics planning

That keeps rollout work focused on read-only validation while identity
completeness expectations are clarified, without changing auth or tenant
behavior.
