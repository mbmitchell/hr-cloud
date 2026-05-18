# Tenant Enforcement Rollout Governance

## Purpose

This document defines the operational governance rules for expanding tenant
enforcement beyond the current `postgres-rehearsal` pilot work.

It is planning-only.

It does not change:

- runtime behavior
- Prisma schema
- feature flags
- report or export behavior
- auth, session, or permissions behavior

## Current Validated Rollout State

The current validated state on `postgres-rehearsal` is:

- PostgreSQL migration lineage validated on scratch PostgreSQL
- `TenantContext` scaffolding validated
- identity linkage scaffolding validated
- `OrganizationMembership` backfill validated
- employee directory shadow parity achieved
- employee master shadow parity achieved
- employee master feature-flagged tenant filter validated in preview
- employee master export parity diagnostics available
- organization membership parity validated
- remaining provider-identity warnings are expected for preview/dev-auth users
- production-readiness gap assessment completed

This means the branch has proven:

- low-risk diagnostics-first rollout patterns
- preview-first parity validation
- default-off feature flag behavior on one narrow report seam
- rollback-safe scaffolding for identity and membership readiness
- lightweight telemetry and metrics for the employee master pilot

It does not yet prove:

- safe tenant enforcement across business modules
- safe export scoping
- safe scheduled-job scoping
- safe audit-log scoping
- safe write-path tenant enforcement
- production readiness for real tenant rollout

## Approved Pilot Scope

Currently approved enforcement scope:

- employee master live page only
- only behind `HR_CLOUD_ENABLE_EMPLOYEE_MASTER_TENANT_FILTER`
- only after preview validation
- exports remain intentionally global

Currently approved non-enforcement scope:

- employee directory shadow diagnostics
- employee master shadow diagnostics
- employee master export parity diagnostics
- identity and organization readiness diagnostics
- tenant-context diagnostics

These are approved because they are read-only and do not change business
behavior.

## Modules Not Yet Approved For Enforcement

Not yet approved for real tenant enforcement:

- employee directory live filtering
- reporting structure
- user access report
- job changes report
- document acknowledgements
- PTO ledger
- PTO liability
- benefit withholding export
- liability export
- notifications
- onboarding
- offboarding
- documents
- PTO write paths
- compensation
- internal jobs and background automation
- audit logs
- policy settings

Approval for diagnostics does not imply approval for enforcement.

## Governance Rules

### When A Shadow Compare Is Required

A shadow compare is required before live tenant enforcement when all of the
following are true:

- the module returns organization-owned business data
- the current result set is global today
- the target change would alter visible row counts or visible records
- the module has operator-facing review value

Required shadow-compare stages:

1. service-level shadow compare or diagnostics helper
2. admin/internal-only route
3. operator-visible diagnostics UI or repeatable diagnostics workflow
4. parity review against known rehearsal data

Shadow compare is mandatory for:

- employee directory
- employee-centered reports
- low-risk exports before scoped rollout
- any medium-risk read path that changes visible records

Shadow compare may be skipped only for:

- purely internal technical scaffolding that does not affect visible data
- modules that remain explicitly global by design

### When A Feature Flag Is Required

A default-off feature flag is required before any live tenant enforcement when:

- the module changes user-visible record scope
- the module changes exported data scope
- the module changes admin/operator behavior in a way that could surprise users
- rollback needs to happen without redeploying schema or business logic

Feature flags are required for:

- live report scoping
- live directory scoping
- export scoping
- medium-risk module scoping
- any early write-path enforcement

Feature flags are not required for:

- diagnostics-only additions
- documentation-only phases

### When Exports Must Remain Global

Exports must remain global when:

- the paired live page has only just entered pilot enforcement
- page/export parity diagnostics are not yet available
- CSV and PDF parity has not been validated
- operators cannot clearly explain expected page/export mismatch
- missing-organization warnings remain unresolved

Exports may join scoped rollout only when:

- live page pilot has been validated in preview
- CSV and PDF counts match each other under the same filters
- page/export mismatch is understood and documented
- rollback path is tested
- operator signoff has been captured

### When Jobs And Background Processes Can Be Scoped

Jobs and background processes can be scoped only after:

- read-path scoping has been validated for the same domain
- write-path ownership is clear
- `TenantContext` or equivalent organization execution context is explicitly
  designed for non-request execution
- audit and retry semantics are documented
- cross-organization fan-out behavior is reviewed

Jobs must remain global until then.

### When Audit Logs Can Be Scoped

Audit logs can be scoped only after additional design review.

Audit-log scoping is not approved until:

- platform-wide investigations remain possible
- support/admin cross-organization views are preserved appropriately
- security-event correlation remains intact
- organization scoping rules for both read and write audit events are defined

Audit logs remain global until those controls are documented and reviewed.

## Required Parity Checks Before Enabling Any Flag

Before enabling a tenant-enforcement flag for any module:

- shadow compare exists
- current vs scoped counts are visible
- missing organization count is known
- excluded-by-tenant-filter rows are reviewable
- warnings are documented
- preview rehearsal data shows expected parity or expected controlled mismatch
- operator guidance exists
- rollback path is documented

Additional export-specific parity checks:

- live page count
- CSV export count
- PDF export count
- tenant-shadow scoped count
- explicit mismatch explanation when exports remain global

## Required Preview Validation Steps

Every new enforcement pilot should follow this preview validation sequence:

1. validate `TenantContext` for the acting admin/operator
2. validate identity and organization readiness
3. validate shadow compare counts
4. validate missing organization count
5. validate excluded row review list
6. validate role/authorization behavior remains unchanged
7. validate feature flag off behavior
8. validate feature flag on behavior in preview only
9. validate rollback by disabling the flag
10. record operator signoff
11. capture telemetry status and warning state for the acting admin

For the current employee master pilot, the concrete operator runbook is:

- `docs/employee-master-pilot-operational-validation.md`
- `docs/tenant-rollout-telemetry-and-metrics.md`

## Rollback Procedures

Rollback must be possible without schema changes or emergency data rewrites.

Required rollback procedure for flagged enforcement pilots:

1. disable the feature flag
2. verify live page or route returns to prior global behavior
3. verify exports remain at their prior behavior
4. verify diagnostics still load
5. capture the reason for rollback and blocked readiness signal

Rollback must not depend on:

- manual data mutation
- deleting organization assignments
- deleting memberships
- deleting identities

## Feature Flag Governance

Feature flag rules:

- new enforcement flags must default to `false`
- one flag should govern one rollout seam or one tightly coupled rollout family
- page and export flags should not diverge long-term unless a short-lived
  emergency split is absolutely necessary
- flags must have documented rollback notes
- flags must have documented preview validation steps

Current governed flag:

- `HR_CLOUD_ENABLE_EMPLOYEE_MASTER_TENANT_FILTER`

## Operator Signoff Expectations

Before expanding enforcement to a new module, signoff should include:

- engineering review of diagnostics output
- product/operations confirmation that scoped behavior is understood
- confirmation that missing-organization warnings are acceptable or resolved
- confirmation that expected mismatches are documented
- explicit approval of rollback steps

No module should move from diagnostics-only to enforced filtering without human
operator review.

The current employee master pilot should use the operator capture process in:

- `docs/employee-master-pilot-operational-validation.md`
- `docs/tenant-rollout-telemetry-and-metrics.md`

Broader rollout should also consult:

- `docs/production-readiness-gap-assessment.md`

## Recommended Rollout Order By Module

Recommended rollout sequence after employee master:

1. employee directory
   - lowest-risk next live enforcement candidate after employee master
   - employee-centered and already shadow-validated

2. reporting structure
   - low-risk report seam
   - employee-centered hierarchy view

3. low-risk reports
   - user access
   - job changes only after additional seam validation if needed

4. medium-risk reports
   - document acknowledgements
   - PTO ledger
   - benefit withholding export only after service seam cleanup

5. notifications
   - only after related read/write ownership is tenant-safe

6. onboarding/offboarding
   - workflow-heavy and cross-table, so later than low-risk reporting

7. documents
   - storage partitioning and secure retrieval make this late-stage

8. PTO
   - approval workflows, accrual logic, and liability coupling make this late

9. compensation
   - sensitive and finance-adjacent, requiring extra validation

10. jobs/background automation
   - only after tenant execution-context design is complete

11. audit logging
   - last
   - requires platform-support and security-review design

## High-Risk Areas Requiring Additional Design Review

Highest-risk rollout areas:

- PTO
- compensation
- jobs/background automation
- audit logging
- documents and document acknowledgements

Why these are highest risk:

- broad cross-table joins
- write-side side effects
- finance sensitivity
- background processing
- security and audit obligations
- export or downstream operational dependencies

## Production Readiness Gates

Before any module is enabled in production-like rollout:

- PostgreSQL lineage is stable for the branch being deployed
- identity linkage readiness is acceptable for the environment
- organization assignments are sufficiently complete for the target module
- membership readiness is validated for target users
- shadow parity or expected mismatch has been reviewed
- feature flag default-off behavior is verified
- rollback path is tested
- operator signoff is recorded

Additional production gate for provider identity:

- providerless users may remain preview warnings while dev auth is enabled
- provider-backed tenant rollout should not rely on dev-auth-only identities in
  production

## Metrics And Warnings That Block Rollout

The following should block rollout for a new enforced module:

- unresolved duplicate or ambiguous email risks
- unresolved employee/user email mismatch risks
- unresolved `Employee.organizationId` gaps for in-scope records
- unresolved missing membership gaps for in-scope linked users
- missing `TenantContext.organizationId` for intended scoped actors
- unexplained shadow parity failures
- unexplained page/export parity failures
- CSV/PDF mismatch for scoped export candidates
- unreviewed excluded-by-tenant-filter records
- production-like provider identity gaps when dev auth is not enabled

The following may remain warning-only in preview:

- known dev-auth-only users without `UserIdentity`
- expected page/export mismatch while exports intentionally remain global

## Recommended Next Technical Phase

The safest next technical phase after this governance planning step is:

- read-only report scoping diagnostics adoption on one additional low-risk
  report seam, preferably reporting structure

That continues to prove the diagnostics and governance model without expanding
live tenant enforcement too broadly.
