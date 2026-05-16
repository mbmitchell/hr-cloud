# Production Readiness Gap Assessment

## Purpose

This document assesses the remaining production-readiness gaps for the
`postgres-rehearsal` branch before tenant enforcement expands beyond the
current employee master pilot.

It is planning-only.

It does not change:

- runtime code
- Prisma schema
- feature flags
- tenant enforcement scope
- export behavior
- auth, session, or permissions behavior

## Current Validated State

The current validated state is:

- cross-tenant employee master report pilot works in Preview
- `default-org` and `test-credit-union` resolve correctly
- feature-flagged employee master page filtering works
- exports intentionally remain global
- export/page mismatch diagnostics work
- telemetry reports `WARNING` and blocks rollout expansion appropriately
- dev-auth preview users are expected to lack `UserIdentity` rows

This means the branch has validated one low-risk tenant-filter pilot in Preview.

It does not mean the system is ready for production tenant rollout.

The next concrete readiness artifact after this assessment is:

- `docs/provider-backed-identity-validation-runbook.md`

## Gap Classification Levels

- `Required before production`
- `Required before external tenant pilot`
- `Required before broad tenant enforcement`
- `Can wait`

## Gap Assessment

### 1. Microsoft Entra Production Auth

Current gap:

- Preview still relies on dev auth for controlled testing
- production Microsoft Entra sign-in has not yet been validated as the primary
  steady-state path for tenant rollout

Why it matters:

- production tenant users should authenticate through the real identity
  provider path
- dev-auth preview behavior must not become a production dependency

Classification:

- `Required before production`

### 2. UserIdentity Creation For Provider-Backed Users

Current gap:

- provider-backed `UserIdentity` creation is scaffolded, but production-like
  validation across real Entra sign-ins is not yet complete
- a dedicated validation runbook now exists, but it still needs to be executed
  with a real Entra-backed Preview user

Why it matters:

- production readiness should not rely on providerless linked users
- tenant-aware identity continuity depends on real provider linkage

Classification:

- `Required before production`

### 3. Disabling Dev Auth

Current gap:

- `AUTH_ENABLE_DEV_AUTH=true` remains enabled in Preview and is still expected
  there
- a production cutover plan for turning it off is not yet validated

Why it matters:

- production should not depend on break-glass credentials

Classification:

- `Required before production`

### 4. Production Organization Provisioning

Current gap:

- only test organizations and default-org rehearsal data are currently proven
- there is no production-grade organization provisioning workflow yet

Why it matters:

- production tenants need a controlled way to create organization records and
  base settings

Classification:

- `Required before external tenant pilot`

### 5. Tenant Onboarding Workflow

Current gap:

- there is no documented operational flow for creating a new production tenant,
  assigning identities, configuring storage, and validating initial access

Why it matters:

- a tenant cannot be onboarded safely by ad hoc database manipulation in
  production

Classification:

- `Required before external tenant pilot`

### 6. Organization Membership Assignment

Current gap:

- membership backfill is validated, but a production-grade operational process
  for assigning or reviewing memberships is not yet defined beyond current
  diagnostics and scaffolding

Why it matters:

- tenant access depends on correct organization membership

Classification:

- `Required before external tenant pilot`

### 7. Tenant-Scoped Exports

Current gap:

- employee master exports intentionally remain global
- export parity diagnostics exist, but scoped exports are not yet approved

Why it matters:

- production operators will eventually expect exports and pages to align once
  scoped rollout broadens

Classification:

- `Required before broad tenant enforcement`

### 8. Production Environment Variables

Current gap:

- the environment-separation plan exists, but full production values, secret
  handling, and final deployment inventory still need to be operationalized

Why it matters:

- production rollout requires clean separation of URLs, secrets, database,
  mailbox, storage, and internal job auth

Classification:

- `Required before production`

### 9. Object / Document Storage

Current gap:

- storage separation is planned, but tenant-aware storage partitioning and
  production document storage validation are not complete

Why it matters:

- documents are high-sensitivity and high-risk for cross-tenant leakage

Classification:

- `Required before broad tenant enforcement`

### 10. Email / Graph Sender Configuration

Current gap:

- hr-cloud-specific Graph/mailbox separation is documented, but production
  sender identity and tenant-specific Graph validation are not yet proven for
  tenant rollout

Why it matters:

- email is part of user-facing operational correctness and auditability

Classification:

- `Required before production`

### 11. Internal Jobs

Current gap:

- internal jobs remain global
- organization-scoped execution context for jobs is not designed or validated

Why it matters:

- background processing can silently bypass request-time scoping assumptions

Classification:

- `Required before broad tenant enforcement`

### 12. Audit Logging

Current gap:

- audit logging remains global
- production rules for tenant-scoped visibility versus platform-wide
  investigations are not finalized

Why it matters:

- audit coverage must stay trustworthy while preserving support and security
  review capability

Classification:

- `Required before broad tenant enforcement`

### 13. Backup / Restore

Current gap:

- backup separation is documented, but production restore drills for tenant-era
  data boundaries are not yet validated

Why it matters:

- production rollout requires restore confidence for both database and document
  storage

Classification:

- `Required before production`

### 14. Monitoring / Telemetry

Current gap:

- Preview telemetry exists for the employee master pilot
- production-ready monitoring, alerting, and operational dashboards for tenant
  rollout are not yet defined broadly

Why it matters:

- early production rollout depends on detecting parity failures, auth issues,
  and tenant-context problems quickly

Classification:

- `Required before external tenant pilot`

### 15. Support / Admin Break-Glass Access

Current gap:

- Preview uses dev auth
- a production-safe support or break-glass access model is not yet defined

Why it matters:

- operators still need controlled support access without weakening production
  tenant boundaries

Classification:

- `Required before production`

### 16. Security Review

Current gap:

- the branch has many safe diagnostics and scaffolding phases completed, but no
  dedicated tenant-era security review has been documented yet

Why it matters:

- production tenant rollout requires review of auth, authorization, exports,
  storage, jobs, and operational access patterns

Classification:

- `Required before production`

### 17. Data Migration From MFN HR

Current gap:

- copied-data rehearsal assumptions still exist
- there is no final production migration plan from the original MFN HR system
  into tenant-aware production state

Why it matters:

- production must decide how much legacy MFN data moves, how identities are
  linked, and how default-org assumptions are removed

Classification:

- `Required before production`

### 18. Production Rollback Plan

Current gap:

- feature-flag rollback is validated for the employee master pilot
- there is no broader production rollback playbook for tenant-era rollout

Why it matters:

- production needs rollback plans for config, auth, data visibility, exports,
  jobs, and support operations

Classification:

- `Required before production`

## Highest-Priority Production Blockers

The highest-priority production blockers are:

- Microsoft Entra production auth validation
- provider-backed `UserIdentity` creation validation
- disabling dev auth
- production environment and secret separation
- backup/restore validation
- support/admin break-glass access design
- security review
- production data migration plan
- production rollback plan

These are highest priority because they affect identity trust, recovery,
security, and operational safety across every later tenant-enforcement phase.

## Recommended Production Readiness Sequence

Recommended sequence:

1. complete production auth readiness
   - execute the provider-backed identity validation runbook
   - validate Microsoft Entra production-like sign-in
   - validate `UserIdentity` creation
   - define the plan for disabling dev auth

2. complete production environment readiness
   - finalize production secrets
   - finalize database target
   - finalize mail/Graph sender identity
   - finalize document storage target

3. complete operational safety readiness
   - backup/restore validation
   - monitoring and telemetry expansion
   - support/admin break-glass access design
   - security review

4. complete tenant provisioning readiness
   - production organization provisioning flow
   - organization membership assignment process
   - tenant onboarding workflow

5. complete migration and rollback readiness
   - production data migration plan from MFN HR
   - production rollback plan

6. complete scoped behavior readiness
   - scoped export readiness
   - report expansion readiness
   - job and audit-log scope design

7. only then discuss production tenant rollout

## What Can Wait

These items can wait until after the first safer production-ready foundation is
in place:

- broad tenant-scoped exports for all report families
- jobs/background scoping beyond design
- audit-log scoping beyond design
- high-risk module enforcement in PTO, compensation, and documents

Classification:

- `Can wait`

## Recommended Next Technical Phase

The safest next technical phase is:

- provider-backed identity validation execution

Why:

- the runbook now exists, so the next safe step is operational execution
- production readiness is currently blocked most strongly by real
  Microsoft-Entra-backed identity validation
- it stays aligned with the current diagnostics-first, rollout-safe approach
- it improves the largest production trust gap without expanding tenant
  enforcement
