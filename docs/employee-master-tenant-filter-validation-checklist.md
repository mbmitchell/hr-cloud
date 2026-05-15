# Employee Master Tenant Filter Validation Checklist

## Purpose

This checklist is for validating the default-off employee master tenant filter
pilot before it expands to CSV/PDF exports or to other modules.

It is a verification document only.

It does not change runtime behavior.

## Preconditions

Before testing:

1. confirm the branch is `postgres-rehearsal`
2. confirm the target environment is not production
3. confirm the employee master shadow compare route is available:
   - `/api/admin/auth/employee-master-shadow`
4. confirm the admin auth diagnostics page is available:
   - `/admin/auth`
5. confirm the current admin resolves a visible `TenantContext`
6. confirm the current test dataset is rehearsal-safe

## Validation Steps

### 1. Flag-Off Baseline

Set:

- `HR_CLOUD_ENABLE_EMPLOYEE_MASTER_TENANT_FILTER=false`

Validate:

1. open `/reports/employee-master`
2. record total employee count and sample rows
3. export CSV and PDF
4. confirm the page still matches the known global baseline
5. confirm CSV and PDF still match the known global baseline
6. confirm the employee master shadow diagnostics remain informational only

Expected result:

- no live behavior change
- page remains global
- CSV remains global
- PDF remains global

### 2. Flag-On With Valid `TenantContext.organizationId`

Set:

- `HR_CLOUD_ENABLE_EMPLOYEE_MASTER_TENANT_FILTER=true`

Use an admin whose `TenantContext.organizationId` is populated.

Validate:

1. open `/admin/auth`
2. confirm the current admin `TenantContext.organizationId` is not null
3. review the employee master shadow results section
4. open `/reports/employee-master`
5. confirm the page count matches the tenant-scoped shadow count
6. confirm excluded rows in shadow diagnostics are not visible on the live page
7. confirm CSV and PDF still reflect the current global export behavior

Expected result:

- live page scopes to the current organization
- live page count matches shadow tenant-scoped count
- exports remain global in this phase

### 3. Flag-On With Missing `TenantContext.organizationId`

Set:

- `HR_CLOUD_ENABLE_EMPLOYEE_MASTER_TENANT_FILTER=true`

Use a rehearsal admin context where `TenantContext.organizationId` is missing,
or otherwise validate in a controlled test scenario.

Validate:

1. confirm `/admin/auth` shows missing or fallback-related tenant warnings
2. open `/reports/employee-master`
3. confirm the page fails closed and does not show the normal global report set
4. confirm CSV and PDF export behavior remains unchanged because exports are not
   in scope for this flag phase

Expected result:

- live page does not silently fall back to the global dataset
- live page does not silently scope with a null organization
- exports remain unchanged

### 4. Default-Org Rehearsal Data Parity

Validate:

1. use default-org rehearsal data where employee records are expected to align
   to a single organization
2. compare:
   - employee master shadow current count
   - employee master shadow tenant-scoped count
   - live page count with the flag on
3. confirm missing-organization count is zero or fully understood

Expected result:

- shadow current count equals shadow tenant-scoped count
- live page count equals shadow tenant-scoped count
- no unexplained exclusions

### 5. Missing Organization Rows

Validate:

1. inspect the employee master shadow results warnings
2. confirm whether `REPORT_EMPLOYEES_MISSING_ORGANIZATION` appears
3. review excluded rows and missing-organization counts
4. record whether the issue is real data cleanup work or an expected temporary
   rehearsal gap

Expected result:

- missing organization rows are either zero or explicitly accounted for

### 6. Shadow Compare Parity

Validate:

1. use the admin auth diagnostics page shadow results
2. compare live page counts against:
   - current report employee count
   - tenant-scoped report employee count
   - excluded-by-tenant-filter count
3. confirm no unexplained difference remains between the shadow model and the
   live flag-on page behavior

Expected result:

- shadow compare accurately predicts live flag-on page behavior

### 7. Live Page Vs Export Mismatch Awareness

Validate:

1. with the flag on, compare the live page count to:
   - CSV export row count
   - PDF export row population
2. confirm operators understand this mismatch is temporary and expected in the
   current phase
3. confirm no one treats export output as tenant-scoped until exports join the
   rollout

Expected result:

- operator documentation and rollout notes clearly acknowledge the mismatch

### 8. Rollback By Disabling The Flag

Set:

- `HR_CLOUD_ENABLE_EMPLOYEE_MASTER_TENANT_FILTER=false`

Validate:

1. redeploy or restart using the flag-off setting
2. open `/reports/employee-master`
3. confirm the live page returns to the known global baseline
4. confirm no schema or data rollback is required

Expected result:

- rollback is immediate through configuration only
- page behavior returns to baseline without code or data changes

## Go / No-Go Criteria Before Expanding To CSV/PDF Exports

### Go

Proceed only if all of the following are true:

1. flag-off behavior matches the known baseline exactly
2. flag-on page behavior matches the shadow tenant-scoped count
3. missing-organization rows are zero or explicitly accepted
4. default-org rehearsal parity is confirmed
5. operators understand the temporary page/export mismatch
6. rollback by disabling the flag is verified

### No-Go

Do not expand to CSV/PDF exports yet if any of the following are true:

1. shadow compare does not predict live flag-on page results
2. missing-organization rows are unexplained
3. `TenantContext.organizationId` resolution is unstable for admins
4. operators are likely to mistake global exports for scoped exports
5. rollback has not been exercised successfully

## Sign-Off Notes

Record these before expanding the rollout:

- environment tested
- admin account used
- flag state tested
- baseline counts observed
- shadow counts observed
- live page counts observed
- export mismatch confirmation
- rollback confirmation
- final go/no-go decision
