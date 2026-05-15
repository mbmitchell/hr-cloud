# Employee Master Pilot Operational Validation

## Purpose

This runbook defines how operators should exercise the employee master
tenant-filter pilot safely in Preview before tenant enforcement expands any
further.

It is documentation-only.

It does not change:

- runtime behavior
- Prisma schema
- feature flags
- exports
- repositories
- auth, session, or permissions behavior

## Scope

This runbook covers:

- preview environment validation
- flag-off baseline validation
- flag-on pilot validation
- diagnostics capture
- rollback verification
- operator signoff expectations

It does not approve:

- export scoping
- tenant enforcement in other modules
- production rollout

## Preview Environment Setup

Target environment:

- Preview deployment only
- never production

Required runtime assumptions:

- preview deployment is healthy
- PostgreSQL rehearsal data is available
- `TenantContext` resolves for the acting admin
- organization membership backfill has already been applied for validated test
  admins
- `/admin/auth` loads successfully

Required Preview URLs:

- `/login`
- `/admin/auth`
- `/reports/employee-master`
- `/api/admin/auth/employee-master-shadow`
- `/api/admin/auth/employee-master-export-parity`
- `/api/admin/auth/readiness`

## Required Environment Variables

Operators should confirm these are set correctly in Preview:

- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `DATABASE_URL`
- `AUTH_ENABLE_DEV_AUTH`
- `AUTH_DEV_PASSWORD`
- `AUTH_DEV_AUTH_EMAIL_ALLOWLIST` if used
- `HR_CLOUD_ENABLE_EMPLOYEE_MASTER_TENANT_FILTER`
- Microsoft Entra variables if Entra validation is also being exercised:
  - `AUTH_MICROSOFT_ENTRA_ID_ID`
  - `AUTH_MICROSOFT_ENTRA_ID_SECRET`
  - `AUTH_MICROSOFT_ENTRA_ID_ISSUER`

Expected Preview values for this pilot:

- `AUTH_ENABLE_DEV_AUTH=true`
- `HR_CLOUD_ENABLE_EMPLOYEE_MASTER_TENANT_FILTER=false` for baseline pass
- `HR_CLOUD_ENABLE_EMPLOYEE_MASTER_TENANT_FILTER=true` for scoped pilot pass

## Approved Preview Test Users By Role

These preview users are approved for this validation phase:

- `mmitchell@mfncuso.com`
  - validated preview user
  - linked user
  - organization membership validated
- `test.siteadmin@mfncuso.com`
  - primary admin pilot user
  - linked user
  - organization membership validated
- `test.hradmin@mfncuso.com`
  - secondary admin-role user for role-based validation
- `test.manager@mfncuso.com`
  - manager-role visibility check
- `test.employee@mfncuso.com`
  - employee-role negative check

Additional seeded preview users may exist, but the pilot should center on
`test.siteadmin@mfncuso.com` unless another role-specific check is needed.

All dev-auth preview users use the shared preview `AUTH_DEV_PASSWORD`.

## Expected Warnings Vs Blocking Signals

### Expected During Preview

- `AUTH_ENABLE_DEV_AUTH=true outside development` build/runtime warning
- `usersWithoutIdentities` classified as preview/dev-auth warning-only
- page/export mismatch when:
  - `HR_CLOUD_ENABLE_EMPLOYEE_MASTER_TENANT_FILTER=true`
  - live page scopes
  - CSV/PDF remain intentionally global

### Blocking For Pilot Validation

- `/admin/auth` unavailable
- `TenantContext.organizationId` missing for the acting admin during the flag-on
  scoped validation pass
- employee master shadow diagnostics show unexpected exclusions or missing
  organization counts
- export parity diagnostics show unexplained `CSV_PDF_COUNT_MISMATCH`
- live page behavior does not match shadow expectations
- rollback by disabling the flag fails

## Validation Sequence

### 1. Preflight

Use `test.siteadmin@mfncuso.com` first.

Steps:

1. sign in at `/login`
2. open `/admin/auth`
3. confirm:
   - current admin tenant context resolves
   - readiness page loads
   - employee directory shadow panel loads
   - employee master shadow panel loads
   - employee master export parity panel loads
4. capture:
   - screenshot of `/admin/auth`
   - values for:
     - `Organization ID`
     - `Users without identities severity`
     - `Blocking issue count`
     - `Warning issue count`

Pass:

- `/admin/auth` loads cleanly
- `TenantContext.organizationId` is present
- preview-only identity warnings are clearly classified as warnings

### 2. Flag-Off Baseline

Set:

- `HR_CLOUD_ENABLE_EMPLOYEE_MASTER_TENANT_FILTER=false`

Steps:

1. open `/reports/employee-master`
2. record:
   - total employee count
   - active employee count
   - a few sample employees visible in the table
3. export CSV
4. export PDF
5. open `/admin/auth`
6. review:
   - Employee Master Report Shadow Results
   - Employee Master Export Parity Diagnostics

Expected behavior:

- live page remains global
- CSV remains global
- PDF remains global
- page count should match CSV and PDF counts
- shadow diagnostics remain informational only

Capture:

- screenshot of `/reports/employee-master`
- screenshot of export parity diagnostics
- recorded counts:
  - live page count
  - CSV export count
  - PDF export count
  - tenant-shadow count

Pass:

- live page matches prior known baseline
- CSV and PDF match each other
- no unexplained parity warnings

### 3. Flag-On Scoped Pilot

Set:

- `HR_CLOUD_ENABLE_EMPLOYEE_MASTER_TENANT_FILTER=true`

Steps:

1. open `/admin/auth`
2. confirm:
   - `TenantContext.organizationId` is still present
   - employee master shadow results load
   - export parity diagnostics load
3. open `/reports/employee-master`
4. compare:
   - live page count
   - tenant-scoped shadow count
   - excluded-by-tenant-filter count
5. export CSV
6. export PDF
7. compare:
   - live page count
   - CSV export count
   - PDF export count

Expected behavior:

- live page scopes to `TenantContext.organizationId`
- live page count matches tenant-shadow count
- CSV remains global
- PDF remains global
- page/export mismatch may be expected and should be visible in diagnostics

Capture:

- screenshot of `/reports/employee-master`
- screenshot of shadow diagnostics
- screenshot of export parity diagnostics
- counts:
  - live page count
  - CSV export count
  - PDF export count
  - tenant-shadow count
  - missing organization count
  - excluded-by-tenant-filter count

Pass:

- live page matches shadow scoped count
- exports remain intentionally global
- mismatch explanation is understandable and expected

### 4. Role-Based Validation

Use additional preview users as needed:

- `test.hradmin@mfncuso.com`
- `test.manager@mfncuso.com`
- `test.employee@mfncuso.com`

Steps:

1. confirm admin roles can access `/admin/auth`
2. confirm non-admin user cannot use admin diagnostics
3. confirm employee master report access behavior has not changed unexpectedly

Pass:

- admin access remains intact
- non-admin access remains restricted
- no permission behavior changed as part of the pilot

### 5. Rollback Verification

Set:

- `HR_CLOUD_ENABLE_EMPLOYEE_MASTER_TENANT_FILTER=false`

Steps:

1. redeploy/restart Preview with the flag disabled
2. open `/reports/employee-master`
3. confirm live page returns to the baseline global count
4. confirm CSV and PDF remain unchanged
5. confirm diagnostics still load

Pass:

- rollback is configuration-only
- no schema or data rollback is required

## Concise Operator Checklist

### `/admin/auth`

- confirm current admin tenant context resolves
- confirm readiness severity treats preview providerless users as warnings
- confirm employee directory shadow results are still healthy
- confirm employee master shadow results are still healthy
- confirm export parity diagnostics load and explain expected mismatch clearly

### `/reports/employee-master`

- flag off:
  - confirm global baseline count
- flag on:
  - confirm live page count matches tenant-shadow count

### Shadow Diagnostics

- confirm missing organization count is zero or explicitly understood
- confirm excluded-by-tenant-filter list is understandable
- confirm no unexplained warnings appear

### Export Parity Diagnostics

- confirm live page, CSV, and PDF counts match with flag off
- confirm live page vs export mismatch is expected and documented with flag on
- confirm CSV and PDF still match each other

### Role-Based Validation

- confirm admin can access diagnostics
- confirm non-admin cannot access diagnostics
- confirm no permission behavior drift

## Screenshots And Data To Capture

Operators should capture:

- `/admin/auth` full-page screenshot
- `/reports/employee-master` screenshot with flag off
- `/reports/employee-master` screenshot with flag on
- employee master shadow diagnostics screenshot
- employee master export parity diagnostics screenshot
- CSV export row count
- PDF export row count
- live page count
- tenant-shadow count
- missing organization count
- excluded-by-tenant-filter count
- acting user email and role
- flag state during each capture

## Pass / Fail Criteria

### Pass

- admin diagnostics load successfully
- `TenantContext.organizationId` is present for acting admin
- flag-off baseline remains unchanged
- flag-on live page matches tenant-shadow count
- CSV/PDF remain global and mutually consistent
- expected page/export mismatch is understood
- no blocking readiness or parity warnings appear
- rollback works by disabling the flag

### Fail

- any diagnostics panel fails to load
- shadow compare does not predict flag-on live page behavior
- CSV and PDF disagree
- admin tenant context is missing during scoped validation
- missing organization warnings are unexplained
- rollback cannot restore baseline behavior

## How To Record Anomalies

For each anomaly record:

- timestamp
- preview URL
- acting user email
- flag state
- page or endpoint affected
- expected result
- actual result
- screenshot link or file
- whether anomaly is:
  - expected preview warning
  - rollout-blocking defect
  - operator-understanding issue

## Criteria Before Enabling Exports Under The Same Flag

- repeated successful preview runs with flag on and off
- CSV and PDF parity remains stable
- page/export mismatch is fully understood by operators
- missing-organization count is zero or explicitly approved
- rollback has been exercised successfully
- operator signoff is recorded

## Criteria Before Expanding To Another Module

- employee master pilot validation has passed at least one full operator run
- anomalies, if any, are resolved or explicitly accepted
- governance gates remain satisfied
- diagnostics approach is considered reusable

## Criteria Before Any Production Rollout Discussion

- employee master pilot passes repeatedly in Preview
- exports either remain intentionally global with approved governance, or are
  separately validated before joining the flag
- at least one real Microsoft Entra validation path is documented
- preview/dev-auth-only warnings are no longer confused with production
  blockers
- rollback path is considered reliable
- operator signoff and governance signoff are complete

## Recommended Operator Validation Cadence

Recommended cadence:

- one baseline validation pass whenever Preview data or auth linkage changes
- one full flag-off plus flag-on validation pass before any rollout discussion
- repeat validation after any change to:
  - employee master report logic
  - tenant context resolution
  - organization membership linkage
  - export parity diagnostics

## Recommended Next Technical Phase

Only after successful operator validation:

- read-only report scoping diagnostics adoption for `reporting structure`

That extends the proven diagnostics-first rollout pattern without broadening
live tenant enforcement too early.
