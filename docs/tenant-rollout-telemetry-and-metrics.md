# Tenant Rollout Telemetry And Metrics

## Purpose

This phase adds lightweight read-only rollout telemetry for the employee master
tenant-filter pilot so operators can monitor scoped behavior and parity trends
during Preview validation.

It does not change:

- live report behavior
- export behavior
- tenant enforcement scope
- auth, session, or permissions behavior

## Telemetry Scope

Current telemetry covers the employee master pilot only.

It reports:

- current live page count
- tenant-scoped count
- excluded row count
- export/page mismatch state
- missing organization count
- current organization slug
- current `TenantContext.organizationId`
- current feature-flag state

## Aggregate Status

Telemetry exposes one aggregate status:

- `HEALTHY`
- `WARNING`
- `BLOCKING`

### HEALTHY

Means:

- no blocking parity issues
- no missing organization assignment issue
- no tenant-context resolution issue for the acting admin
- no CSV/PDF divergence

### WARNING

Means:

- the pilot is still operating in an expected-but-reviewable state
- common example: the page is tenant-scoped while exports remain global
- rollout expansion should pause until operators confirm the warning is
  understood and accepted

### BLOCKING

Means:

- rollout expansion should stop
- rollback may be recommended
- likely causes include:
  - missing `TenantContext.organizationId`
  - missing organization assignments
  - CSV/PDF mismatch

## Endpoint

Admin-only endpoint:

- `GET /api/admin/auth/employee-master-telemetry`

## UI Location

Admin diagnostics page:

- `/admin/auth`

Section:

- `Employee Master Rollout Telemetry`

## Operator Guidance

Use telemetry to answer:

- is the acting admin resolving to the expected organization?
- is the live page count aligned with the tenant-scoped count?
- are excluded rows expected and understood?
- are exports still global and diverging from the page as expected?
- is rollout expansion currently blocked?
- should rollback be considered?

## Rollback Guidance

Rollback is recommended when telemetry is `BLOCKING`, especially if:

- `TenantContext.organizationId` is missing
- report rows are missing organization assignment
- CSV and PDF counts diverge

Rollback is not automatically required for `WARNING`, but expansion should stay
paused until operators review the warning.

## Recommended Next Rollout Candidate

After telemetry stabilizes and repeated Preview validation passes are recorded,
the next recommended rollout candidate remains:

- reporting structure

That is still the safest next low-risk read-only diagnostics seam before any
broader tenant enforcement expansion.
