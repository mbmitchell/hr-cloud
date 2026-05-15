# Tenant Scope Candidate Risk Classification

## Purpose

This document classifies the current `postgres-rehearsal` branch modules and
route groups by tenant-scoping risk before any real `organizationId` filters
are introduced.

This is a planning-only phase.

It does not change:

- runtime behavior
- Prisma schema
- authorization behavior
- login or session behavior
- repository behavior
- query filters

## Classification Levels

- `Low risk`
  - good early pilot candidates for tenant-aware read-path work
- `Medium risk`
  - viable after low-risk pilots prove out the route and repository patterns
- `High risk`
  - tightly coupled, side-effect-heavy, or broadly joined
- `Do not scope yet`
  - should stay out of the first real tenant-filter waves because they are
    foundational, global, or operationally risky

## Recommended First Actual Tenant-Filter Pilot

Recommended first real tenant-filter pilot:

- employee directory and employee master read paths

Why this is the best first real filter pilot:

- the core business record `Employee` already has nullable `organizationId`
- the read paths are easier to compare before and after scoping
- they are less side-effect-heavy than PTO, document assignment, or jobs
- they naturally anchor many downstream modules
- the existing read-only repository-wrapper and tenant-context patterns can be
  extended here with minimal operational risk

Recommended exact pilot slice:

- one low-risk read-only employee-directory or employee-master report query
- add tenant-aware wrapper inputs
- introduce an `organizationId` filter only behind a controlled pilot path
- preserve existing admin authorization semantics while validating result parity

## Module Classification

### Employees

Risk:

- `Low risk`

Primary tables:

- `Employee`
- `EmployeeContactInfo`
- `EmployeeEmergencyContact`
- `EmployeeStatusHistory`
- `EmployeeRoleAssignment`

OrganizationId state:

- `Employee.organizationId` exists
- related supporting tables do not currently carry `organizationId`

Cross-table risks:

- manager/direct-report relationships are employee-to-employee and currently global
- role assignments and profile-adjacent records join through `employeeId`

Reports/export implications:

- employee master and reporting structure reports are strong pilot candidates

Job/background implications:

- low direct job coupling for basic read paths

Recommended migration order:

- first actual tenant-filter pilot candidate

### Auth/Admin Diagnostics

Risk:

- `Low risk`

Primary tables:

- `Employee`
- `User`
- `UserIdentity`
- `Organization`
- `OrganizationMembership`

OrganizationId state:

- `Employee.organizationId` exists
- membership and organization data exist

Cross-table risks:

- mostly diagnostics joins
- already read-only and admin-only

Reports/export implications:

- none directly

Job/background implications:

- none directly

Recommended migration order:

- already used for scaffolding and validation before real filtering

### PTO Requests, Approvals, And Ledger

Risk:

- `High risk`

Primary tables:

- `PTORequest`
- `PTORequestAction`
- `PTOLedger`
- `Employee`

OrganizationId state:

- PTO tables do not carry `organizationId`
- all tenant inference would currently have to flow through `Employee`

Cross-table risks:

- approval logic uses manager relationships and admin exceptions
- ledger and request records depend on employee identity consistency
- accrual and rollover jobs touch these records broadly

Reports/export implications:

- PTO ledger
- PTO liability
- summary dashboards
- staffing conflicts

Job/background implications:

- monthly accrual
- year-end rollover
- notifications and approvals

Recommended migration order:

- late

### Documents

Risk:

- `High risk`

Primary tables:

- `EmployeeDocument`
- `Employee`

OrganizationId state:

- `EmployeeDocument` does not carry `organizationId`
- tenant inference would currently rely on `Employee`

Cross-table risks:

- storage keys and file-access paths are sensitive
- linked to onboarding and job-change document flows

Reports/export implications:

- indirect via employee views and onboarding/offboarding flows

Job/background implications:

- document upload and retrieval behavior
- future storage partitioning work

Recommended migration order:

- late

### Document Acknowledgements

Risk:

- `High risk`

Primary tables:

- `AssignableDocument`
- `AssignableDocumentVersion`
- `EmployeeDocumentAssignment`
- `DocumentAssignmentEmailOutbox`
- `DocumentAssignmentReminderEmailOutbox`
- `HrNotificationOutbox`
- `Employee`

OrganizationId state:

- no direct `organizationId` on assignment or assignable-document tables
- tenant inference would currently rely on related employees

Cross-table risks:

- joins across assignment, employee, version, outbox, and onboarding requirement tables
- assignment uniqueness and reminder jobs increase risk

Reports/export implications:

- document acknowledgement reports and exports

Job/background implications:

- reminder generation
- notification processing
- email outbox flows

Recommended migration order:

- late

### Onboarding

Risk:

- `High risk`

Primary tables:

- `OnboardingTemplate`
- `OnboardingTemplateTask`
- `OnboardingTemplateTaskDocumentRequirement`
- `OnboardingTemplateTaskAcknowledgementRequirement`
- `EmployeeOnboarding`
- `EmployeeOnboardingTask`
- `EmployeeOnboardingTaskDocumentRequirement`
- `EmployeeOnboardingTaskAcknowledgementRequirement`

OrganizationId state:

- no onboarding tables carry `organizationId`
- templates are currently global

Cross-table risks:

- joins to employees, documents, and document assignments
- mixes templates and employee-specific runtime records

Reports/export implications:

- mostly UI and workflow facing today, but future audit/reporting risk is high

Job/background implications:

- document linkage and acknowledgement side effects

Recommended migration order:

- late

### Offboarding

Risk:

- `High risk`

Primary tables:

- `OffboardingTemplate`
- `OffboardingTemplateTask`
- `EmployeeOffboarding`
- `EmployeeOffboardingTask`
- `Employee`

OrganizationId state:

- offboarding tables do not carry `organizationId`
- templates are global

Cross-table risks:

- employee, assignee, and completed-by joins
- manager/admin access paths already complex

Reports/export implications:

- mostly UI/reporting through employee views today

Job/background implications:

- lower than PTO, but still operationally sensitive

Recommended migration order:

- late

### Reports And Exports

Risk:

- `Medium risk`

Primary tables:

- `Employee`
- `EmployeeRoleAssignment`
- `PTORequest`
- `PTOLedger`
- `EmployeeChangeRequest`
- `EmployeeDocumentAssignment`
- `AuditLog`
- compensation and benefits tables depending on report

OrganizationId state:

- mixed
- many underlying tables do not yet carry `organizationId`
- most would infer organization through employee joins

Cross-table risks:

- broad fan-out joins
- exports amplify mistakes quickly

Reports/export implications:

- this is the module itself

Job/background implications:

- some internal report jobs already exist, especially PTO liability

Recommended migration order:

- after employee-directory pilots, before PTO write-path scoping

### Audit Logs

Risk:

- `Do not scope yet`

Primary tables:

- `AuditLog`
- `EmployeeStatusHistory`
- security-event audit writers

OrganizationId state:

- `AuditLog` has no `organizationId`
- actor and entity references are global strings today

Cross-table risks:

- audit trails often need platform-wide or cross-tenant visibility later
- scoping too early could hide operational evidence

Reports/export implications:

- audit-log reporting and PDF export

Job/background implications:

- operational and compliance sensitivity

Recommended migration order:

- very late, after tenant visibility policy is explicitly designed

### Internal Jobs

Risk:

- `Do not scope yet`

Primary tables:

- `ScheduledJobRun`
- `HrNotificationOutbox`
- `PTORequest`
- `PTOLedger`
- report job tables via underlying modules

OrganizationId state:

- `ScheduledJobRun` has no `organizationId`
- most jobs currently run platform-wide

Cross-table risks:

- execution semantics are global
- idempotency keys and run keys are not organization-aware yet

Reports/export implications:

- report-generation jobs depend on these

Job/background implications:

- this is the module itself

Recommended migration order:

- only after job-scope design is complete

### Notifications And Outbox

Risk:

- `High risk`

Primary tables:

- `HrNotificationOutbox`
- `DocumentAssignmentEmailOutbox`
- `DocumentAssignmentReminderEmailOutbox`
- `Employee`

OrganizationId state:

- outbox tables do not carry `organizationId`
- tenant inference would currently flow through employee relations

Cross-table risks:

- recipient employee, creator employee, and related entity joins
- email/reminder processors are operationally sensitive

Reports/export implications:

- admin notification screens and reminder views

Job/background implications:

- notification processors and reminder generators

Recommended migration order:

- late

### Compensation

Risk:

- `High risk`

Primary tables:

- `EmployeeCompensationProfile`
- `EmployeeCompensationHistory`
- `Employee`

OrganizationId state:

- compensation tables do not carry `organizationId`
- scope would currently depend on employee joins

Cross-table risks:

- financially sensitive data
- admin write flows and audit implications

Reports/export implications:

- compensation affects employee-master and export-style views indirectly

Job/background implications:

- lower background-job coupling than PTO, but high data sensitivity

Recommended migration order:

- late

### Policy Settings

Risk:

- `Do not scope yet`

Primary tables:

- `PolicySettings`

OrganizationId state:

- no `organizationId`
- currently a single global settings record

Cross-table risks:

- affects PTO accrual and rollover behavior globally

Reports/export implications:

- downstream through PTO reporting and calculations

Job/background implications:

- accrual and rollover jobs consume policy behavior

Recommended migration order:

- do not scope until tenant-specific policy model is designed

### Benefits

Risk:

- `Medium risk`

Primary tables:

- `EmployeeBenefitElection`
- `Employee`

OrganizationId state:

- benefits table does not carry `organizationId`
- scope would currently depend on employee joins

Cross-table risks:

- less operational coupling than PTO
- still sensitive financial and employee data

Reports/export implications:

- benefit withholding export
- employee master views

Job/background implications:

- low current job coupling

Recommended migration order:

- after employee/read-only report pilots, before compensation or PTO write paths

## Modules Explicitly Marked Do Not Scope Yet

- audit logs
- internal jobs
- policy settings

These are intentionally blocked from early tenant-filter work because they are
global, operationally sensitive, or need a clearer platform-wide visibility
policy first.

## Recommended Migration Order

Suggested order once real scoping begins:

1. employee directory or employee master read pilot
2. additional read-only employee-centered report pilot
3. benefits read paths
4. broader reports and exports
5. compensation read paths
6. document and acknowledgement reads
7. onboarding and offboarding
8. PTO reads, then PTO writes
9. notifications and outbox
10. internal jobs, audit, and policy only after dedicated designs
