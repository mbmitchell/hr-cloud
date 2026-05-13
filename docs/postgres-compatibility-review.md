# PostgreSQL Compatibility Review

## Purpose

This document reviews the current Prisma/MySQL implementation for future PostgreSQL migration readiness.

This is a documentation-only review.

- no Prisma provider change yet
- no schema rewrite yet
- no generated migration yet
- no runtime behavior changes

## Current State Summary

The application currently uses:

- Prisma ORM 5.22
- `datasource db { provider = "mysql" }`
- Prisma-managed SQL migrations under `prisma/migrations`
- direct Prisma usage from route handlers and service modules
- no runtime raw SQL usage found in application code

Current Prisma posture is relatively portable at the schema layer, but the migration history is strongly MySQL-specific.

## Scope Reviewed

- `prisma/schema.prisma`
- `prisma/migrations/*/migration.sql`
- `package.json`
- Prisma client/bootstrap usage
- service and repository code for database-provider assumptions
- raw SQL usage search across `app`, `lib`, `prisma`, `scripts`, and `tests`

## High-Level Conclusion

The active Prisma schema is mostly portable to PostgreSQL.

The biggest PostgreSQL migration blocker is not the schema design itself. It is the existing migration history, which contains MySQL-specific SQL syntax and engine/collation assumptions that cannot be replayed directly on PostgreSQL.

## Prisma Schema Audit

## Native Database Type Usage

### `@db.VarChar` lengths

- none found

Impact:

- low risk
- no MySQL-specific varchar length tuning needs immediate translation

### `@db.Text`

Used in several places, including:

- `HrNotificationOutbox.lastError`
- `EmployeeChangeRequest.reason`
- `EmployeeChangeRequest.notes`
- `PTORequestAction.comment`
- `AuditLog.oldValue`
- `AuditLog.newValue`
- document, onboarding, offboarding, and compensation notes/description fields

Impact:

- low risk
- Prisma maps `@db.Text` cleanly to PostgreSQL `TEXT`

### `@db.LongText`

- none found

Impact:

- low risk

### Unsigned integers

- none found

Impact:

- low risk
- no MySQL unsigned conversion work identified

### Tinyint / boolean assumptions

- schema uses Prisma `Boolean`
- no explicit MySQL `TINYINT(1)` declarations in the Prisma schema

Impact:

- low risk
- Prisma boolean semantics should transfer cleanly

### Decimal / numeric types

Used in compensation and benefits:

- `EmployeeCompensationProfile`
- `EmployeeCompensationHistory`
- `EmployeeBenefitElection`

Examples:

- `@db.Decimal(12, 2)`
- `@db.Decimal(10, 2)`
- `@db.Decimal(5, 2)`

Impact:

- low to medium risk
- PostgreSQL `NUMERIC` is a good fit, but financial calculations and serialization should be regression-tested carefully

### Float usage

Used in:

- `Employee.hourlyRate`
- `Employee.annualSalary`
- `Employee.fte`
- `PTORequest.hours`
- `PTOLedger.hours`
- `PTOLedger.balance`
- `PolicySettings` accrual and rollover values

Impact:

- medium risk
- PostgreSQL portability is fine, but float precision should be reviewed long-term, especially for PTO balances and policy values
- not a PostgreSQL blocker, but worth future normalization review

## DateTime / Timestamp Behavior

The schema uses Prisma `DateTime` broadly for:

- employee lifecycle fields
- PTO request dates
- document timestamps
- audit and outbox timestamps
- onboarding/offboarding due/completion dates
- scheduled job timestamps

The MySQL migration SQL uses `DATETIME(3)` and `CURRENT_TIMESTAMP(3)`.

Impact:

- medium risk
- PostgreSQL will use timestamp types rather than MySQL `DATETIME(3)`
- timezone handling must be validated carefully because the code mixes:
  - true timestamps
  - date-only business values represented as `Date`
  - generated strings for reports and APIs

Key concern areas:

- PTO start/end dates
- `requestedEffectiveDate` and compensation effective dates
- onboarding/offboarding due dates
- report sorting and export formatting

## Enum Compatibility

The schema uses Prisma enums for:

- accrual modes
- benefit types/statuses
- payroll frequencies
- change request statuses/types
- notification statuses/types/template keys
- scheduled job run status

Impact:

- low to medium risk
- PostgreSQL enum support is good in Prisma
- future enum evolution must be handled carefully because PostgreSQL enum changes are stricter than MySQL string-based patterns in some workflows

## JSON Compatibility

JSON fields currently used:

- `HrNotificationOutbox.payload`
- `EmployeeChangeRequest.oldValues`
- `EmployeeChangeRequest.newValues`

Impact:

- low risk
- PostgreSQL `jsonb` is a strong fit
- payload querying is not heavily DB-specific today

## Default Value Assumptions

Current defaults include:

- `@default(now())`
- `@updatedAt`
- numeric defaults
- boolean defaults
- enum defaults

Impact:

- low risk
- these are standard Prisma patterns and should map well to PostgreSQL

## Unique Constraint Review

Potentially sensitive unique constraints include:

- `Employee.email`
- `Employee.entraTid + Employee.entraOid`
- `ScheduledJobRun.runKey`
- `EmployeeCompensationProfile.employeeId`
- `PTORequest.graphCalendarEventId`
- `PTOLedger.sourceRequestId`
- `PTOLedger.idempotencyKey`
- `EmployeeOnboarding.employeeId`
- `EmployeeDocumentAssignment.employeeId + assignableDocumentVersionId`
- outbox linkage uniqueness columns

Impact:

- medium risk
- Prisma can represent these in PostgreSQL, but uniqueness behavior must be validated against existing data assumptions
- nullable unique columns behave similarly enough for most cases, but real data verification is still required

## Case Sensitivity / Collation Concerns

This is one of the most important application-level migration concerns.

Findings:

- MySQL migration SQL explicitly uses `utf8mb4_unicode_ci`
- that collation is case-insensitive
- PostgreSQL defaults are case-sensitive unless explicitly handled

Sensitive areas:

- `Employee.email` uniqueness and login lookup
- `recipientEmail` normalization in outbox tables
- `Role.code`
- `Permission.code`
- search/filter behavior in report queries and employee lookups

Why this matters:

- the code often normalizes email to lowercase before lookup or insert, which helps
- but the database currently benefits from case-insensitive collation semantics that PostgreSQL will not mirror automatically

Impact:

- medium to high risk

Recommended later mitigations:

- ensure canonical lowercase writes for all email identity fields
- audit existing production data for mixed-case duplicates before cutover
- consider PostgreSQL `citext` only if truly needed later, not as the first migration step

## Index Naming Length

The schema uses a mix of:

- explicit short `map:` names
- default Prisma naming

Findings:

- many explicit names are already compact
- some historical migration SQL shows long, truncated, or renamed index/constraint names

Impact:

- medium risk
- PostgreSQL has a 63-byte identifier limit
- the current schema is better than the historical migration SQL, but baseline migration generation should still be checked carefully

## Cascade / Restrict / Set Null Behaviors

The migration history shows consistent usage of:

- `ON DELETE RESTRICT`
- `ON DELETE SET NULL`
- `ON UPDATE CASCADE`

Impact:

- low to medium risk
- PostgreSQL supports these behaviors
- the main risk is validating that generated PostgreSQL DDL matches current intent, especially for self-relations and optional FKs

## Full-Text Assumptions

- no full-text indexes found
- no `MATCH ... AGAINST` usage found
- no PostgreSQL full-text migration blocker identified

Impact:

- low risk

## Raw SQL Review

Application/runtime code:

- no `prisma.$queryRaw`
- no `prisma.$executeRaw`
- no provider-specific runtime SQL found in the app/service layer

Migration history:

- extensive raw SQL exists in Prisma migration files
- it is MySQL-specific

Impact:

- runtime: low risk
- migration replay: high risk

## MySQL-Specific Migration History Concerns

The existing `migration.sql` files contain MySQL-specific syntax and assumptions, including:

- backtick-quoted identifiers
- `DATETIME(3)`
- `DEFAULT CURRENT_TIMESTAMP(3)`
- `DEFAULT CHARACTER SET utf8mb4`
- `COLLATE utf8mb4_unicode_ci`
- MySQL-style `ALTER TABLE`
- MySQL-specific `RENAME INDEX`

Impact:

- high risk
- these migrations cannot safely be replayed directly against PostgreSQL

This is the primary migration blocker for provider switching.

## Risk Classification

## Low-Risk Compatibility Items

- Prisma enums in general
- Prisma booleans
- `@db.Text`
- JSON fields
- `@default(now())`
- `@updatedAt`
- absence of unsigned integer usage
- absence of `@db.LongText`
- absence of runtime raw SQL
- absence of full-text DB-specific features

## Medium-Risk Compatibility Items

- float precision on PTO/policy values
- `DateTime` semantics and timezone handling
- nullable unique constraint verification
- constraint/index name length validation
- foreign-key action parity validation
- case-sensitive behavior in PostgreSQL versus MySQL collation behavior
- financial decimal serialization verification

## High-Risk Migration Blockers

- existing MySQL-specific migration SQL history
- collation/case-sensitivity differences for identity and uniqueness-critical fields
- any attempt to switch provider in place and replay existing migration files on PostgreSQL

## Specific Model Review

## Audit Log Models

Reviewed:

- `AuditLog`

Observations:

- simple shape
- string payload snapshots stored in `TEXT`
- no provider-specific schema blocker

Risk:

- low

Main caveat:

- if later converted to richer JSON payloads, PostgreSQL `jsonb` may be preferable, but that is not required for initial migration

## Document / Versioning Tables

Reviewed:

- `EmployeeDocument`
- `AssignableDocument`
- `AssignableDocumentVersion`
- `EmployeeDocumentAssignment`
- `DocumentAssignmentEmailOutbox`
- `DocumentAssignmentReminderEmailOutbox`

Observations:

- mostly standard relations and timestamps
- several optional unique relationships and status indexes
- no MySQL-specific field types in the Prisma schema

Risk:

- low to medium

Main caveats:

- validate unique constraints and FK actions carefully
- storage keys are application-level, not DB-provider-dependent

## Compensation Tables

Reviewed:

- `EmployeeCompensationProfile`
- `EmployeeCompensationHistory`
- `EmployeeBenefitElection`

Observations:

- good use of `Decimal`
- portable in Prisma

Risk:

- medium

Main caveats:

- verify exact numeric precision and report/export formatting
- validate historical backfill migration behavior in PostgreSQL

## Onboarding / Offboarding Models

Reviewed:

- onboarding templates, tasks, requirements, and employee onboarding tables
- offboarding templates, tasks, and employee offboarding tables

Observations:

- heavy use of optional FKs and timestamp fields
- migration SQL history contains many MySQL-specific FK rename/add/drop operations

Risk:

- medium

Main caveats:

- baseline PostgreSQL DDL generation must be reviewed carefully for relation naming and FK actions

## Outbox / Job Tables

Reviewed:

- `HrNotificationOutbox`
- `DocumentAssignmentEmailOutbox`
- `DocumentAssignmentReminderEmailOutbox`
- `ScheduledJobRun`

Observations:

- JSON payload support is favorable for PostgreSQL
- timestamps and unique run keys need standard validation only

Risk:

- low to medium

Main caveats:

- replaying MySQL migration SQL is unsafe
- failure-message truncation and payload behavior are application-side, not provider-side

## Role / Permission Tables

Reviewed:

- `Role`
- `Permission`
- `RolePermission`
- `EmployeeRoleAssignment`

Observations:

- structurally straightforward
- major issue is case sensitivity for unique codes

Risk:

- medium

Main caveat:

- `Role.code` and `Permission.code` should be treated as canonical-case values before PostgreSQL cutover

## Repository / Service Layer Findings

General findings:

- services use Prisma directly rather than raw SQL
- provider assumptions are minimal in runtime code
- most provider sensitivity lives in:
  - migration SQL history
  - collation behavior
  - timestamp semantics

No MySQL-specific runtime blockers found in:

- auth/session persistence logic
- authorization services
- PTO request creation
- document services
- onboarding/offboarding services
- notification/outbox services
- audit helpers

This is good news: the migration risk is primarily schema/migration operational work, not a large runtime rewrite.

## Recommended Prisma / Provider Changes Needed Later

When ready for a PostgreSQL implementation phase:

1. change Prisma datasource provider from `mysql` to `postgresql` in an isolated branch
2. point at a scratch PostgreSQL database only
3. do not reuse current MySQL migration replay as-is
4. generate a PostgreSQL baseline from the current schema state
5. validate Prisma Client generation and build/test behavior against PostgreSQL

## Recommended Migration Sequencing

Safest sequence:

### Phase A: compatibility rehearsal

- isolated branch
- switch provider to PostgreSQL against scratch DB
- generate PostgreSQL-compatible baseline artifacts only
- no production cutover

### Phase B: data-quality validation

- audit email casing
- audit unique fields
- audit null/unique edge cases
- verify timestamp expectations in exports and workflows

### Phase C: baseline PostgreSQL schema creation

- create a fresh PostgreSQL baseline migration from the current logical schema
- do not attempt direct replay of existing MySQL SQL history

### Phase D: data migration rehearsal

- export MySQL data
- transform as needed
- import into scratch PostgreSQL
- run regression checks

### Phase E: application verification

- run build/tests against PostgreSQL-backed environment
- compare key workflows:
  - auth lookup
  - PTO request creation/approval
  - document acknowledgement assignment and reminder processing
  - onboarding/offboarding flows
  - compensation reporting

## Safest Migration Approach

Recommended safest approach:

- keep MySQL production unchanged
- create a new PostgreSQL baseline schema from Prisma
- migrate data into PostgreSQL through rehearsal scripts and verification passes
- cut over only after parity testing

Avoid:

- in-place provider switch on the main branch
- replaying old MySQL migration SQL against PostgreSQL
- combining provider migration with tenant-model refactors in one step

## Rollback Considerations

Rollback plan should assume:

- MySQL remains the source of truth until PostgreSQL cutover is verified
- provider-switch code should be isolated and reversible
- data migration should be repeatable, not one-off
- cutover should happen only after verified snapshots and restore points exist

Recommended rollback posture:

- snapshot MySQL before any cutover
- snapshot PostgreSQL rehearsal environment before final import
- keep application deploys reversible to MySQL-backed config until production signoff

## Top Migration Risks

1. MySQL-specific migration history cannot be replayed on PostgreSQL.
2. Email/code uniqueness and lookup semantics may change under PostgreSQL case sensitivity.
3. Timestamp/date-only workflows may shift subtly if timezone assumptions are not tested.
4. Float-based PTO/policy values could expose precision differences during report parity checks.

## Recommended Exact Next Implementation Phase

Recommended next phase:

`PostgreSQL Rehearsal Branch`

Exact scope:

1. create an isolated branch for provider-rehearsal work
2. switch Prisma datasource to PostgreSQL in that branch only
3. point at a scratch PostgreSQL database
4. generate a fresh PostgreSQL baseline migration from current logical schema
5. run `prisma generate`, build, and regression verification
6. do not migrate production data yet
7. do not introduce tenant or organization models in the same phase

Why this should be next:

- it tests real provider compatibility with minimal business risk
- it isolates the largest blocker, which is migration history portability
- it keeps tenant-model and SaaS changes decoupled from provider migration
