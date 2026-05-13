# MFN HR Platform

Internal HR and PTO management platform for Managed Financial Networks (MFN).

## HR Cloud Fork Safety

This repository is the `hr-cloud` fork of the existing MFN HR application.

It must be treated as a separate deployment target and must not be deployed over the current MFN HR production app. Until cloud-specific configuration is completed, assume that inherited deployment paths, process names, email settings, storage paths, and authentication assumptions are still MFN-oriented.

Before any deployment of this fork:

- use a separate database
- use separate secrets and environment variables
- use separate document storage
- use separate server/container paths and process names
- review Microsoft Entra, Microsoft Graph, and email mailbox settings independently

The initial migration inventory is documented in [docs/hr-cloud-migration-plan.md](/Users/mmitchell/dev/hr-cloud/docs/hr-cloud-migration-plan.md).

## Environment Separation Required

Before deploying this fork anywhere outside local development, create fully separate operational configuration for `hr-cloud`, including its own deployment directory, process name, database, Entra app registration, mailbox identity, document storage root, secrets, and backup/log locations.

See [docs/hr-cloud-environment-separation.md](/Users/mmitchell/dev/hr-cloud/docs/hr-cloud-environment-separation.md) for the recommended separation values and the current Next.js lockfile warning note.

## SaaS Backend Planning

The Phase 2 backend conversion plan for turning this single-company app into a cloud SaaS HR platform is documented in [docs/saas-backend-architecture-plan.md](/Users/mmitchell/dev/hr-cloud/docs/saas-backend-architecture-plan.md).

## PostgreSQL Compatibility

The PostgreSQL migration readiness review is documented in [docs/postgres-compatibility-review.md](/Users/mmitchell/dev/hr-cloud/docs/postgres-compatibility-review.md).

## 1. Project Overview

The MFN HR Platform is a Next.js application for employee self-service and HR operations. It supports employee directory management, PTO request workflows, manager approvals, PTO/COMP balance tracking, audit logging, Microsoft 365 notifications, and Outlook calendar visibility for approved PTO.

The application is designed for internal company use and assumes a single-company deployment model with Microsoft Entra SSO and server-side authorization.

## 2. Technology Stack

- Next.js 15 App Router
- Node.js
- TypeScript
- Prisma ORM
- MySQL
- Auth.js / NextAuth v5
- Microsoft Entra ID SSO
- Microsoft Graph for email and calendar integration
- Tailwind CSS
- Nginx reverse proxy
- PM2 process manager
- Ubuntu Linux server

## 3. Architecture Diagram

```text
Browser
  -> HTTPS
  -> Nginx reverse proxy
  -> Next.js Node app (port 3000)
  -> Prisma ORM
  -> MySQL

Microsoft Entra ID
  -> Auth.js / NextAuth callbacks
  -> Internal Employee identity binding

Microsoft Graph
  -> Email notifications
  -> Shared mailbox calendar events for approved PTO
```

## 4. Major Features

- Employee directory and profile views
- PTO request submission and request history
- Manager/admin approval workflow
- PTO and COMP ledger tracking
- Monthly PTO accrual processing
- Year-end rollover / forfeiture processing
- Company PTO calendar
- Staffing conflict detection
- PTO adjustment tools
- Audit logging
- Microsoft 365 email notifications
- Microsoft 365 shared calendar event creation for approved PTO

## 5. Authentication Overview

- Microsoft Entra ID is the primary authentication method.
- Employees are matched to internal `Employee` records.
- On first successful Microsoft login, the app binds:
  - `entraOid`
  - `entraTid`
- Future sign-ins resolve by `entraOid + entraTid`.
- Login is denied when:
  - the Entra tenant does not match configuration
  - the account email is not in the `@mfncuso.com` domain
  - no matching `Employee` exists
  - the employee is inactive

Temporary dev credentials login still exists behind explicit environment flags and should remain disabled in deployed environments.

## 6. Running Locally

1. Install dependencies:

```bash
npm ci
```

2. Configure environment variables:

```bash
cp .env.example .env.local
```

3. Set a local MySQL `DATABASE_URL` and auth values.

4. Generate the Prisma client and apply migrations:

```bash
npm run prisma:generate
npx prisma migrate dev
```

5. Seed data if needed:

```bash
npm run prisma:seed
```

6. Start the app:

```bash
npm run dev
```

## 7. Deployment Process

The checked-in deployment references for this fork must use dedicated hr-cloud infrastructure only:

- repository: this `hr-cloud` fork
- server path: `/home/hr-cloud/hr-cloud-app`
- PM2 process name: `hr-cloud`
- production URL: `https://hr-cloud.example.com`
- database target: dedicated `hr_cloud` database
- document storage target: `/var/lib/hr-cloud-documents`
- mailbox/sender identity: `notifications@hr-cloud.example.com`
- internal job key: dedicated `INTERNAL_JOB_SECRET`
- deployment secrets: dedicated `HR_CLOUD_*` GitHub or platform secrets

The GitHub Actions workflow and App Runner template are examples and must be verified against dedicated hr-cloud infrastructure before use.

Current hr-cloud deployment template is GitHub-driven:

1. Push to `main`
2. GitHub Actions SSHes into the dedicated hr-cloud server
3. Server runs:
   - `git pull`
   - `npm ci`
   - `npm run prisma:generate`
   - `npx prisma migrate deploy`
   - `npm run build`
   - `pm2 restart hr-cloud`

Nginx or the chosen cloud edge should terminate TLS for the dedicated hr-cloud hostname and proxy traffic to the Next.js app on port `3000`.

## 8. Environment Variables

Core application:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `APP_BASE_URL`

Microsoft Entra:

- `AUTH_MICROSOFT_ENTRA_ID_ID`
- `AUTH_MICROSOFT_ENTRA_ID_SECRET`
- `AUTH_MICROSOFT_ENTRA_ID_ISSUER`

Temporary dev auth:

- `AUTH_ENABLE_DEV_AUTH`
- `AUTH_DEV_PASSWORD`
- `AUTH_DEV_AUTH_EMAIL_ALLOWLIST`
- `AUTH_ENABLE_DEV_USER_SWITCHER`

Email / calendar:

- `EMAIL_TRANSPORT`
- `EMAIL_FROM`
- `EMAIL_REPLY_TO`
- `GRAPH_TENANT_ID`
- `GRAPH_CLIENT_ID`
- `GRAPH_CLIENT_SECRET`
- `GRAPH_MAILBOX_USER_ID`
- `DOCUMENT_ACKNOWLEDGEMENT_REMINDERS_ENABLED`
- `DOCUMENT_ACKNOWLEDGEMENT_REMINDER_STALE_DAYS`

See [.env.example](/Users/mmitchell/dev/hr-cloud/.env.example) for current examples and inline notes.

## 8.1 Scheduled Acknowledgement Reminders

Document acknowledgement reminders can be executed manually or from cron with:

```bash
npm run reminders:acknowledgements
```

Recommended Ubuntu cron entry for a once-daily run:

```bash
0 8 * * * cd /home/hr-cloud/hr-cloud-app && /usr/bin/npm run reminders:acknowledgements >> /var/log/hr-cloud/acknowledgement-reminders.log 2>&1
```

Notes:

- The script reuses the same reminder generation logic as the admin trigger route.
- `DOCUMENT_ACKNOWLEDGEMENT_REMINDERS_ENABLED="false"` cleanly skips scheduled runs.
- `DOCUMENT_ACKNOWLEDGEMENT_REMINDER_STALE_DAYS` controls the non-overdue pending threshold.
- The script logs one JSON summary line per run for easy tailing or log shipping.
- The cron host, working directory, log path, and internal job key must be dedicated to hr-cloud.

## 9. Folder Structure Overview

```text
app/
  API routes, pages, layouts, and App Router UI

components/
  Shared UI components and layout/navigation

lib/
  Authentication, authorization, PTO logic, notifications,
  audit helpers, and integration code

prisma/
  Prisma schema, migrations, and seed script

tests/
  Lightweight regression tests using node:test + tsx
```

## 10. Security Design Overview

- Microsoft Entra SSO with tenant validation
- Internal employee identity binding using `entraOid + entraTid`
- Server-side authorization helpers for privileged operations
- Prisma ORM for parameterized database access
- Audit logging for key auth, authorization, and HR mutations
- Environment-variable-based secret handling
- Baseline response hardening headers set by Next.js:
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `X-Frame-Options: DENY`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- Nginx rate limiting
- Fail2Ban
- TLS via Let's Encrypt
- Temporary dev auth controls explicitly gated by env flags

Nginx should still enforce edge concerns that are deployment-specific, especially:
- HSTS
- request/body size limits
- rate limiting
- any future CSP or `frame-ancestors` policy, if introduced after explicit validation

## 11. Future Roadmap

- Continue improving mobile usability on high-traffic screens
- Expand architectural documentation for PTO jobs and reporting
- Consider durable background processing for email/calendar work
- Add update/delete handling for Outlook PTO events when requests change
- Continue tightening test coverage around privileged workflows

## Documentation Notes

- See [ARCHITECTURE.md](/Users/mmitchell/dev/hr-cloud/ARCHITECTURE.md) for the detailed developer guide.
- See [AUTH_VERIFICATION.md](/Users/mmitchell/dev/hr-cloud/AUTH_VERIFICATION.md) for production auth verification checks.
