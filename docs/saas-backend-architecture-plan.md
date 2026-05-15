# SaaS Backend Architecture Plan

## Current Rehearsal Status

Current state summary as of this checkpoint:

- PostgreSQL rehearsal lineage exists and builds cleanly on this branch
- platform identity foundation exists in schema and rehearsal migration artifacts
- auth still signs users in as `Employee` and session shape is still `employeeId`-centric
- best-effort `User`, `UserIdentity`, and `Employee.userId` linkage scaffolding exists
- admin-only diagnostics now cover identity linkage, organization readiness, and current tenant-context resolution
- no tenant enforcement, repository scoping, auth-session redesign, or business-module scoping has started yet

Implemented on the `postgres-rehearsal` branch in the low-risk platform identity foundation phase:

- added `Organization`
- added `User`
- added `OrganizationMembership`
- added `UserIdentity`
- added nullable `organizationId` to `Employee`
- added nullable `userId` to `Employee`
- generated a PostgreSQL rehearsal migration artifact for this phase, including default-organization backfill SQL

Still intentionally not implemented in this phase:

- tenant scoping for PTO, documents, onboarding, offboarding, notifications, jobs, or APIs
- auth/session changes
- repository refactors
- any runtime multi-tenant enforcement

Implemented in the next low-risk auth scaffolding phase:

- best-effort `User` creation during successful auth
- best-effort `UserIdentity` creation during successful Microsoft Entra auth
- best-effort `Employee.userId` linkage when a matching employee already exists and is still unlinked
- no changes to sign-in allow/deny behavior
- no changes to session shape
- no tenant enforcement

Implemented in the next linked-identity coverage phase:

- read-only linkage coverage summary helpers
- preview-first, idempotent backfill support for `User` plus `Employee.userId`
- admin-only route for coverage inspection and controlled apply mode
- no `UserIdentity` backfill without known provider identity
- no changes to auth/session behavior

Implemented in the next read-only identity consumption phase:

- per-employee linked identity resolver
- admin-only diagnostics route for linked `User` and `UserIdentity` state
- organization membership count visibility for linked users
- read-only mismatch/conflict flags
- no session or login behavior changes

Implemented in the next admin diagnostics UI phase:

- read-only linked identity diagnostics panel inside the existing admin employee tab
- operator guidance for common flag states
- diagnostics UI backed by the existing admin-only endpoint
- no mutation controls yet

Implemented in the next operator playbook phase:

- remediation guidance for each linked identity diagnostics flag
- safe review and cleanup sequencing for operators
- explicit guidance on when not to auto-fix ambiguous identity states
- playbook reference linked from the admin diagnostics documentation

Implemented in the next organization membership scaffolding phase:

- preview-first `OrganizationMembership` backfill helper
- idempotent apply mode for linked `Employee.organizationId` plus `Employee.userId`
- admin-only route for membership preview and explicit apply
- conservative default membership role/status without tenant enforcement

Implemented in the next read-only organization visibility phase:

- employee-level diagnostics for `organizationId` and resolved organization metadata
- visibility into whether the linked user has membership in the employee organization
- membership role/status visibility and mismatch flags
- read-only operator guidance for organization and membership readiness

Implemented in the next unified readiness diagnostics phase:

- one admin-only readiness summary for Employee to User to UserIdentity to OrganizationMembership state
- aggregate counts for missing linkage, missing organization, missing memberships, duplicate-email risks, and inactive memberships
- read-only readiness status on the existing admin auth diagnostics page
- references to identity linkage coverage, membership backfill, and the operator remediation playbook

Planned in the next tenant context design phase:

- define the future `TenantContext` shape before any organization enforcement begins
- document how tenant context should resolve from the current employee-based session plus linked `User` and `OrganizationMembership`
- identify the migration order for routes, services, reports, and internal jobs
- keep the phase documentation-only so current runtime behavior stays unchanged

Implemented in the next tenant context resolver scaffolding phase:

- added a server-side read-only `TenantContext` resolver
- resolved nullable `organizationId`, `userId`, `employeeId`, role codes, permission codes, source, and warnings
- added an admin-only diagnostics endpoint for the current resolved tenant context
- surfaced the current admin tenant context on the existing auth diagnostics page
- kept authorization and data-access behavior unchanged

Implemented in the next route and repository scaffolding phases:

- added request-edge tenant-context helpers for low-risk admin diagnostics routes
- adopted the route-edge pattern in multiple preview-only admin diagnostics routes
- added two read-only repository-wrapper pilots that accept `TenantContext` without changing filters or returned data

Planned in the next tenant-scope candidate classification phase:

- classify modules and route groups by tenant-scoping risk
- identify which modules should not be scoped yet
- recommend the first real organization-filter pilot on the lowest-risk employee-centered read path

## 1. Current Backend Architecture Summary

The current backend is a single-company internal HR system built around one global employee directory and one global policy/role space.

- Next.js App Router hosts both UI and API routes.
- Prisma is used directly from route handlers and service modules through a single global `prisma` client in `lib/db.ts`.
- The database provider is currently MySQL.
- Authentication resolves directly to `Employee`, and the session stores `employeeId` as the primary application identity.
- Authorization is enforced server-side through `lib/server/authorization.ts`, `lib/auth/access.ts`, and `lib/auth/permissions.ts`.
- Role and permission assignment is global across the whole system.
- PTO, onboarding, offboarding, documents, audit logging, compensation, and notifications all reference `Employee` directly.
- Internal jobs and outbox processors are global and not tenant-aware.
- Document storage uses a shared root path plus per-employee subpaths.

The current shape is good for one internal company, but it is not ready for SaaS isolation because there is no organization boundary in the data model, session, repositories, or jobs.

## 2. Recommended Target SaaS Architecture

Recommended target shape:

- single application deployment
- shared database
- shared schema
- tenant-owned business data identified by `organizationId`
- platform user identity separated from tenant employee records
- tenant context resolved once per request, then passed through services and repositories
- strict tenant filtering in every repository and write path
- object storage keys partitioned by organization
- outbox, scheduled jobs, and audit records made organization-aware

Recommended logical layers:

- platform identity layer
  - users, auth identities, organization memberships
- tenant business layer
  - employees, PTO, documents, onboarding, offboarding, compensation, audit, notifications
- application service layer
  - tenant-aware services wrapping business rules
- repository/data access layer
  - centralized tenant-scoped Prisma access instead of ad hoc direct queries over time
- async processing layer
  - tenant-aware outbox processing and scheduled jobs

## 3. Recommended Database Provider And Why

Recommended provider: PostgreSQL.

Why PostgreSQL is a better SaaS target for this app:

- strong support for multi-tenant shared-schema workloads
- better long-term ecosystem for JSON-heavy outbox/audit payloads
- more flexible indexing options for organization-scoped queries
- better fit if row-level security is ever introduced later
- excellent managed-cloud options across AWS, GCP, Azure, Neon, Supabase, Crunchy, and RDS/Aurora
- strong Prisma support
- easier future analytics/reporting integrations for tenant-partitioned data

Recommended deployment choice:

- managed PostgreSQL such as AWS RDS PostgreSQL or Aurora PostgreSQL if AWS remains the default platform
- Neon or similar serverless PostgreSQL can work for lower-scale or faster platform iteration, but HR data usually benefits from predictable private networking, backup controls, and conventional managed database operations

## 4. MySQL-To-Postgres Migration Considerations

The current Prisma schema is MySQL-specific at the datasource level but otherwise portable enough to migrate deliberately.

Main migration considerations:

- switch `datasource db.provider` from `mysql` to `postgresql` only in a dedicated migration phase
- validate all `Decimal` usage in compensation and benefit tables
- validate enum migration for Prisma enums now backed by PostgreSQL enum types
- validate JSON field behavior for:
  - `HrNotificationOutbox.payload`
  - `EmployeeChangeRequest.oldValues`
  - `EmployeeChangeRequest.newValues`
- validate null and unique-index behavior differences, especially around nullable unique columns
- validate date and timestamp precision assumptions for PTO, jobs, and audit trails
- validate text-search and case-sensitivity assumptions for email uniqueness and lookups
- validate migration scripts, seed assumptions, and index naming conventions

Recommended migration approach:

- do not combine tenancy refactors and database-provider migration in one release
- first make the schema tenant-ready in MySQL or in an isolated branch plan
- then perform a controlled MySQL-to-Postgres migration with verification tooling
- or, if greenfield SaaS launch is acceptable, build the SaaS schema directly on PostgreSQL and migrate business logic there without carrying production tenant traffic through a dual-provider phase

## 5. Proposed Multi-Tenant Strategy

Recommended tenancy model:

- shared database
- shared schema
- `organizationId` on tenant-owned tables

Why this is the right first SaaS strategy:

- lowest operational complexity
- easiest to iterate on quickly
- easiest to keep a single deployable application
- simplest for cross-tenant platform operations and support tooling
- works well if tenant isolation is enforced consistently in code and schema

Do not start with:

- database-per-tenant
- schema-per-tenant
- custom tenant forks

Those may become future premium isolation options, but they add too much complexity for the first SaaS platform conversion.

## 6. Proposed Organization Model

Recommended new platform-owned root model:

- `Organization`
  - `id`
  - `slug`
  - `name`
  - `status`
  - `billingStatus`
  - `subscriptionPlan`
  - `defaultTimeZone`
  - `defaultLocale`
  - `primaryDomain`
  - `createdAt`
  - `updatedAt`

Recommended optional related platform configuration:

- `OrganizationSettings`
  - policy defaults
  - PTO defaults
  - branding metadata
  - storage configuration metadata
  - notification preferences
- `OrganizationDomain`
  - verified email domains for login mapping
- `OrganizationFeatureFlag`
  - plan- or tenant-specific feature rollout

## 7. Proposed OrganizationMembership/User Model Approach

The current app treats `Employee` as both workforce record and authenticated app identity. That should be split.

Recommended platform identity models:

- `User`
  - canonical SaaS account identity
  - email
  - global auth state
  - identity-provider linkage
- `UserIdentity`
  - provider-specific records such as Entra, Google, passwordless, etc.
- `OrganizationMembership`
  - links `User` to `Organization`
  - membership status
  - platform-level org access role
  - invitation and onboarding state

Recommended tenant workforce model:

- `Employee`
  - remains the HR business record
  - becomes organization-scoped
  - optionally links to `userId` for self-service access

Why this split matters:

- one human user may belong to multiple organizations in the future
- not every employee must have an active login
- not every login must be an employee
- platform admins/support users should not have to masquerade as employee records

## 8. Tables That Should Become Tenant-Owned

These tables should carry `organizationId` because they represent tenant business data or tenant operations.

- `Employee`
- `EmployeeContactInfo`
- `EmployeeEmergencyContact`
- `EmployeeBenefitElection`
- `EmployeeCompensationProfile`
- `EmployeeCompensationHistory`
- `EmployeeChangeRequest`
- `PTORequest`
- `PTORequestAction`
- `PTOLedger`
- `EmployeeStatusHistory`
- `EmployeeDocument`
- `AssignableDocument`
- `AssignableDocumentVersion`
- `EmployeeDocumentAssignment`
- `DocumentAssignmentEmailOutbox`
- `DocumentAssignmentReminderEmailOutbox`
- `OnboardingTemplate`
- `OnboardingTemplateTask`
- `OnboardingTemplateTaskDocumentRequirement`
- `OnboardingTemplateTaskAcknowledgementRequirement`
- `EmployeeOnboarding`
- `EmployeeOnboardingTask`
- `EmployeeOnboardingTaskDocumentRequirement`
- `EmployeeOnboardingTaskAcknowledgementRequirement`
- `OffboardingTemplate`
- `OffboardingTemplateTask`
- `EmployeeOffboarding`
- `EmployeeOffboardingTask`
- `EmployeeRoleAssignment`
- `PolicySettings`
- `AuditLog`
- `HrNotificationOutbox`
- `ScheduledJobRun`

## 9. Tables That May Remain Global Or Platform-Owned

These can stay platform-owned if the product uses a centralized permission catalog.

- `Permission`
- possibly `Role`, if roles are treated as platform templates instead of tenant data
- future `User`
- future `UserIdentity`
- future `Organization`
- future `OrganizationMembership`

Recommended default:

- keep `Permission` platform-global
- make `Role` tenant-owned or role-template-based with tenant overrides

## 10. Tables Needing Special Handling

### `Role`

- current state: global role catalog
- SaaS recommendation: choose one of two models
- preferred model: platform role templates plus organization-specific roles
- reason: organizations often need small variations in HR/admin/manager permissions

Suggested long-term pattern:

- `RoleTemplate` as platform-owned
- `Role` as organization-owned materialization or customized role

### `Permission`

- current state: global permission catalog
- recommendation: remain global/platform-owned
- reason: permission codes should be stable application capabilities, not tenant data

### `EmployeeRoleAssignment`

- current state: links global `Employee` to global `Role`
- recommendation: tenant-owned with `organizationId`
- unique constraints must become organization-aware
- future validation must ensure assignment role and employee belong to the same organization

### `Employee`

- current state: root business identity, auth anchor, manager hierarchy root
- recommendation: tenant-owned
- add `organizationId`
- add optional `userId`
- make manager relationships organization-scoped
- current unique email rule must become organization-aware unless the product intentionally disallows the same work email in multiple orgs

### `EmployeeDocument`

- current state: employee-owned row with shared storage root
- recommendation: tenant-owned
- storage keys must include organization partitioning
- access rules must require both organization match and employee visibility authorization

### `AssignableDocument`

- current state: global tenantless policy/acknowledgement catalog
- recommendation: tenant-owned
- reason: SaaS customers will have different handbooks, policies, and document versions

### `PTORequest`

- current state: employee-owned and globally queryable by direct Prisma access
- recommendation: tenant-owned
- approval, notification, and reporting queries must all include organization scope

### `PTOLedger`

- current state: employee-owned financial ledger
- recommendation: tenant-owned
- idempotency and uniqueness constraints must be organization-aware
- rollover/accrual jobs must process by organization

### `AuditLog`

- current state: global append-only audit table with `userId` string
- recommendation: tenant-owned for tenant business events, with optional platform-global audit for platform admin actions
- add organization-aware actor references
- keep support for system actors and internal jobs

### `ScheduledJobRun` and Outbox Tables

- current state: global background-processing state
- recommendation: tenant-owned or tenant-addressable
- every run should identify organization scope or explicit platform scope
- global unique run keys must become organization-aware if the same job name runs per tenant

### Compensation Tables

- `EmployeeCompensationProfile`
- `EmployeeCompensationHistory`
- `EmployeeBenefitElection`

Recommendation:

- tenant-owned
- organization-aware reporting keys
- isolate payroll-related exports and reporting by organization

## 11. Repository/Service Tenant Context Pattern

Current pattern:

- routes often call `requireActor()`
- routes and services query Prisma directly
- authorization and data filtering are separate concerns

Recommended target pattern:

- resolve `TenantContext` once per request
- pass `TenantContext` into every repository/service call
- centralize tenant filtering in repositories, not in scattered route code

Recommended `TenantContext` shape:

- `userId`
- `organizationId`
- `membershipId`
- `employeeId` for org-specific self-service sessions
- `roles`
- `permissions`
- `isPlatformAdmin`

Recommended service pattern:

- `employeeRepository.listByOrganization(ctx, filters)`
- `ptoRepository.createRequest(ctx, input)`
- `documentRepository.findById(ctx, id)`
- `auditService.write(ctx, event)`

Guardrail:

- no repository method for tenant-owned data should exist without an organization-aware filter path

## 12. API Authorization Rules For Tenant Isolation

Recommended authorization model:

- request must first resolve platform user identity
- request must resolve active organization membership
- request must resolve current organization-scoped roles and permissions
- every read and write must enforce organization match before business authorization rules

Authorization order should become:

1. authenticate user
2. resolve organization context
3. verify resource belongs to organization
4. apply role/permission/business-rule checks inside that organization

Examples:

- manager can view direct reports only within the same organization
- admin can manage employees only within the same organization
- document acknowledgement admins can assign documents only within the same organization
- reports must never aggregate across organizations unless explicitly platform-admin-only

## 13. Auth/Session Changes Needed For SaaS

Current auth shape:

- login resolves directly to `Employee`
- JWT/session stores `employeeId`
- Entra mapping is tied to employee record and single-company assumptions

Recommended SaaS auth target:

- auth resolves to `User`
- session stores:
  - `userId`
  - `activeOrganizationId`
  - `membershipId`
  - optional `employeeId` for the selected org
- organization selection happens at login or immediately after login if the user belongs to multiple organizations

Needed future auth changes:

- split platform identity from employee business records
- allow multiple IdP configurations per organization or per domain
- replace fixed `@mfncuso.com` logic with organization/domain mapping
- support invitation and membership lifecycle
- keep server-side authorization as the source of truth

## 14. Object Storage Changes Needed For Documents

Current storage shape:

- local/shared filesystem root from `DOCUMENT_STORAGE_ROOT`
- storage keys partition by employee path only

Recommended SaaS storage target:

- object storage such as S3-compatible storage
- organization-prefixed keys
- environment-specific bucket separation

Recommended key pattern:

- `organizations/{organizationId}/employees/{employeeId}/documents/{documentId}/{filename}`

Recommended document-storage changes:

- document metadata remains in the database
- binaries move to object storage
- signed URL or streamed proxy access remains authorization-protected
- lifecycle, retention, encryption, and backup become tenant-aware

## 15. Email/Outbox/Internal Job Tenant-Awareness Changes

Current state:

- outbox rows are global
- notification processing is global
- internal jobs run with global run keys and global employee scans

Recommended target:

- every outbox row carries `organizationId`
- notification processors fetch work by organization scope
- scheduled jobs can run:
  - per organization
  - or as platform jobs faning out into organization-scoped work

Recommended job model:

- small platform scheduler
- organization-scoped work units
- organization-aware idempotency keys
- organization-aware auditing for job start, success, and failure

Examples needing tenant awareness:

- PTO accrual jobs
- year-end rollover jobs
- reminder generation
- notification processing
- liability reporting jobs
- job-change escalation automation

## 16. Migration Sequencing From Current Schema To SaaS Schema

Recommended sequence:

### Phase A: Platform identity foundation

- add `Organization`
- add `User`
- add `OrganizationMembership`
- do not change existing business logic yet

### Phase B: Tenant ownership keys

- add nullable `organizationId` to tenant-owned tables
- backfill one default organization for existing data
- add nullable `userId` linkage where needed

### Phase C: Context-aware auth

- shift session identity from `employeeId`-only to `userId + organizationId + membershipId`
- preserve compatibility for existing flows during transition

### Phase D: Tenant-scoped repositories

- introduce repository/service tenant-context pattern
- stop direct unscoped Prisma reads for tenant-owned resources

### Phase E: Constraint hardening

- make `organizationId` required on tenant-owned tables
- replace global uniques with organization-aware uniques
- add organization-aware indexes

### Phase F: Storage and async isolation

- migrate documents to organization-aware object storage
- make outbox and jobs organization-aware

### Phase G: Tenant-specific configuration

- move policy, role, and auth-domain configuration into organization scope

## 17. Major Risks And Mitigation Steps

### Risk: cross-tenant data leakage

- mitigation: make organization scoping explicit in schema, repositories, and authorization checks
- mitigation: add integration tests that prove cross-tenant denial on every major resource type

### Risk: auth/session confusion during migration

- mitigation: split `User` from `Employee` deliberately
- mitigation: keep a compatibility bridge while routes move to tenant context

### Risk: role model over-simplification

- mitigation: keep global permissions stable but allow tenant-owned roles

### Risk: manager hierarchy leakage

- mitigation: ensure manager relationships and org membership are always checked together

### Risk: outbox and jobs processing the wrong tenant data

- mitigation: add `organizationId` to outbox and job tables early in the async migration phase

### Risk: document storage collisions

- mitigation: move to organization-prefixed object storage keys and isolated buckets or prefixes

### Risk: reporting queries bypassing tenant filters

- mitigation: move reports behind tenant-aware repositories rather than ad hoc Prisma queries

### Risk: combining too many migrations at once

- mitigation: separate identity, tenancy keys, repository refactor, and provider migration into staged releases

## 18. Exact Recommended First Code Phase After This Document

Recommended first implementation phase:

- add platform identity and organization foundation models only

Exact scope:

1. add new schema models for `Organization`, `User`, `OrganizationMembership`, and `UserIdentity`
2. add nullable `organizationId` to `Employee` first
3. add nullable `userId` to `Employee`
4. backfill one default organization for existing copied data
5. do not yet tenant-scope PTO, documents, onboarding, offboarding, or jobs in the same phase
6. do not yet switch auth/session behavior in the same phase

Why this should be first:

- it creates the minimum platform foundation without forcing an all-at-once rewrite
- it gives every later migration a stable organization anchor
- it lets the existing single-tenant logic keep working during the transition

## Recommended First Schema/Code Phase Deliverables

- Prisma schema changes for platform identity foundation only
- migration script for default organization backfill
- seed update for default organization and membership scaffolding
- no feature changes yet
- no tenant switching yet
- no organization-aware UI yet
- no document storage migration yet

## Phase 3 Implementation Notes

The current branch now matches the intended first schema/code phase except for live migration application.

- the schema foundation is present in [prisma/schema.prisma](/Users/mmitchell/dev/hr-cloud/prisma/schema.prisma:1)
- the PostgreSQL rehearsal migration artifact lives at [prisma/postgres-rehearsal/migrations/platform_identity_foundation/migration.sql](/Users/mmitchell/dev/hr-cloud/prisma/postgres-rehearsal/migrations/platform_identity_foundation/migration.sql:1)
- the artifact inserts one `default-org` organization and backfills existing `Employee.organizationId` values where null
- live `prisma migrate dev` is still blocked locally until `DATABASE_URL` points to a scratch PostgreSQL database
- the legacy MySQL SQL migration history remains preserved and is not reused for PostgreSQL execution

## Notes From Existing Repo Structure

Important current codebase patterns that should guide implementation:

- auth currently centers on `employeeId` in `auth.ts` and `types/next-auth.d.ts`
- authorization is strongly server-side and should stay that way
- many API routes still query Prisma directly, so repository centralization should be incremental
- documents and acknowledgements already have useful service boundaries for later tenant scoping
- onboarding and offboarding already have service-level orchestration that can become tenant-aware
- audit and outbox helpers are centralized enough to evolve cleanly
- deployment/environment separation docs already exist and should remain the baseline for future SaaS infrastructure work
