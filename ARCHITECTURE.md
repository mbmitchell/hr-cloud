# MFN HR Platform Architecture

## Overview

The MFN HR Platform is a single-application internal HR and PTO system built with Next.js App Router and Prisma. It combines employee self-service workflows with HR/admin operations in one codebase and relies on Microsoft Entra for authentication, internal employee records for authorization, and Microsoft Graph for email and calendar integration.

This document explains how the current system is structured, how requests and background side effects flow through the application, and where the key security boundaries live.

## System Architecture

### Request Flow

Typical request path:

```text
Browser
  -> HTTPS
  -> Nginx
  -> Next.js route / page / server component
  -> Auth.js session lookup if needed
  -> Server-side authorization helper
  -> Prisma query / transaction
  -> Optional post-commit side effects
     -> email notification
     -> Outlook calendar event
     -> audit/security logging
  -> Response
```

Key design choice:
- business mutations complete in the database first
- non-critical side effects such as email and calendar sync run afterward
- failures in those side effects are logged but do not roll back the core HR action

### Application Layers

The codebase is roughly organized into these layers:

1. App Router layer
   - `app/`
   - contains pages, layouts, and API routes
   - API routes validate payloads, call auth helpers, and orchestrate mutations

2. Domain / server helpers
   - `lib/server/`
   - central authorization, audit utilities, employee visibility helpers, and security helpers

3. PTO domain logic
   - `lib/pto/`
   - PTO accrual, rollover, leave-type handling, and approval mutation logic

4. Auth layer
   - `auth.ts`
   - `lib/auth/`
   - Auth.js configuration, Microsoft Entra sign-in resolution, employee identity binding, and current-user lookup

5. Integration layer
   - `lib/notifications/`
   - email transport selection, Microsoft Graph integration, and calendar event creation

6. Persistence layer
   - Prisma ORM against MySQL
   - schema and migrations in `prisma/`

### Server Infrastructure

Current deployment model:

```text
Internet / internal users
  -> Nginx (TLS termination, reverse proxy, rate limiting)
  -> Next.js Node process on port 3000
  -> PM2 process supervision
  -> Prisma
  -> MySQL
```

Infrastructure security responsibilities:
- Nginx handles HTTPS and reverse proxying
- PM2 keeps the Node application running
- Fail2Ban provides additional protection around repeated hostile traffic
- application code enforces internal identity and authorization rules

## Authentication Design

### Microsoft Entra SSO

Primary sign-in is handled by Auth.js with the `microsoft-entra-id` provider.

Required properties:
- `clientId`
- `clientSecret`
- `issuer`

The configured redirect URI is:

```text
/api/auth/callback/microsoft-entra-id
```

Important implementation details:
- the app uses the Entra Application (client) ID GUID, not an `api://...` URI
- the issuer must be tenant-specific
- the `tid` claim is validated against the configured issuer tenant
- the app restricts email fallback to the `@mfncuso.com` domain

### Employee Identity Binding

The application does not treat Microsoft identity alone as sufficient authorization. Every user must map to an internal `Employee`.

Login resolution flow:

1. User authenticates with Microsoft Entra
2. App extracts:
   - `oid`
   - `tid`
   - email candidates
   - display name
3. App validates:
   - issuer
   - tenant id
   - required `oid`
4. App attempts employee lookup by:
   - `entraOid + entraTid`
5. If no binding exists yet, app falls back to email lookup
6. If email lookup succeeds, app stores:
   - `entraOid`
   - `entraTid`
7. Login is allowed only if the employee exists and is `ACTIVE`

This design uses email only as a bootstrap path. Long-term identity is anchored to stable Entra identifiers.

### Token and Session Behavior

Auth.js uses:
- `strategy: "jwt"`
- explicit `maxAge` of 8 hours

Security properties:
- the JWT is invalidated if there is no internal `employeeId`
- raw OAuth fields are stripped from the token
- the client session is intentionally minimal

Client session contains only:
- `employeeId`
- `name`
- `email`

It does not expose:
- access tokens
- refresh tokens
- `id_token`
- scopes
- raw Microsoft claims

### Dev Authentication

The repo still contains a temporary credentials-based login path for break-glass or rollout use.

It is controlled by:
- `AUTH_ENABLE_DEV_AUTH`
- `AUTH_DEV_PASSWORD`
- `AUTH_DEV_AUTH_EMAIL_ALLOWLIST`
- `AUTH_ENABLE_DEV_USER_SWITCHER`

Important rules:
- dev auth should be disabled in deployed environments
- the user switcher should remain disabled outside development
- the code logs startup warnings if these are enabled outside development

## Database Design

## Prisma Model Overview

The database is modeled in [prisma/schema.prisma](/Users/mmitchell/dev/mfn-hr-app/prisma/schema.prisma).

Core domains:
- Employee identity and hierarchy
- PTO requests and request history
- PTO/COMP ledger tracking
- Roles and permissions
- Audit logging
- Policy settings

### Employee

The `Employee` table is the central internal identity record.

Important fields:
- `email`
- `entraOid`
- `entraTid`
- `firstName`
- `lastName`
- `managerId`
- `status`
- compensation and FTE fields
- accrual override fields

Important relationships:
- self-referential manager/direct report hierarchy
- PTO requests
- PTO ledger entries
- role assignments

Important constraint:
- `@@unique([entraTid, entraOid])`

That constraint ensures one Entra identity maps to at most one employee.

### PTORequest and PTORequestAction

`PTORequest` stores the workflow record:
- leave type
- date span
- hours
- status
- approver / decision fields
- notes and approval comment
- linked Graph calendar event id

`PTORequestAction` stores the audit-style workflow trail:
- submitted
- approved
- denied
- canceled

This split allows the app to keep the current request state while also preserving a request-level history.

### PTOLedger

`PTOLedger` stores running-balance entries for:
- PTO accrual
- PTO usage
- COMP additions/subtractions
- year-end forfeiture

Important fields:
- `bucket`
- `type`
- `hours`
- `balance`
- `effectiveDate`
- `sourceRequestId`
- `idempotencyKey`

Important design notes:
- the ledger stores a running balance per entry
- safety fields reduce duplicate posting during retries
- workflow-only leave such as bereavement does not create deduction entries

### AuditLog

`AuditLog` records structured before/after changes and security events.

Used for:
- HR business mutations
- sign-in events
- authorization denials
- notification and integration outcomes where appropriate

### Roles and Permissions

Authorization is backed by:
- `Role`
- `Permission`
- `RolePermission`
- `EmployeeRoleAssignment`

This allows role-based access decisions to remain in the database rather than only in UI conditions.

### PolicySettings

`PolicySettings` stores PTO policy configuration such as:
- accrual rates for tenure brackets
- rollover cap hours

Current implementation assumes a single global policy set for the whole company.

## PTO Business Rules

### Leave Types

The system currently distinguishes between:
- PTO
- SICK
- COMP
- BEREAVEMENT

High-level behavior:
- `PTO` consumes PTO balance
- `COMP` consumes COMP balance when used and can be manually granted
- `SICK` is workflow-supported and can still participate in approval/calendar views
- `BEREAVEMENT` is workflow-only and does not deduct PTO or COMP balance

### PTO vs SICK Bucket Behavior

The schema stores `leaveType` as a string on requests and `bucket` as a string on ledger rows.

Current business logic:
- only leave types that map to a tracked balance may create deduction rows
- workflow-only types are explicitly blocked from falling through to PTO bucket handling

### COMP Tracking

COMP time is tracked separately from PTO in the ledger.

Important rules:
- managers may add COMP time only when allowed by server-side authorization
- manager-scoped COMP additions are limited to:
  - themselves
  - direct reports
- managers do not automatically gain broad PTO adjustment rights

### Monthly Accrual Logic

Monthly accrual is handled in `lib/pto/accrual.ts` and `lib/pto/accrual-job.ts`.

Current model:
- accrual rate is based on full years of service
- an employee-specific monthly accrual override may replace the policy rate
- the monthly job posts one accrual row per active employee
- duplicate protection uses idempotency-style keys plus existing-row checks

Default policy brackets:
- 0-5 years
- 6-10 years
- over 10 years

### Rollover Rules

Year-end rollover currently uses a cap-based forfeiture model.

Behavior:
- look up latest PTO balance
- if balance exceeds the configured rollover cap, post a negative `FORFEITURE` entry
- if balance is already under the cap, skip the employee
- protect against duplicate year-end processing with idempotency checks

### Manager Approval Logic

Approval authority is enforced server-side.

Approval checks consider:
- authenticated employee identity
- current roles and permissions
- reporting relationship to the requesting employee

Important design choice:
- manager/admin approval logic lives in centralized authorization helpers
- routes should not trust UI visibility as proof of authorization

## Notification System

### Email Notifications

Email notifications are implemented under `lib/notifications/email/`.

Current workflow notifications:
- PTO request submitted -> manager / fallback approver
- PTO request approved -> employee
- PTO request denied -> employee
- PTO adjustment posted -> employee

Behavior:
- build subject/body from small workflow templates
- send after the database transaction succeeds
- log sent/skipped/failed outcomes

### Microsoft Graph Integration

Production email delivery uses Microsoft Graph app-only authentication.

Transport behavior:
- local/dev uses a safe non-delivery transport
- production uses Graph
- mailbox identity comes from `GRAPH_MAILBOX_USER_ID`

Graph token handling:
- server-side only
- client credentials flow
- cached token reuse until near expiry

### Non-Blocking Dispatch

Email sending is intentionally best-effort:
- HR mutation succeeds first
- notification dispatch happens afterward
- failure is logged
- mutation is not rolled back

This keeps approvals, requests, and adjustments operational even if Microsoft 365 is temporarily unavailable.

### Logging Strategy

Notification logging captures safe metadata only:
- event type
- category
- provider
- recipient
- related employee / request / entity ids
- outcome
- error summary on failure

It avoids:
- secrets
- tokens
- full provider payloads

## Calendar Integration

### Microsoft 365 Shared Calendar

Approved PTO requests can create Outlook events in the dedicated Microsoft 365 mailbox used by the application.

Behavior:
- only `APPROVED` requests create events
- duplicate protection uses:
  - `graphCalendarEventId`
  - stable transaction identifiers
- event creation is post-commit and non-blocking

Event content includes:
- employee name
- leave type
- request id
- approver name when available

### Approved PTO Event Generation

The event creation flow is:

1. Request is approved in the database
2. Approval route dispatches background calendar sync
3. Graph event is created in the shared mailbox calendar
4. `graphCalendarEventId` is stored back on the request

Current behavior:
- full-day requests become all-day Outlook events
- single-day partial requests become timed events

### iCal Feed

There is no dedicated iCal feed implementation in the current codebase.

Current calendar integration is based on:
- in-app PTO calendar views
- Microsoft 365 shared mailbox calendar events for approved requests

If iCal distribution becomes a requirement later, it should be documented as a separate integration path rather than assumed to exist today.

## Security Model

### Authentication

- Microsoft Entra SSO is the primary authentication mechanism
- tenant id is validated
- Entra `oid` is required
- internal employee match is required
- inactive employees are denied

### Authorization

Authorization is enforced server-side using shared helpers in `lib/server/authorization.ts`.

Patterns include:
- require authenticated employee
- require role
- require admin
- require manager-of-employee relationship
- assert request-level permissions

The application intentionally does not trust:
- hidden UI links
- client-provided employee ids
- client-side route visibility

### Audit Logging

Audit logging covers:
- PTO mutations
- adjustment posting
- approval actions
- auth security events
- authorization denials

Goal:
- support operational traceability
- support HR accountability
- avoid storing raw secrets or tokens

### Environment Variables

Secrets and deployment-specific values are provided through environment variables, including:
- database connection
- NextAuth secret
- Entra client credentials
- Graph client credentials

Tracked config files use placeholders only.

### Infrastructure Protections

Infrastructure protections currently include:
- Nginx reverse proxy
- HTTPS with Let's Encrypt
- DNS-01 certificate validation
- Nginx rate limiting
- Fail2Ban
- PM2 process supervision

App-layer protections include:
- auth rate limiting for auth endpoints
- explicit dev-auth safeguards
- minimal session payloads

## Deployment Architecture

### GitHub Deployment Flow

Deployment is automated by GitHub Actions:

1. push to `main`
2. GitHub Actions opens SSH session to the server
3. server performs:
   - git pull
   - dependency install
   - Prisma client generation
   - Prisma migrations
   - Next.js build
   - PM2 restart

### PM2 Process Management

PM2 is responsible for:
- keeping the Next.js app process running
- restarting after deploy

The app itself listens on port `3000`.

### Nginx Reverse Proxy

Nginx handles:
- inbound HTTPS
- reverse proxying to the Next.js process
- request shaping and rate limiting

This keeps the Node app behind a standard production edge layer.

### Certificate Management

TLS is managed with Let's Encrypt and DNS-01 validation.

That allows certificate issuance without exposing HTTP challenge endpoints on the application server.

## Development Guidelines

### Coding Conventions

- Keep route handlers thin
- Put security-sensitive logic in shared server helpers
- Prefer server-side enforcement over UI-only checks
- Use Prisma transactions for multi-step HR mutations
- Keep side effects post-commit when they should not block the business action

### Adding New HR Features

When adding a new workflow:

1. define the business rule clearly
2. enforce auth and authorization on the server
3. write the mutation transaction first
4. add audit logging
5. add notifications/integrations after commit if needed
6. add focused regression tests

### Adding New API Routes

Recommended pattern:

1. parse and validate request data
2. resolve authenticated actor
3. enforce authorization with shared helpers
4. load the minimum Prisma data needed
5. run mutation inside a transaction when multiple writes must stay consistent
6. dispatch side effects after success

### Maintaining Security Boundaries

Important rules for future work:
- never trust employee identity from the client body
- never rely on hidden UI elements as authorization
- keep client session payloads minimal
- do not expose Graph or OAuth tokens to the client
- keep dev auth off in production
- log privileged failures with safe metadata

## Documentation Expansion Opportunities

This document covers the current architecture at a practical level, but a few areas would benefit from future dedicated docs:

- full role/permission matrix
- PTO policy change management process
- reporting/export architecture
- mobile UX patterns for page-level flows
- operational runbooks for Microsoft Graph and Entra outages
