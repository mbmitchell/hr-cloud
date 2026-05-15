# Readiness Diagnostics Severity Refinement

## Purpose

This phase refines readiness diagnostics severity so known preview/dev-auth-only
users do not appear as production-blocking identity failures, while real
provider-backed identity gaps remain visible.

It is a diagnostics-only change.

It does not change:

- login behavior
- session behavior
- permissions behavior
- tenant enforcement
- report or export behavior

## Problem

Before this refinement, `usersWithoutIdentities` was counted uniformly in
readiness output.

That made two different situations look too similar:

- preview/test users who authenticate through break-glass dev auth and may
  legitimately have no `UserIdentity`
- production-like users who should eventually sign in through Microsoft Entra
  and create real provider-backed `UserIdentity` rows

## New Severity Rule

Readiness now classifies `usersWithoutIdentities` by environment/config signal:

- when `AUTH_ENABLE_DEV_AUTH=true`
  - severity: `WARNING`
  - interpretation: preview/dev-auth-only incompleteness may be expected
- when `AUTH_ENABLE_DEV_AUTH` is not enabled
  - severity: `BLOCKING`
  - interpretation: provider-backed identity linkage is required for rollout
    readiness

## What This Refinement Does

The readiness summary now exposes:

- total `usersWithoutIdentities`
- `previewExpectedUsersWithoutIdentities`
- `providerBackedUsersWithoutIdentities`
- `usersWithoutIdentitiesSeverity`
- a human-readable classification message
- `devAuthEnabled` as a non-secret diagnostics boolean

The `/admin/auth` readiness display now surfaces that distinction directly so
operators can see whether a providerless user count is expected preview noise
or a production-facing blocker.

## Important Limitation

This refinement does not introduce per-user provider provenance.

It uses environment/config state as the safe classification signal available in
the current architecture. That means:

- when dev auth is enabled, providerless users are treated as preview-expected
  warnings
- when dev auth is disabled, providerless users are treated as blocking gaps

That is intentionally conservative and avoids fake identity creation or schema
changes.

## Why This Is Safe

- no auth code paths were changed
- no session payloads were changed
- no database schema was changed
- no tenant filters were added
- no exports or reports were modified

## Recommended Next Phase

The safest next phase is:

- read-only report scoping diagnostics adoption

That keeps progress in low-risk diagnostics work while the current readiness
signals are now easier for operators to interpret correctly.
